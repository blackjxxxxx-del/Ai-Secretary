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

    const upgradeKeywords = ['อัปเกรด', 'อัพเกรด', 'อัพเพลน', 'อัปเพลน', 'upgrade', 'สมัคร pro', 'ซื้อ pro', 'pro plan', 'แพลน pro', 'plan pro', 'ใช้โปร', 'สมัครโปร']
    if (upgradeKeywords.some(k => text.toLowerCase().includes(k.toLowerCase()))) {
      const webUrl = process.env.WEB_URL || 'https://your-web-url.railway.app'
      const upgradeUrl = `${webUrl}/upgrade?uid=${lineUserId}`
      await replyText(replyToken,
        `อัปเกรดเป็น Pro 499฿/เดือน\n\nคลิกลิงก์นี้เพื่อชำระเงินครับ:\n${upgradeUrl}\n\nได้รับ: สรุปเอกสารไม่จำกัด + ทุกฟีเจอร์ครบ`,
        QUICK_REPLY_MAIN)
      return
    }

    // Google reconnect — ส่งลิงก์เสมอแม้จะมี token แล้ว
    const reconnectKeywords = ['เชื่อมใหม่', 'reconnect google', 'เชื่อม google ใหม่', 'ต่อ google ใหม่', 'อัปเดต google']
    if (reconnectKeywords.some(k => text.toLowerCase().includes(k.toLowerCase()))) {
      const webUrl = process.env.WEB_URL || 'https://your-web-url.railway.app'
      await replyText(replyToken, `กดลิงก์นี้เพื่อเชื่อม Google ใหม่ครับ (จะได้รับสิทธิ์ล่าสุดทั้งหมด):\n\n${webUrl}/connect-google?uid=${lineUserId}`, QUICK_REPLY_MAIN)
      return
    }

    // Google connect / status check
    const connectGoogleKeywords = ['เชื่อม google', 'connect google', 'ลิงก์ google', 'เชื่อมต่อ google', 'เชื่อม gmail']
    const googleStatusKeywords = ['เชื่อมสำเร็จมั้ย', 'เชื่อมแล้วยัง', 'google เชื่อมแล้วมั้ย', 'เชื่อมได้มั้ย', 'google ใช้งานได้มั้ย', 'เชื่อมสำเร็จไหม', 'เชื่อมแล้วไหม', 'ใช้ google ได้มั้ย']
    const isGoogleConnect = connectGoogleKeywords.some(k => text.toLowerCase().includes(k.toLowerCase()))
    const isGoogleStatus = googleStatusKeywords.some(k => text.toLowerCase().includes(k.toLowerCase()))
    if (isGoogleConnect || isGoogleStatus) {
      const webUrl = process.env.WEB_URL || 'https://your-web-url.railway.app'
      const tokens = await getTokens(user.id)
      if (tokens) {
        await replyText(replyToken, 'เชื่อม Google แล้วครับ ลองพิมพ์ได้เลย\n\n• "สรุปอีเมล" — ดูอีเมลล่าสุด\n• "ดู Calendar" — ดูนัดหมายวันนี้\n• "ส่งเมล์ถึง..." — ส่งอีเมล\n• "มีชีตอะไรบ้าง" — ลิสต์ Sheets\n\nถ้าต้องการอัปเดตสิทธิ์ พิมพ์ "เชื่อมใหม่" ครับ', QUICK_REPLY_MAIN)
      } else {
        await replyText(replyToken, `ยังไม่ได้เชื่อม Google ครับ กดลิงก์นี้เพื่อเชื่อมต่อ:\n\n${webUrl}/connect-google?uid=${lineUserId}`, QUICK_REPLY_MAIN)
      }
      return
    }

    // Google Gmail
    const emailKeywords = ['สรุปอีเมล', 'อีเมลวันนี้', 'อ่านอีเมล', 'มีอีเมลอะไร', 'เช็คอีเมล', 'ดูอีเมล']
    if (emailKeywords.some(k => text.includes(k))) {
      const tokens = await getTokens(user.id)
      if (!tokens) {
        const webUrl = process.env.WEB_URL || 'https://your-web-url.railway.app'
        await replyText(replyToken, `ยังไม่ได้เชื่อม Google ครับ กดลิงก์นี้เพื่อเชื่อมต่อ:\n${webUrl}/connect-google?uid=${lineUserId}`, QUICK_REPLY_MAIN)
        return
      }
      await replyText(replyToken, 'กำลังดึงอีเมลให้ครับ รอสักครู่...')
      const summary = await getEmailSummary(user.id)
      await pushText(lineUserId, summary)
      return
    }

    // Google Calendar
    const calendarKeywords = ['ดู calendar', 'google calendar', 'นัดหมาย google', 'ตาราง google', 'cal วันนี้']
    if (calendarKeywords.some(k => text.toLowerCase().includes(k.toLowerCase()))) {
      const tokens = await getTokens(user.id)
      if (!tokens) {
        const webUrl = process.env.WEB_URL || 'https://your-web-url.railway.app'
        await replyText(replyToken, `ยังไม่ได้เชื่อม Google ครับ กดลิงก์นี้เพื่อเชื่อมต่อ:\n${webUrl}/connect-google?uid=${lineUserId}`, QUICK_REPLY_MAIN)
        return
      }
      const events = await getTodayCalendarEvents(user.id)
      await replyText(replyToken, events, QUICK_REPLY_MAIN)
      return
    }

    // Google Sheets create
    const sheetCreateMatch = text.match(/สร้าง\s*(ชีต|sheet)\s*(.+)?/i) || text.match(/สร้าง\s*(.+)\s*(ชีต|sheet)/i)
    if (sheetCreateMatch) {
      const tokens = await getTokens(user.id)
      if (!tokens) {
        const webUrl = process.env.WEB_URL || 'https://your-web-url.railway.app'
        await replyText(replyToken, `ยังไม่ได้เชื่อม Google ครับ:\n${webUrl}/connect-google?uid=${lineUserId}`, QUICK_REPLY_MAIN)
        return
      }
      const rawTitle = sheetCreateMatch[2] || sheetCreateMatch[1] || ''
      const isKeyword = ['ชีต', 'sheet', 'ใหม่', 'new'].includes(rawTitle.trim().toLowerCase())
      const sheetTitle = (!rawTitle.trim() || isKeyword)
        ? `Sheet ${dayjs().format('DD/MM/YYYY')}`
        : rawTitle.trim()
      await replyText(replyToken, `กำลังสร้าง Sheet "${sheetTitle}" ให้ครับ รอสักครู่...`)
      const result = await createSheet(user.id, sheetTitle)
      if (!result) {
        await pushText(lineUserId, 'สร้าง Sheet ไม่ได้ครับ ลองเชื่อม Google ใหม่อีกครั้งนะครับ')
      } else {
        await pushText(lineUserId, `✅ สร้าง Sheet สำเร็จแล้วครับ\n\n📊 "${result.title}"\n\n${result.url}`)
      }
      return
    }

    // Google Sheets — อ่าน sheet [id]
    const sheetMatch = text.match(/ดู\s*sheet[s]?\s+([a-zA-Z0-9_-]{20,})/i)
    if (sheetMatch) {
      const tokens = await getTokens(user.id)
      if (!tokens) {
        const webUrl = process.env.WEB_URL || 'https://your-web-url.railway.app'
        await replyText(replyToken, `ยังไม่ได้เชื่อม Google ครับ:\n${webUrl}/connect-google?uid=${lineUserId}`, QUICK_REPLY_MAIN)
        return
      }
      await replyText(replyToken, 'กำลังอ่าน Sheet ให้ครับ รอสักครู่...')
      const data = await readSheet(user.id, sheetMatch[1])
      await pushText(lineUserId, `📊 ข้อมูลจาก Sheet\n\n${data}`)
      return
    }

    // Google Sheets — ลิสต์ชีตทั้งหมด
    const listSheetKeywords = ['ดูชีตทั้งหมด', 'ชีตที่มี', 'รายชื่อ sheet', 'sheet ทั้งหมด', 'มีชีตอะไรบ้าง', 'ชีตมีอะไรบ้าง', 'ชีต ทั้งหมด', 'ดูชีต', 'list sheet', 'sheets ทั้งหมด', 'ชีตอะไรบ้าง']
    if (listSheetKeywords.some(k => text.toLowerCase().includes(k.toLowerCase())) || /ชีต.{0,5}(มี|อะไร|ทั้งหมด)/i.test(text)) {
      const tokens = await getTokens(user.id)
      if (!tokens) {
        const webUrl = process.env.WEB_URL || 'https://your-web-url.railway.app'
        await replyText(replyToken, `ยังไม่ได้เชื่อม Google ครับ:\n${webUrl}/connect-google?uid=${lineUserId}`, QUICK_REPLY_MAIN)
        return
      }
      await replyText(replyToken, 'กำลังดึงรายชื่อ Sheets ให้ครับ รอสักครู่...')
      const list = await listDriveSheets(user.id)
      await pushText(lineUserId, list)
      return
    }

    // Google Calendar — ดูนัดหมายล่วงหน้า
    const upcomingKeywords = ['นัดหมายสัปดาห์นี้', 'นัดหน้า', 'calendar อาทิตย์นี้', 'ตารางสัปดาห์นี้', 'นัดหมาย 7 วัน', 'นัดหมายล่วงหน้า', 'ตาราง 7 วัน']
    if (upcomingKeywords.some(k => text.toLowerCase().includes(k.toLowerCase()))) {
      const tokens = await getTokens(user.id)
      if (!tokens) {
        const webUrl = process.env.WEB_URL || 'https://your-web-url.railway.app'
        await replyText(replyToken, `ยังไม่ได้เชื่อม Google ครับ:\n${webUrl}/connect-google?uid=${lineUserId}`, QUICK_REPLY_MAIN)
        return
      }
      const events = await getUpcomingEvents(user.id, 7)
      await replyText(replyToken, events, QUICK_REPLY_MAIN)
      return
    }

    // Google Calendar — ลบนัดหมาย
    const deleteCalMatch = text.match(/(?:ลบ|ยกเลิก)\s*(?:นัด|นัดหมาย|ปฏิทิน|calendar)\s*(.+)/i)
    if (deleteCalMatch) {
      const tokens = await getTokens(user.id)
      if (!tokens) {
        const webUrl = process.env.WEB_URL || 'https://your-web-url.railway.app'
        await replyText(replyToken, `ยังไม่ได้เชื่อม Google ครับ:\n${webUrl}/connect-google?uid=${lineUserId}`, QUICK_REPLY_MAIN)
        return
      }
      const result = await deleteCalendarEvent(user.id, deleteCalMatch[1].trim())
      await replyText(replyToken, result, QUICK_REPLY_MAIN)
      return
    }

    const intent = await analyzeMessage(text)

    // send_email intent
    if (intent.intent === 'send_email') {
      const tokens = await getTokens(user.id)
      if (!tokens) {
        const webUrl = process.env.WEB_URL || 'https://your-web-url.railway.app'
        await replyText(replyToken, `ยังไม่ได้เชื่อม Google ครับ:\n${webUrl}/connect-google?uid=${lineUserId}`, QUICK_REPLY_MAIN)
        return
      }
      if (!intent.to || !intent.subject || !intent.body) {
        await replyText(replyToken, 'กรุณาระบุให้ครบครับ: ถึงใคร (email), เรื่องอะไร, และเนื้อหา\n\nตัวอย่าง: "ส่งเมล์ถึง john@gmail.com เรื่อง ยืนยันนัด เนื้อหา สวัสดีครับ ขอยืนยันนัดพรุ่งนี้ 10 โมงครับ"', QUICK_REPLY_MAIN)
        return
      }
      await replyText(replyToken, `กำลังส่งอีเมลถึง ${intent.to} ให้ครับ...`)
      const result = await sendEmail(user.id, intent.to, intent.subject, intent.body)
      await pushText(lineUserId, result)
      return
    }

    // add_sheet_row intent
    if (intent.intent === 'add_sheet_row') {
      const tokens = await getTokens(user.id)
      if (!tokens) {
        const webUrl = process.env.WEB_URL || 'https://your-web-url.railway.app'
        await replyText(replyToken, `ยังไม่ได้เชื่อม Google ครับ:\n${webUrl}/connect-google?uid=${lineUserId}`, QUICK_REPLY_MAIN)
        return
      }
      if (!intent.spreadsheetId || !intent.values) {
        await replyText(replyToken, 'กรุณาระบุ Sheet ID และข้อมูลที่จะเพิ่มครับ\n\nตัวอย่าง: "เพิ่มข้อมูลลง sheet [ID] ว่า ชื่อ, อายุ, เบอร์"', QUICK_REPLY_MAIN)
        return
      }
      const result = await addSheetRow(user.id, intent.spreadsheetId, intent.values)
      await replyText(replyToken, result, QUICK_REPLY_MAIN)
      return
    }

    if (intent.intent === 'chat') {
      const today = dayjs().format('YYYY-MM-DD')
      const { data: tasks } = await supabase
        .from('tasks').select('title')
        .eq('user_id', user.id).eq('status', 'pending').eq('due_date', today).limit(5)
      const reply = await generateChatReply(text, tasks || [])
      await replyText(replyToken, reply, QUICK_REPLY_MAIN)
      return
    }

    if (intent.intent === 'summarize') {
      await handleSummarizeText(replyToken, text, user)
      return
    }

    const reply = await handleIntent(intent, user)
    const qr = intent.intent === 'list_tasks' ? QUICK_REPLY_AFTER_LIST : QUICK_REPLY_MAIN
    await replyText(replyToken, reply, qr)
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
