const cron = require('node-cron')
const { supabase } = require('../db/supabase')
const { pushText } = require('../services/line')
const dayjs = require('dayjs')

async function runWeeklySummary() {
  const weekStart = dayjs().subtract(7, 'day').format('YYYY-MM-DD')
  const today = dayjs().format('YYYY-MM-DD')

  const { data: users } = await supabase.from('users').select('id, line_user_id')
  if (!users) return

  for (const user of users) {
    // งานที่ทำเสร็จในสัปดาห์ที่ผ่านมา
    const { data: doneTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .gte('due_date', weekStart)
      .lt('due_date', today)

    // งานที่ยังค้างอยู่
    const { data: pendingTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('due_date', { ascending: true })

    if (!doneTasks?.length && !pendingTasks?.length) continue

    let message = `📊 สรุปประจำสัปดาห์ครับ\n`
    message += `(${dayjs().subtract(7,'day').format('D MMM')} - ${dayjs().format('D MMM')})\n`

    if (doneTasks?.length) {
      message += `\n✅ ทำเสร็จแล้ว ${doneTasks.length} งาน\n`
      doneTasks.forEach((t) => { message += `• ${t.title}\n` })
    }

    if (pendingTasks?.length) {
      message += `\n⏳ ยังค้างอยู่ ${pendingTasks.length} งาน\n`
      pendingTasks.slice(0, 5).forEach((t) => {
        const date = t.due_date ? ` (${dayjs(t.due_date).format('D MMM')})` : ''
        message += `• ${t.title}${date}\n`
      })
      if (pendingTasks.length > 5) {
        message += `• และอีก ${pendingTasks.length - 5} งาน...\n`
      }
    }

    message += `\nสัปดาห์นี้สู้ต่อนะครับ! 💪`
    await pushText(user.line_user_id, message)
  }
}

function startWeeklySummaryJob() {
  // ทุกวันจันทร์ 07:00
  cron.schedule('0 7 * * 1', runWeeklySummary, { timezone: 'Asia/Bangkok' })
  console.log('Weekly summary job started (Monday 07:00 Bangkok)')
}

module.exports = { startWeeklySummaryJob }
