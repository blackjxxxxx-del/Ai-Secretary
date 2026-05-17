const Stripe = require('stripe')
const { createClient } = require('@supabase/supabase-js')

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

export const config = { api: { bodyParser: false } }

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const rawBody = await getRawBody(req)
  const sig = req.headers['stripe-signature']

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return res.status(400).json({ error: `Webhook error: ${err.message}` })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const lineUserId = session.metadata?.lineUserId
    if (lineUserId) {
      await supabase
        .from('users')
        .update({ plan: 'pro', plan_expires_at: null })
        .eq('line_user_id', lineUserId)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object
    const lineUserId = sub.metadata?.lineUserId
    if (lineUserId) {
      await supabase
        .from('users')
        .update({ plan: 'free' })
        .eq('line_user_id', lineUserId)
    }
  }

  res.json({ received: true })
}
