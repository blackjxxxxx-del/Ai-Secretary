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

async function createSheet(userId, title) {
  const auth = await getAuthClient(userId)
  if (!auth) return null

  const sheets = google.sheets({ version: 'v4', auth })
  const res = await sheets.spreadsheets.create({
    requestBody: { properties: { title } },
  })

  const url = `https://docs.google.com/spreadsheets/d/${res.data.spreadsheetId}/edit`
  return { id: res.data.spreadsheetId, url, title }
}

async function addSheetRow(userId, spreadsheetId, values) {
  const auth = await getAuthClient(userId)
  if (!auth) return null

  const sheets = google.sheets({ version: 'v4', auth })
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Sheet1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  })

  return `✅ เพิ่มข้อมูลลง Sheet แล้วครับ`
}

async function updateSheetCell(userId, spreadsheetId, range, value) {
  const auth = await getAuthClient(userId)
  if (!auth) return null

  const sheets = google.sheets({ version: 'v4', auth })
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  })

  return `✅ อัปเดต ${range} เรียบร้อยแล้วครับ`
}

async function listDriveSheets(userId) {
  const auth = await getAuthClient(userId)
  if (!auth) return null

  const drive = google.drive({ version: 'v3', auth })
  const res = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    fields: 'files(id, name)',
    orderBy: 'modifiedTime desc',
    pageSize: 8,
  })

  if (!res.data.files?.length) return 'ไม่พบ Google Sheets ในบัญชีของคุณครับ'

  const list = res.data.files.map((f, i) => `${i + 1}. ${f.name}\n   ID: ${f.id}`)
  return `📊 Google Sheets ล่าสุด\n\n${list.join('\n\n')}`
}

async function getUpcomingEvents(userId, days = 7) {
  const auth = await getAuthClient(userId)
  if (!auth) return null

  const calendar = google.calendar({ version: 'v3', auth })
  const now = new Date()
  const future = new Date(now)
  future.setDate(future.getDate() + days)

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 20,
  })

  if (!res.data.items?.length) return `ไม่มีนัดหมายใน ${days} วันข้างหน้าครับ`

  const grouped = {}
  for (const e of res.data.items) {
    const date = e.start.date || e.start.dateTime?.split('T')[0]
    if (!grouped[date]) grouped[date] = []
    const time = e.start.dateTime
      ? new Date(e.start.dateTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      : 'ทั้งวัน'
    grouped[date].push(`  • ${e.summary} (${time})`)
  }

  const lines = Object.entries(grouped).map(([date, events]) => {
    const d = new Date(date + 'T00:00:00')
    const label = d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })
    return `📅 ${label}\n${events.join('\n')}`
  })

  return `นัดหมาย ${days} วันข้างหน้า\n\n${lines.join('\n\n')}`
}

async function deleteCalendarEvent(userId, keyword) {
  const auth = await getAuthClient(userId)
  if (!auth) return null

  const calendar = google.calendar({ version: 'v3', auth })
  const now = new Date()
  const future = new Date(now)
  future.setDate(future.getDate() + 60)

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    singleEvents: true,
    q: keyword,
    maxResults: 5,
  })

  if (!res.data.items?.length) return `ไม่พบนัดหมายที่มีคำว่า "${keyword}" ครับ`

  const event = res.data.items[0]
  await calendar.events.delete({ calendarId: 'primary', eventId: event.id })
  return `✅ ลบนัดหมาย "${event.summary}" เรียบร้อยแล้วครับ`
}

async function sendEmail(userId, to, subject, body) {
  const auth = await getAuthClient(userId)
  if (!auth) return null

  const gmail = google.gmail({ version: 'v1', auth })

  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`
  const rawBody = Buffer.from(body).toString('base64')
  const messageParts = [
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    rawBody,
  ]
  const raw = Buffer.from(messageParts.join('\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
  return `✅ ส่งอีเมลถึง ${to}\nเรื่อง: "${subject}"\nเรียบร้อยแล้วครับ`
}

module.exports = {
  getTokens, getAuthClient, getOAuth2Client,
  getEmailSummary, getTodayCalendarEvents, getUpcomingEvents,
  addCalendarEvent, deleteCalendarEvent,
  readSheet, createSheet, addSheetRow, updateSheetCell, listDriveSheets,
  sendEmail,
}
