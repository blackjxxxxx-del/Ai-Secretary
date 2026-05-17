const express = require('express')
const { middleware, Client } = require('@line/bot-sdk')
const https = require('https')
const { analyzeMessage, generateChatReply, summarizeText, summarizeImage } = require('../services/gemini')
const { handleIntent, handlePendingDeadline, pendingStates } = require('../services/task')
const { replyText, pushText, QUICK_REPLY_MAIN, QUICK_REPLY_AFTER_LIST } = require('../services/line')
const { getOrCreateUser, supabase } = require('../db/supabase')
const { checkQuota, recordUsage } = require('../services/quota')
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

    const upgradeKeywords = ['อัปเกรด', 'upgrade', 'สมัคร pro', 'ซื้อ pro', 'pro plan', 'แพลน pro', 'plan pro']
    if (upgradeKeywords.some(k => text.toLowerCase().includes(k.toLowerCase()))) {
      const webUrl = process.env.WEB_URL || 'https://your-web-url.railway.app'
      const upgradeUrl = `${webUrl}/upgrade?uid=${lineUserId}`
      await replyText(replyToken,
        `อัปเกรดเป็น Pro 499฿/เดือน\n\nคลิกลิงก์นี้เพื่อชำระเงินครับ:\n${upgradeUrl}\n\nได้รับ: สรุปเอกสารไม่จำกัด + ทุกฟีเจอร์ครบ`,
        QUICK_REPLY_MAIN)
      return
    }

    const intent = await analyzeMessage(text)

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
