const cron = require('node-cron')
const { supabase } = require('../db/supabase')
const { pushText } = require('../services/line')
const dayjs = require('dayjs')

async function runDailySummary() {
  const today = dayjs().format('YYYY-MM-DD')

  const { data: users } = await supabase.from('users').select('id, line_user_id')
  if (!users) return

  for (const user of users) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .eq('due_date', today)
      .order('due_time', { ascending: true })

    if (!tasks || tasks.length === 0) continue

    const lines = tasks.map((t, i) => {
      const time = t.due_time ? ` 🕐 ${t.due_time.slice(0, 5)}` : ''
      return `${i + 1}. ${t.title}${time}`
    })

    const message = `🌅 สวัสดีตอนเช้าครับ!\n\nวันนี้มีงาน ${tasks.length} อย่าง:\n\n${lines.join('\n')}`
    await pushText(user.line_user_id, message)
  }
}

function startJobs() {
  // ส่ง daily summary ทุกวัน 07:00 (Asia/Bangkok)
  cron.schedule('0 7 * * *', runDailySummary, { timezone: 'Asia/Bangkok' })
  console.log('Daily summary job started (07:00 Bangkok)')
}

module.exports = { startJobs }
