const { Client } = require('@line/bot-sdk')

const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
})

const QUICK_REPLY_MAIN = {
  items: [
    { type: 'action', action: { type: 'message', label: '📋 งานวันนี้', text: 'วันนี้มีอะไรบ้าง' } },
    { type: 'action', action: { type: 'message', label: '📊 งานทั้งหมด', text: 'ดูงานทั้งหมด' } },
    { type: 'action', action: { type: 'message', label: '✅ ทำเสร็จ', text: 'เสร็จแล้ว ' } },
  ],
}

const QUICK_REPLY_AFTER_LIST = {
  items: [
    { type: 'action', action: { type: 'message', label: '✅ ทำเสร็จ', text: 'เสร็จแล้ว ' } },
    { type: 'action', action: { type: 'message', label: '➕ เพิ่มงาน', text: 'เพิ่มงาน ' } },
    { type: 'action', action: { type: 'message', label: '🗑 ลบงาน', text: 'ลบงาน ' } },
  ],
}

function stripMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold** → bold
    .replace(/\*(.+?)\*/g, '$1')        // *italic* → italic
    .replace(/^[\*\-] /gm, '• ')        // * หรือ - bullet → •
    .replace(/^#{1,6} /gm, '')          // ## heading → ไม่มี #
    .replace(/__(.+?)__/g, '$1')        // __bold__ → bold
    .replace(/_(.+?)_/g, '$1')          // _italic_ → italic
    .trim()
}

async function replyText(replyToken, text, quickReply = null) {
  const message = { type: 'text', text: stripMarkdown(text) }
  if (quickReply) message.quickReply = quickReply
  return client.replyMessage(replyToken, message)
}

async function pushText(lineUserId, text) {
  return client.pushMessage(lineUserId, { type: 'text', text: stripMarkdown(text) })
}

module.exports = { replyText, pushText, QUICK_REPLY_MAIN, QUICK_REPLY_AFTER_LIST }
