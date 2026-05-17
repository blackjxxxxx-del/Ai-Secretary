const { supabase } = require('../db/supabase')
const dayjs = require('dayjs')

const LIMITS = {
  free: 3,
  pro: Infinity,
}

async function checkQuota(user, feature) {
  const limit = LIMITS[user.plan] ?? LIMITS.free
  if (limit === Infinity) return { allowed: true, used: 0, limit }

  const monthStart = dayjs().startOf('month').toISOString()

  const { count } = await supabase
    .from('usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('feature', feature)
    .gte('used_at', monthStart)

  const used = count || 0
  return { allowed: used < limit, used, limit }
}

async function recordUsage(user, feature) {
  await supabase.from('usage_logs').insert({
    user_id: user.id,
    feature,
  })
}

module.exports = { checkQuota, recordUsage }
