const cron = require('node-cron')
const { supabase } = require('../db/supabase')
const { pushText } = require('../services/line')
const dayjs = require('dayjs')

async function runReminderCheck() {
  const now = dayjs()
  const from = now.subtract(1, 'minute').toISOString()
  const to = now.toISOString()

  const { data: reminders } = await supabase
    .from('reminders')
    .select('*, tasks(title), users(line_user_id)')
    .eq('sent', false)
    .gte('remind_at', from)
    .lte('remind_at', to)

  if (!reminders || reminders.length === 0) return

  for (const reminder of reminders) {
    const title = reminder.tasks?.title
    const lineUserId = reminder.users?.line_user_id
    if (!lineUserId || !title) continue

    await pushText(lineUserId, `⏰ เตือนความจำครับ\n\n"${title}"\n\nอีก 15 นาทีถึงเวลาแล้ว!`)
    await supabase.from('reminders').update({ sent: true }).eq('id', reminder.id)
  }
}

function startReminderJob() {
  cron.schedule('* * * * *', runReminderCheck)
  console.log('Reminder job started (every minute)')
}

module.exports = { startReminderJob }
