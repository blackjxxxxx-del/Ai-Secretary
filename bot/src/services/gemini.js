const { GoogleGenerativeAI } = require('@google/generative-ai')
const dayjs = require('dayjs')

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

const SYSTEM_PROMPT = `คุณคือ AI เลขาส่วนตัว วิเคราะห์ข้อความภาษาไทยและแปลงเป็น JSON

วันที่วันนี้: {TODAY}

ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น

intent ที่รองรับ:
- create_task: สร้างงาน/task ใหม่
- list_tasks: ดูรายการงาน
- done_task: ทำงานเสร็จแล้ว
- brain_dump: บอกหลายงานพร้อมกัน
- delete_task: ลบงาน
- list_emails: ดู/อ่าน/เช็คอีเมล
- send_email: ส่งอีเมล
- list_calendar: ดูนัดหมายวันนี้
- upcoming_calendar: ดูนัดหมายล่วงหน้า/สัปดาห์นี้/หลายวัน
- add_calendar: เพิ่มนัดหมายใน Google Calendar (ต่างจาก create_task)
- delete_calendar: ลบ/ยกเลิกนัดหมาย
- list_sheets: ดูรายชื่อ/ลิสต์ Google Sheets ทั้งหมด
- read_sheet: อ่านข้อมูลจาก Sheet ที่ระบุ ID
- create_sheet: สร้าง Google Sheet ใหม่
- add_sheet_row: เพิ่มข้อมูลแถวใหม่ใน Sheet
- connect_google: เชื่อม/ตรวจสอบ/อัปเดตการเชื่อม Google Account
- chat: คุยทั่วไป ถามตอบ ระบาย ถามเกี่ยวกับความสามารถของบอท
- summarize: สรุปเอกสาร/ข้อความยาว (>200 คำ)
- unknown: ไม่เข้าใจจริงๆ

ตัวอย่าง output:

create_task: {"intent":"create_task","task":"โทรหาลูกค้า","date":"2026-05-18","time":"10:00"}
list_tasks: {"intent":"list_tasks","filter":"today"}
done_task: {"intent":"done_task","keyword":"meeting"}
brain_dump: {"intent":"brain_dump","tasks":[{"task":"ส่งรายงาน","date":"2026-05-18","time":null}]}
delete_task: {"intent":"delete_task","scope":"single","keyword":"ประชุม"}
delete_task all: {"intent":"delete_task","scope":"all"}

list_emails: {"intent":"list_emails"}
send_email: {"intent":"send_email","to":"someone@gmail.com","subject":"หัวข้อ","body":"เนื้อหา"}

list_calendar: {"intent":"list_calendar"}
upcoming_calendar: {"intent":"upcoming_calendar","days":7}
add_calendar: {"intent":"add_calendar","title":"ประชุมทีม","date":"2026-05-18","time":"10:00"}
delete_calendar: {"intent":"delete_calendar","keyword":"ประชุม"}

list_sheets: {"intent":"list_sheets"}
read_sheet: {"intent":"read_sheet","spreadsheetId":"1BxiMVs0XRA5..."}
create_sheet: {"intent":"create_sheet","title":"บัญชีรายจ่าย"}
add_sheet_row: {"intent":"add_sheet_row","spreadsheetId":"1BxiMVs0XRA5...","values":["ข้อมูล1","ข้อมูล2"]}

connect_google: {"intent":"connect_google","action":"status"}
connect_google reconnect: {"intent":"connect_google","action":"reconnect"}

chat (ตอบในช่อง reply ด้วยเลย อย่าให้ว่าง):
{"intent":"chat","reply":"ข้อความตอบกลับแบบเพื่อนสนิท ภาษาไทย เป็นธรรมชาติ ไม่ทางการ"}

summarize: {"intent":"summarize"}
unknown: {"intent":"unknown"}

กฎสำคัญ:
- date format YYYY-MM-DD, time format HH:mm (24hr), null ถ้าไม่มี
- "พรุ่งนี้" = วันถัดไป, "เช้า"=09:00, "สาย"=10:00, "บ่าย"=13:00, "เย็น"=17:00, "ค่ำ"=19:00
- add_calendar ใช้เมื่อ user พูดถึง Google Calendar โดยตรง หรือบอกให้ลงปฏิทิน Google
- create_task ใช้เมื่อ user บอกให้จดงาน/เพิ่มงานทั่วไป
- คำถามเกี่ยวกับความสามารถบอท ให้เป็น chat เสมอ
- ข้อความสั้นๆ ทักทาย ระบาย ให้เป็น chat
- สำหรับ chat: ตอบเหมือนเพื่อนสนิท อ่านอารมณ์ ความยาวเหมาะสม`

const CHAT_PROMPT = `คุณคือ "เลขา" — AI ที่ฉลาด เข้าใจบริบท และคุยเป็นธรรมชาติมาก

สิ่งที่คุณทำได้และรู้จริงๆ:
- จัดการ task: เพิ่ม ดู ลบ ทำเสร็จ
- แจ้งเตือนอัตโนมัติก่อนถึงกำหนด
- สรุปเอกสาร รูปภาพ PDF ข้อความยาว
- เชื่อม Google: Gmail, Calendar, Sheets
- สรุปอีเมล ดูนัดหมายวันนี้ อ่าน Sheets
- คุยทั่วไป ตอบคำถาม ให้กำลังใจ

วิธีตอบ:
- พูดภาษาไทยแบบเพื่อน ไม่ต้องลง "ครับ" ทุกประโยค
- อ่านอารมณ์จากข้อความ แล้วตอบให้เข้ากัน
- ถ้าเหนื่อยหรือเครียด รับฟังก่อน ไม่ต้องรีบแก้ปัญหา
- ถ้าถามเรื่อง feature ของตัวเอง ตอบตรงๆ ว่าทำได้หรือไม่ได้
- ถ้าไม่รู้บางเรื่อง บอกตรงๆ ไม่ต้องแต่งขึ้น
- ห้ามตอบแบบ bullet list ทุกครั้ง ให้ดูเป็นการสนทนาจริงๆ
- ความยาวให้เหมาะสถานการณ์ บางทีประโยคเดียวพอ

งาน user วันนี้: {TASKS}

user พิมพ์: "{MESSAGE}"

ตอบเหมือนคนจริงๆ คิดแล้วตอบ ไม่ใช่แค่ fill template`

async function callWithRetry(fn, retries = 3, delayMs = 16000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      const is429 = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('Too Many Requests')
      if (is429 && i < retries - 1) {
        console.log(`Gemini rate limit, retrying in ${delayMs / 1000}s...`)
        await new Promise(r => setTimeout(r, delayMs))
        delayMs *= 1.5
      } else {
        throw err
      }
    }
  }
}

async function analyzeMessage(text) {
  const today = dayjs().format('YYYY-MM-DD')
  const prompt = SYSTEM_PROMPT.replace('{TODAY}', today) + `\n\nข้อความ: "${text}"`

  const result = await callWithRetry(() => model.generateContent(prompt))
  const raw = result.response.text().trim()

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return { intent: 'unknown' }

  try {
    return JSON.parse(jsonMatch[0])
  } catch {
    return { intent: 'unknown' }
  }
}

async function generateChatReply(message, tasks = []) {
  const taskSummary = tasks.length > 0
    ? tasks.slice(0, 5).map(t => t.title).join(', ')
    : 'ยังไม่มีงาน'

  const prompt = CHAT_PROMPT
    .replace('{TASKS}', taskSummary)
    .replace('{MESSAGE}', message)

  const result = await callWithRetry(() => model.generateContent(prompt))
  return result.response.text().trim()
}

async function analyzeDeadlines(text, tasks) {
  const today = dayjs().format('YYYY-MM-DD')
  const taskList = tasks.map((t, i) => `${i + 1}. ${t.task}`).join('\n')

  const prompt = `วันที่วันนี้: ${today}

รายการงาน:
${taskList}

User บอกกำหนดเวลาว่า: "${text}"

แปลงเป็น JSON array โดยระบุว่างานหมายเลขไหนมีกำหนดเวลาอะไร
ตอบเป็น JSON เท่านั้น format: [{"index": 0, "date": "YYYY-MM-DD", "time": "HH:mm"}]
index เริ่มที่ 0 ถ้างานไหนไม่มีกำหนดเวลาไม่ต้องใส่
date และ time ใช้ null ถ้าไม่มี`

  const result = await model.generateContent(prompt)
  const raw = result.response.text().trim()

  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []

  try {
    return JSON.parse(jsonMatch[0])
  } catch {
    return []
  }
}

async function summarizeFile(base64Data, mimeType) {
  const result = await model.generateContent([
    { text: 'อ่านและสรุปเนื้อหาในไฟล์นี้เป็นภาษาไทย กระชับ ชัดเจน แบ่งเป็นหัวข้อถ้าเหมาะสม ไม่เกิน 200 คำ' },
    { inlineData: { data: base64Data, mimeType } },
  ])
  return result.response.text().trim()
}

async function summarizeText(text) {
  const prompt = `สรุปข้อความต่อไปนี้เป็นภาษาไทย กระชับ ชัดเจน แบ่งเป็นหัวข้อถ้าเหมาะสม ไม่เกิน 200 คำ:\n\n${text}`
  const result = await model.generateContent(prompt)
  return result.response.text().trim()
}

async function summarizeImage(imageData, mimeType) {
  const result = await model.generateContent([
    { text: 'อ่านและสรุปเนื้อหาในภาพนี้เป็นภาษาไทย กระชับ ชัดเจน แบ่งเป็นหัวข้อถ้าเหมาะสม ไม่เกิน 200 คำ' },
    { inlineData: { data: imageData, mimeType } },
  ])
  return result.response.text().trim()
}

module.exports = { analyzeMessage, generateChatReply, analyzeDeadlines, summarizeText, summarizeImage, summarizeFile }
