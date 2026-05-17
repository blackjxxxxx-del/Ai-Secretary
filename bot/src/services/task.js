const { supabase } = require('../db/supabase')
const { createReminder } = require('./reminder')
const { analyzeDeadlines } = require('./gemini')
const dayjs = require('dayjs')

// เก็บ state ของ user ที่รอตอบ deadline (in-memory)
const pendingStates = new Map()

async function handleIntent(intent, user) {
  switch (intent.intent) {
    case 'create_task':
      return createTask(intent, user)
    case 'list_tasks':
      return listTasks(intent, user)
    case 'done_task':
      return markDone(intent, user)
    case 'brain_dump':
      return brainDump(intent, user)
    case 'delete_task':
      return deleteTask(intent, user)
    default:
      return 'พิมพ์งานที่ต้องทำได้เลยครับ เช่น "พรุ่งนี้ประชุม 10 โมง" หรือ "วันนี้มีอะไรบ้าง"'
  }
}

async function handlePendingDeadline(text, user) {
  const state = pendingStates.get(user.id)
  if (!state) return null

  pendingStates.delete(user.id)

  if (text.trim() === 'ไม่มี') {
    return 'โอเค บันทึกไว้โดยไม่มีกำหนดเวลาครับ'
  }

  // ให้ Gemini แปลงคำตอบ deadline กลับมา
  const deadlines = await analyzeDeadlines(text, state.tasks)

  let updated = 0
  for (const d of deadlines) {
    const task = state.tasks[d.index]
    const taskRecord = state.taskRecords[d.index]
    if (!task || !taskRecord) continue
    if (!d.date && !d.time) continue

    await supabase.from('tasks').update({
      due_date: d.date || null,
      due_time: d.time || null,
    }).eq('id', taskRecord.id)

    if (d.date && d.time) {
      const remindAt = dayjs(`${d.date} ${d.time}`).subtract(15, 'minute').toISOString()
      await createReminder(taskRecord.id, user.id, remindAt)
    }
    updated++
  }

  if (updated === 0) return 'ไม่พบกำหนดเวลาครับ งานยังอยู่ในระบบนะครับ'

  return `อัปเดต ${updated} งานแล้วครับ จะเตือนก่อนถึงเวลา 15 นาทีครับ`
}

async function createTask(intent, user) {
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      user_id: user.id,
      title: intent.task,
      due_date: intent.date || null,
      due_time: intent.time || null,
    })
    .select()
    .single()

  if (error) throw error

  if (intent.date && intent.time) {
    const remindAt = dayjs(`${intent.date} ${intent.time}`).subtract(15, 'minute').toISOString()
    await createReminder(task.id, user.id, remindAt)
    const timeDisplay = dayjs(`${intent.date} ${intent.time}`).format('D MMM HH:mm')
    return `โอเค บันทึกแล้วครับ\n✅ ${intent.task}\n🕐 ${timeDisplay}\n\nจะเตือน 15 นาทีก่อนถึงเวลาครับ`
  }

  if (intent.date) {
    return `โอเค บันทึกแล้วครับ\n✅ ${intent.task}\n📅 ${dayjs(intent.date).format('D MMM')}`
  }

  return `โอเค บันทึกแล้วครับ\n✅ ${intent.task}`
}

async function listTasks(intent, user) {
  const today = dayjs().format('YYYY-MM-DD')
  const filter = intent.filter || 'today'

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('due_time', { ascending: true, nullsFirst: false })

  if (filter === 'today') {
    query = query.eq('due_date', today)
  }

  const { data: tasks } = await query

  if (!tasks || tasks.length === 0) {
    return filter === 'today'
      ? 'วันนี้ไม่มีงานค้างอยู่ครับ 🎉'
      : 'ไม่มีงานค้างอยู่ครับ 🎉'
  }

  const now = dayjs()
  const lines = tasks.map((t, i) => {
    let icon = '📌'
    let urgency = ''

    if (t.due_date && t.due_time) {
      const deadline = dayjs(`${t.due_date} ${t.due_time}`)
      const diffMin = deadline.diff(now, 'minute')
      if (diffMin < 0) {
        icon = '🔴'
        urgency = ' (เลยเวลาแล้ว!)'
      } else if (diffMin <= 60) {
        icon = '🔴'
        urgency = ` (อีก ${diffMin} นาที!)`
      } else if (diffMin <= 180) {
        icon = '🟡'
        urgency = ` (อีก ${Math.round(diffMin / 60)} ชั่วโมง)`
      } else {
        icon = '🟢'
      }
    }

    const time = t.due_time ? ` ${t.due_time.slice(0, 5)}` : ''
    const date = t.due_date && t.due_date !== today
      ? ` ${dayjs(t.due_date).format('D MMM')}` : ''

    return `${icon} ${t.title}${date}${time}${urgency}`
  })

  const label = filter === 'today' ? 'วันนี้' : 'ทั้งหมด'
  return `งาน${label} ${tasks.length} อย่างครับ\n\n${lines.join('\n')}`
}

async function markDone(intent, user) {
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .ilike('title', `%${intent.keyword}%`)
    .limit(1)

  if (!tasks || tasks.length === 0) {
    return `หางานที่มีคำว่า "${intent.keyword}" ไม่เจอครับ`
  }

  const task = tasks[0]
  await supabase.from('tasks').update({ status: 'done' }).eq('id', task.id)

  return `เยี่ยมครับ ✅ "${task.title}" เสร็จแล้ว!`
}

async function deleteTask(intent, user) {
  if (intent.scope === 'no_time') {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .is('due_time', null)

    if (!tasks || tasks.length === 0) return 'ไม่มีงานที่ไม่มีกำหนดเวลาครับ'

    const ids = tasks.map((t) => t.id)
    await supabase.from('tasks').delete().in('id', ids)
    return `ลบ ${tasks.length} งานที่ไม่มีกำหนดเวลาแล้วครับ`
  }

  if (intent.scope === 'all') {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')

    if (!tasks || tasks.length === 0) return 'ไม่มีงานค้างอยู่ครับ'

    const ids = tasks.map((t) => t.id)
    await supabase.from('tasks').delete().in('id', ids)
    return `ลบทั้งหมด ${tasks.length} งานแล้วครับ`
  }

  if (intent.scope === 'single' && intent.keyword) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .ilike('title', `%${intent.keyword}%`)

    if (!tasks || tasks.length === 0) {
      return `หางานที่มีคำว่า "${intent.keyword}" ไม่เจอครับ`
    }

    const ids = tasks.map((t) => t.id)
    await supabase.from('tasks').delete().in('id', ids)

    if (tasks.length === 1) return `ลบ "${tasks[0].title}" แล้วครับ`
    return `ลบ ${tasks.length} งานที่มีคำว่า "${intent.keyword}" แล้วครับ`
  }

  return 'บอกชื่องานที่อยากลบได้เลยครับ เช่น "ลบงาน ประชุม"'
}

async function brainDump(intent, user) {
  if (!intent.tasks || intent.tasks.length === 0) {
    return 'ไม่พบงานในข้อความครับ ลองพิมพ์ใหม่นะครับ'
  }

  const inserts = intent.tasks.map((t) => ({
    user_id: user.id,
    title: t.task,
    due_date: t.date || null,
    due_time: t.time || null,
  }))

  const { data: taskRecords } = await supabase
    .from('tasks')
    .insert(inserts)
    .select()

  const lines = intent.tasks.map((t, i) => `${i + 1}. ${t.task}`)
  const summary = `บันทึก ${intent.tasks.length} งานเรียบร้อยครับ\n\n${lines.join('\n')}`

  // งานที่ยังไม่มีเวลา (time = null) ให้ถามกลับเสมอ
  const noTime = intent.tasks.filter((t) => !t.time)

  if (noTime.length > 0) {
    pendingStates.set(user.id, {
      tasks: intent.tasks,
      taskRecords: taskRecords || [],
      step: 'awaiting_deadlines',
    })

    return `${summary}\n\nงานไหนมีกำหนดเวลาบ้างครับ?\nเช่น "1. พรุ่งนี้ 10 โมง, 3. วันศุกร์ บ่าย 2"\nหรือพิมพ์ "ไม่มี" ถ้าไม่มีกำหนดครับ`
  }

  return summary
}

module.exports = { handleIntent, handlePendingDeadline, pendingStates }
