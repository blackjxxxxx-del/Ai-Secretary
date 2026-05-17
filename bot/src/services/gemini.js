const { GoogleGenerativeAI } = require('@google/generative-ai')
const dayjs = require('dayjs')

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

const SYSTEM_PROMPT = `คุณคือ AI เลขาส่วนตัว วิเคราะห์ข้อความภาษาไทยและแปลงเป็น JSON

วันที่วันนี้: {TODAY}

ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น

intent ที่รองรับ:
- create_task: สร้าง task ใหม่
- list_tasks: ดูรายการงาน
- done_task: ทำเสร็จแล้ว
- brain_dump: พิมพ์มั่วๆ หลาย task
- delete_task: ลบงาน
- send_email: ส่งอีเมล
- add_sheet_row: เพิ่มข้อมูลแถวใหม่ใน Sheet
- chat: คุยทั่วไป ถามตอบ หรือข้อความที่ไม่เกี่ยวกับ task
- summarize: ขอให้สรุปเอกสารหรือข้อความ หรือข้อความที่ยาวมาก (>200 คำ)
- unknown: ไม่เข้าใจ

ตัวอย่าง output:

create_task:
{"intent":"create_task","task":"โทรหาลูกค้า","date":"2026-05-18","time":"10:00"}

list_tasks:
{"intent":"list_tasks","filter":"today"}

done_task:
{"intent":"done_task","keyword":"meeting"}

brain_dump:
{"intent":"brain_dump","tasks":[{"task":"ส่งรายงาน","date":"2026-05-18","time":null},{"task":"โทรหาพี่เอก","date":null,"time":null}]}

delete_task (ลบงานที่ระบุชื่อ):
{"intent":"delete_task","scope":"single","keyword":"ประชุม"}

delete_task (ลบงานที่ไม่มีกำหนดเวลา):
{"intent":"delete_task","scope":"no_time"}

delete_task (ลบทั้งหมด):
{"intent":"delete_task","scope":"all"}

send_email (ส่งอีเมล ต้องระบุ to, subject, body):
{"intent":"send_email","to":"someone@gmail.com","subject":"หัวข้ออีเมล","body":"เนื้อหาอีเมล"}

add_sheet_row (เพิ่มข้อมูลลง Sheet ระบุ spreadsheetId และ values เป็น array):
{"intent":"add_sheet_row","spreadsheetId":"1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms","values":["ข้อมูล1","ข้อมูล2","ข้อมูล3"]}

chat (คุยทั่วไป ระบาย ถามอะไรก็ได้):
{"intent":"chat","message":"เหนื่อยมากเลยวันนี้"}

summarize (ขอสรุปเอกสาร หรือ paste ข้อความยาวมาก):
{"intent":"summarize"}

unknown:
{"intent":"unknown"}

กฎ:
- date ใช้ format YYYY-MM-DD เสมอ
- time ใช้ format HH:mm เสมอ (24 ชั่วโมง)
- ถ้าไม่มีวันที่หรือเวลา ให้ใส่ null
- "พรุ่งนี้" = วันถัดไปจากวันนี้
- "เช้า" = 09:00, "สาย" = 10:00, "บ่าย" = 13:00, "เย็น" = 17:00, "ค่ำ" = 19:00
- เลขที่มี "โมง" หรือ "นาฬิกา" = เวลา
- ข้อความทักทาย/ระบาย/ถามทั่วไป ให้เป็น chat
- ประโยคที่มีคำถามว่า "ได้มั้ย" "ทำได้มั้ย" "ช่วยได้มั้ย" "รองรับมั้ย" ให้เป็น chat เสมอ
- "สร้าง" ที่ไม่ใช่งาน เช่น "สร้างชีต" "สร้างปฏิทิน" ให้เป็น chat`

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

async function analyzeMessage(text) {
  const today = dayjs().format('YYYY-MM-DD')
  const prompt = SYSTEM_PROMPT.replace('{TODAY}', today) + `\n\nข้อความ: "${text}"`

  const result = await model.generateContent(prompt)
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

  const result = await model.generateContent(prompt)
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
