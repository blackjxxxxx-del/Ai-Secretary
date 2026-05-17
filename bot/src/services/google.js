const { google } = require('googleapis')
const { supabase } = require('../db/supabase')

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

async function getTokens(userId) {
  const { data } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data
}

async function getAuthClient(userId) {
  const tokens = await getTokens(userId)
  if (!tokens) return null

  const auth = getOAuth2Client()
  auth.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  })

  auth.on('tokens', async (newTokens) => {
    await supabase.from('google_tokens').update({
      access_token: newTokens.access_token,
      expiry_date: newTokens.expiry_date,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
  })

  return auth
}

async function getEmailSummary(userId) {
  const auth = await getAuthClient(userId)
  if (!auth) return null

  const gmail = google.gmail({ version: 'v1', auth })
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread',
    maxResults: 5,
  })

  if (!res.data.messages?.length) return 'ไม่มีอีเมลที่ยังไม่ได้อ่านครับ'

  const emails = []
  for (const msg of res.data.messages.slice(0, 5)) {
    const detail = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From'],
    })
    const headers = detail.data.payload.headers
    const subject = headers.find(h => h.name === 'Subject')?.value || '(ไม่มีหัวเรื่อง)'
    const from = headers.find(h => h.name === 'From')?.value || 'ไม่ทราบผู้ส่ง'
    emails.push(`• ${subject}\n  จาก: ${from}`)
  }

  const total = res.data.resultSizeEstimate || res.data.messages.length
  return `📧 อีเมลที่ยังไม่ได้อ่าน ${total} ฉบับ\n\n${emails.join('\n\n')}`
}

async function getTodayCalendarEvents(userId) {
  const auth = await getAuthClient(userId)
  if (!auth) return null

  const calendar = google.calendar({ version: 'v3', auth })
  const now = new Date()
  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59)

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  })

  if (!res.data.items?.length) return 'ไม่มีนัดหมายใน Google Calendar วันนี้ครับ'

  const events = res.data.items.map(e => {
    const start = e.start.dateTime
      ? new Date(e.start.dateTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      : 'ทั้งวัน'
    return `• ${e.summary} (${start})`
  })

  return `📅 นัดหมายใน Google Calendar วันนี้\n\n${events.join('\n')}`
}

async function addCalendarEvent(userId, title, dateStr, timeStr) {
  const auth = await getAuthClient(userId)
  if (!auth) return null

  const calendar = google.calendar({ version: 'v3', auth })

  let start, end
  if (timeStr) {
    start = { dateTime: `${dateStr}T${timeStr}:00+07:00`, timeZone: 'Asia/Bangkok' }
    const [h, m] = timeStr.split(':')
    const endHour = String(parseInt(h) + 1).padStart(2, '0')
    end = { dateTime: `${dateStr}T${endHour}:${m}:00+07:00`, timeZone: 'Asia/Bangkok' }
  } else {
    start = { date: dateStr }
    end = { date: dateStr }
  }

  await calendar.events.insert({
    calendarId: 'primary',
    requestBody: { summary: title, start, end },
  })

  return `✅ เพิ่ม "${title}" ลง Google Calendar แล้วครับ`
}

async function readSheet(userId, spreadsheetId, range = 'Sheet1!A1:Z20') {
  const auth = await getAuthClient(userId)
  if (!auth) return null

  const sheets = google.sheets({ version: 'v4', auth })
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range })

  const rows = res.data.values
  if (!rows?.length) return 'ไม่พบข้อมูลใน Sheet ครับ'

  return rows.map(row => row.join(' | ')).join('\n')
}

module.exports = { getTokens, getAuthClient, getOAuth2Client, getEmailSummary, getTodayCalendarEvents, addCalendarEvent, readSheet }
