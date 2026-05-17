const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function getOrCreateUser(lineUserId) {
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('line_user_id', lineUserId)
    .single()

  if (existing) return existing

  const { data: newUser, error } = await supabase
    .from('users')
    .insert({ line_user_id: lineUserId })
    .select()
    .single()

  if (error) throw error
  return newUser
}

module.exports = { supabase, getOrCreateUser }
