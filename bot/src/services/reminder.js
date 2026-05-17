const { supabase } = require('../db/supabase')

async function createReminder(taskId, userId, remindAt) {
  const { error } = await supabase.from('reminders').insert({
    task_id: taskId,
    user_id: userId,
    remind_at: remindAt,
  })
  if (error) throw error
}

module.exports = { createReminder }
