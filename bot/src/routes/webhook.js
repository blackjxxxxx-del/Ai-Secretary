const express = require('express')
const { middleware, Client } = require('@line/bot-sdk')
const https = require('https')
const { analyzeMessage, generateChatReply, summarizeText, summarizeImage } = require('../services/gemini')
const { handleIntent, handlePendingDeadline, pendingStates } = require('../services/task')
const { replyText, pushText, QUICK_REPLY_MAIN, QUICK_REPLY_AFTER_LIST } = require('../services/line')
const { getOrCreateUser, supabase } = require('../db/supabase')
const { checkQuota, recordUsage } = require('../services/quota')
const { getTokens, getEmailSummary, getTodayCalendarEvents, getUpcomingEvents, addCalendarEvent, deleteCalendarEvent, readSheet, createSheet, addSheetRow, updateSheetCell, listDriveSheets, sendEmail } = require('../services/google')
const dayjs = require('dayjs')

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
}

const client = new Client(config)
const router = express.Router()

router.post('/', middleware(config), async (req, res) => {
  res.sendStatus(200)
  const events = req.body.events
  for (const event of events) {
    if (event.type !== 'message') continue
    if (event.message.type === 'text') await handleMessageEvent(event)
    if (event.message.type === 'image') await handleImageEvent(event)
    if (event.message.type === 'file') await handleFileEvent(event)
  }
})

async function handleMessageEvent(event) {
  const lineUserId = event.source.userId
  const text = event.message.text
  const replyToken = event.replyToken

  try {
    const user = await getOrCreateUser(lineUserId)

    if (pendingStates.has(user.id)) {
      const reply = await handlePendingDeadline(text, user)
      await replyText(replyToken, reply, QUICK_REPLY_MAIN)
      return
    }

    // upgrade — ยังคง keyword เพราะเป็น business critical
    const upgradeKeywords = ['อัปเกรด', 'อัพเกรด', 'อัพเพลน', 'อัปเพลน', 'upgrade', 'สมัคร pro', 'ซื้อ pro', 'pro plan', 'แพลน pro', 'plan pro', 'ใช้โปร', 'สมัครโปร']
    if (upgradeKeywords.some(k => text.toLowerCase().includes(k.toLowerCase()))) {
      const webUrl = process.env.WEB_URL || 'https://your-web-url.railway.app'
      await replyText(replyToken,
        `อัปเกรดเป็น Pro 499฿/เดือน\n\nคลิกลิงก์นี้เพื่อชำระเงินครับ:\n${webUrl}/upgrade?uid=${lineUserId}\n\nได้รับ: สรุปเอกสารไม่จำกัด + ทุกฟีเจอร์ครบ`,
        QUICK_REPLY_MAIN)
      return
    }

    // ให้ Gemini เข้าใจ intent ทั้งหมด
    const intent = await analyzeMessage(text)
    const webUrl = process.env.WEB_URL || 'https://your-web-url.railway.app'

    // helper สำหรับเช็ค Google token
    const requireGoogle = async () => {
      const tokens = await getTokens(user.id)
      if (!tokens) {
        await replyText(replyToken, `ยังไม่ได้เชื่อม Google ครับ กดลิงก์นี้เพื่อเชื่อมต่อ:\n\n${webUrl}/connect-google?uid=${lineUserId}`, QUICK_REPLY_MAIN)
        return null
      }
      return tokens
    }

    switch (intent.intent) {

      case 'connect_google': {
        const tokens = await getTokens(user.id)
        if (intent.action === 'reconnect' || !tokens) {
          await replyText(replyToken, `กดลิงก์นี้เพื่อเชื่อม Google ครับ:\n\n${webUrl}/connect-google?uid=${lineUserId}`, QUICK_REPLY_MAIN)
        } else {
          await replyText(replyToken, 'เชื่อม Google แล้วครับ บอกได้เลยว่าอยากให้ทำอะไร\n\nเช่น "ดูอีเมล" "ดูนัดพรุ่งนี้" "ส่งเมล์ถึง..." "ดูชีตทั้งหมด" ครับ', QUICK_REPLY_MAIN)
        }
        break
      }

      case 'list_emails': {
        if (!await requireGoogle()) break
        await replyText(replyToken, 'กำลังดึงอีเมลให้ครับ รอสักครู่...')
        const summary = await getEmailSummary(user.id)
        await pushText(lineUserId, summary)
        break
      }

      case 'send_email': {
        if (!await requireGoogle()) break
        if (!intent.to || !intent.subject || !intent.body) {
          await replyText(replyToken, 'บอกให้ครบนะครับ: ส่งถึงใคร (email), เรื่องอะไร, แล้วก็เนื้อหา\n\nเช่น "ส่งเมล์ถึง john@gmail.com เรื่อง ยืนยันนัด ข้อความว่า ขอยืนยันนัดพรุ่งนี้ 10 โมงครับ"', QUICK_REPLY_MAIN)
          break
        }
        await replyText(replyToken, `กำลังส่งอีเมลถึง ${intent.to} ให้ครับ...`)
        const result = await sendEmail(user.id, intent.to, intent.subject, intent.body)
        await pushText(lineUserId, result)
        break
      }

      case 'list_calendar': {
        if (!await requireGoogle()) break
        const events = await getTodayCalendarEvents(user.id)
        await replyText(replyToken, events, QUICK_REPLY_MAIN)
        break
      }

      case 'upcoming_calendar': {
        if (!await requireGoogle()) break
        const days = intent.days || 7
        const events = await getUpcomingEvents(user.id, days)
        await replyText(replyToken, events, QUICK_REPLY_MAIN)
        break
      }

      case 'add_calendar': {
        if (!await requireGoogle()) break
        if (!intent.title || !intent.date) {
          await replyText(replyToken, 'บอกด้วยนะครับว่าจะนัดเรื่องอะไร วันไหน เวลาอะไร\n\nเช่น "ลงปฏิทิน ประชุมทีม พรุ่งนี้ 10 โมง"', QUICK_REPLY_MAIN)
          break
        }
        const result = await addCalendarEvent(user.id, intent.title, intent.date, intent.time || null)
        await replyText(replyToken, result, QUICK_REPLY_MAIN)
        break
      }

      case 'delete_calendar': {
        if (!await requireGoogle()) break
        if (!intent.keyword) {
          await replyText(replyToken, 'จะลบนัดหมายอะไรครับ บอกชื่อหรือคำที่เกี่ยวข้องได้เลย', QUICK_REPLY_MAIN)
          break
        }
        const result = await deleteCalendarEvent(user.id, intent.keyword)
        await replyText(replyToken, result, QUICK_REPLY_MAIN)
        break
      }

      case 'list_sheets': {
        if (!await requireGoogle()) break
        await replyText(replyToken, 'กำลังดึงรายชื่อ Sheets ให้ครับ รอแป๊บนึง...')
        const list = await listDriveSheets(user.id)
        await pushText(lineUserId, list)
        break
      }

      case 'read_sheet': {
        if (!await requireGoogle()) break
        if (!intent.spreadsheetId) {
          await replyText(replyToken, 'บอก Sheet ID ด้วยนะครับ หาได้จาก URL ของ Sheet\n\nเช่น "อ่าน sheet 1BxiMVs0XRA5..."', QUICK_REPLY_MAIN)
          break
        }
        await replyText(replyToken, 'กำลังอ่าน Sheet ให้ครับ รอสักครู่...')
        const data = await readSheet(user.id, intent.spreadsheetId)
        await pushText(lineUserId, `📊 ข้อมูลจาก Sheet\n\n${data}`)
        break
      }

      case 'create_sheet': {
        if (!await requireGoogle()) break
        const title = intent.title || `Sheet ${dayjs().format('DD/MM/YYYY')}`
        await replyText(replyToken, `กำลังสร้าง Sheet "${title}" ให้ครับ รอสักครู่...`)
        const result = await createSheet(user.id, title)
        if (!result) {
          await pushText(lineUserId, 'สร้าง Sheet ไม่ได้ครับ ลองใหม่อีกครั้งนะครับ')
        } else {
          await pushText(lineUserId, `✅ สร้าง Sheet สำเร็จแล้วครับ\n\n📊 "${result.title}"\n\n${result.url}`)
        }
        break
      }

      case 'add_sheet_row': {
        if (!await requireGoogle()) break
        if (!intent.spreadsheetId || !intent.values) {
          await replyText(replyToken, 'บอก Sheet ID และข้อมูลที่จะเพิ่มด้วยครับ\n\nเช่น "เพิ่มข้อมูลใน sheet [ID] ว่า ชื่อ, ราคา, วันที่"', QUICK_REPLY_MAIN)
          break
        }
        const result = await addSheetRow(user.id, intent.spreadsheetId, intent.values)
        await replyText(replyToken, result, QUICK_REPLY_MAIN)
        break
      }

      case 'summarize': {
        await handleSummarizeText(replyToken, text, user)
        break
      }

      case 'chat': {
        const today = dayjs().format('YYYY-MM-DD')
        const { data: tasks } = await supabase
          .from('tasks').select('title')
          .eq('user_id', user.id).eq('status', 'pending').eq('due_date', today).limit(5)
        const reply = await generateChatReply(text, tasks || [])
        await replyText(replyToken, reply, QUICK_REPLY_MAIN)
        break
      }

      default: {
        const reply = await handleIntent(intent, user)
        const qr = intent.intent === 'list_tasks' ? QUICK_REPLY_AFTER_LIST : QUICK_REPLY_MAIN
        await replyText(replyToken, reply, qr)
      }
    }
  } catch (err) {
    console.error('handleMessageEvent error:', err)
    await replyText(replyToken, 'ขออภัยครับ เกิดข้อผิดพลาด ลองใหม่อีกครั้งนะครับ')
  }
}

async function handleImageEvent(event) {
  const lineUserId = event.source.userId
  const replyToken = event.replyToken

  try {
    const user = await getOrCreateUser(lineUserId)
    const quota = await checkQuota(user, 'summarize')

    if (!quota.allowed) {
      await replyText(replyToken,
        `ใช้ครบ ${quota.limit} ครั้ง/เดือนแล้วครับ\n\nอัปเกรดเป็น Pro เพื่อสรุปไม่จำกัด 499฿/เดือน`,
        QUICK_REPLY_MAIN)
      return
    }

    await replyText(replyToken, 'กำลังอ่านและสรุปภาพให้ครับ รอสักครู่...')

    const stream = await client.getMessageContent(event.message.id)
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    const imageBase64 = Buffer.concat(chunks).toString('base64')

    const summary = await summarizeImage(imageBase64, 'image/jpeg')
    await recordUsage(user, 'summarize')

    const remaining = quota.limit - quota.used - 1
    const quotaNote = user.plan === 'free'
      ? `\n\n📊 เหลือ ${remaining} ครั้งในเดือนนี้ครับ`
      : ''

    await replyText(replyToken, `📄 สรุปเอกสาร\n\n${summary}${quotaNote}`, QUICK_REPLY_MAIN)
  } catch (err) {
    console.error('handleImageEvent error:', err)
    await replyText(replyToken, 'ขออภัยครับ อ่านภาพไม่ได้ ลองใหม่อีกครั้งนะครับ')
  }
}

async function handleFileEvent(event) {
  const lineUserId = event.source.userId
  const replyToken = event.replyToken
  const fileName = event.message.fileName || ''
  const fileSize = event.message.fileSize || 0
  const ext = fileName.split('.').pop().toLowerCase()
  const supported = ['pdf', 'txt']

  if (!supported.includes(ext)) {
    await replyText(replyToken,
      `ขออภัยครับ รองรับเฉพาะไฟล์ PDF และ .txt\nไฟล์ .docx ยังไม่รองรับในตอนนี้ครับ`,
      QUICK_REPLY_MAIN)
    return
  }

  if (fileSize > 10 * 1024 * 1024) {
    await replyText(replyToken, 'ไฟล์ใหญ่เกิน 10MB ครับ ลองส่งไฟล์เล็กกว่านี้ได้เลย', QUICK_REPLY_MAIN)
    return
  }

  try {
    const user = await getOrCreateUser(lineUserId)
    const quota = await checkQuota(user, 'summarize')

    if (!quota.allowed) {
      await replyText(replyToken,
        `ใช้ครบ ${quota.limit} ครั้ง/เดือนแล้วครับ\n\nอัปเกรดเป็น Pro เพื่อสรุปไม่จำกัด 499฿/เดือน`,
        QUICK_REPLY_MAIN)
      return
    }

    // ใช้ replyToken ครั้งเดียวสำหรับ "กำลังอ่าน..." แล้วใช้ pushText สำหรับผลลัพธ์
    await replyText(replyToken, `กำลังอ่านไฟล์ ${fileName} ให้ครับ รอสักครู่...`)

    const stream = await client.getMessageContent(event.message.id)
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    const fileBuffer = Buffer.concat(chunks)

    let summary
    if (ext === 'txt') {
      summary = await summarizeText(fileBuffer.toString('utf-8'))
    } else {
      const { summarizeFile } = require('../services/gemini')
      summary = await summarizeFile(fileBuffer.toString('base64'), 'application/pdf')
    }

    await recordUsage(user, 'summarize')

    const remaining = quota.limit - quota.used - 1
    const quotaNote = user.plan === 'free'
      ? `\n\n📊 เหลือ ${remaining} ครั้งในเดือนนี้ครับ`
      : ''

    // pushText เพราะ replyToken ถูกใช้ไปแล้ว
    await pushText(lineUserId, `📄 สรุป ${fileName}\n\n${summary}${quotaNote}`)
  } catch (err) {
    console.error('handleFileEvent error:', err)
    await pushText(lineUserId, 'ขออภัยครับ อ่านไฟล์ไม่ได้ ลองใหม่อีกครั้งนะครับ')
  }
}

async function handleSummarizeText(replyToken, text, user) {
  const quota = await checkQuota(user, 'summarize')

  if (!quota.allowed) {
    await replyText(replyToken,
      `ใช้ครบ ${quota.limit} ครั้ง/เดือนแล้วครับ\n\nอัปเกรดเป็น Pro เพื่อสรุปไม่จำกัด 499฿/เดือน`,
      QUICK_REPLY_MAIN)
    return
  }

  const summary = await summarizeText(text)
  await recordUsage(user, 'summarize')

  const remaining = quota.limit - quota.used - 1
  const quotaNote = user.plan === 'free'
    ? `\n\n📊 เหลือ ${remaining} ครั้งในเดือนนี้ครับ`
    : ''

  await replyText(replyToken, `📄 สรุปให้แล้วครับ\n\n${summary}${quotaNote}`, QUICK_REPLY_MAIN)
}

module.exports = router
