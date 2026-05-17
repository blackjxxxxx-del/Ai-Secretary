import Head from 'next/head'
import { useRouter } from 'next/router'

export default function ConnectGoogle() {
  const router = useRouter()
  const { uid } = router.query

  async function handleConnect() {
    if (!uid) {
      alert('ไม่พบ LINE User ID กรุณาเปิดลิงก์นี้จากในแชท LINE ครับ')
      return
    }
    window.location.href = `/api/google-auth?uid=${uid}`
  }

  return (
    <>
      <Head>
        <title>เชื่อม Google - AI Secretary</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main style={{ fontFamily: "'Sarabun', sans-serif", background: '#f9fafb', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#fff', borderRadius: 24, padding: '48px 40px', maxWidth: 440, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🔗</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 8px', color: '#111' }}>เชื่อม Google Account</h1>
          <p style={{ color: '#666', fontSize: 15, margin: '0 0 32px', lineHeight: 1.6 }}>
            เพื่อให้ AI Secretary ช่วยจัดการ Gmail, Google Calendar และ Google Sheets ได้
          </p>

          <div style={{ background: '#f8fafc', borderRadius: 14, padding: '20px', marginBottom: 28, textAlign: 'left' }}>
            {[
              { icon: '📧', text: 'อ่านและสรุปอีเมล' },
              { icon: '📅', text: 'ดูและเพิ่มนัดหมายใน Google Calendar' },
              { icon: '📊', text: 'อ่านข้อมูลจาก Google Sheets' },
            ].map(f => (
              <p key={f.text} style={{ margin: '8px 0', fontSize: 15, color: '#444' }}>{f.icon} {f.text}</p>
            ))}
          </div>

          <button
            onClick={handleConnect}
            style={{
              width: '100%', padding: '14px', borderRadius: 14, border: 'none',
              background: '#4285f4', color: '#fff', fontWeight: 700,
              fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 10
            }}
          >
            <span>G</span> เชื่อมต่อ Google Account
          </button>

          <p style={{ marginTop: 16, fontSize: 12, color: '#999', lineHeight: 1.5 }}>
            AI Secretary จะขอสิทธิ์อ่าน Gmail, Calendar และ Sheets เท่านั้น ไม่มีการลบข้อมูล
          </p>

          <a href="/" style={{ display: 'block', marginTop: 16, color: '#06C755', fontSize: 14, textDecoration: 'none' }}>
            ← กลับหน้าหลัก
          </a>
        </div>
      </main>
    </>
  )
}
