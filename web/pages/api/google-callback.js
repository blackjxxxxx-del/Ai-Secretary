const { google } = require('googleapis')
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

export default async function handler(req, res) {
  const { code, state: lineUserId } = req.query

  if (!code || !lineUserId) {
    return res.redirect('/connect-google?error=missing_params')
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    const { tokens } = await oauth2Client.getToken(code)

    // หา user จาก line_user_id
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('line_user_id', lineUserId)
      .single()

    if (!user) return res.redirect('/connect-google?error=user_not_found')

    // บันทึก tokens
    await supabase.from('google_tokens').upsert({
      user_id: user.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    res.redirect('/google-success')
  } catch (err) {
    console.error('Google callback error:', err)
    res.redirect('/connect-google?error=auth_failed')
  }
}
