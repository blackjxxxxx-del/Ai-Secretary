import Head from 'next/head'
import { useState } from 'react'
import { useRouter } from 'next/router'

export default function Upgrade() {
  const router = useRouter()
  const { uid } = router.query
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCheckout() {
    if (!uid) {
      setError('ไม่พบ LINE User ID กรุณาเปิดลิงก์นี้จากในแชท LINE ครับ')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: uid }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้งครับ')
        setLoading(false)
      }
    } catch {
      setError('เกิดข้อผิดพลาด ลองใหม่อีกครั้งครับ')
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>อัปเกรด Pro - AI Secretary</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main style={{ fontFamily: "'Sarabun', sans-serif", background: '#f9fafb', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#fff', borderRadius: 24, padding: '48px 40px', maxWidth: 480, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.08)', textAlign: 'center' }}>

          <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', color: '#111' }}>อัปเกรดเป็น Pro</h1>
          <p style={{ color: '#666', fontSize: 16, margin: '0 0 32px' }}>ปลดล็อคทุกฟีเจอร์ ไม่จำกัด</p>

          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: '24px', marginBottom: 32, textAlign: 'left' }}>
            {[
              'สรุปเอกสาร PDF และรูปภาพ ไม่จำกัด',
              'จัดการงานไม่จำกัด',
              'แจ้งเตือนอัตโนมัติ',
              'สรุปงานทุกเช้า / ทุกอาทิตย์',
              'Priority support',
            ].map(f => (
              <p key={f} style={{ margin: '6px 0', fontSize: 15, color: '#166534' }}>✅ {f}</p>
            ))}
          </div>

          <div style={{ marginBottom: 28 }}>
            <span style={{ fontSize: 42, fontWeight: 800, color: '#06C755' }}>499฿</span>
            <span style={{ fontSize: 18, color: '#666' }}> / เดือน</span>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', marginBottom: 20, color: '#dc2626', fontSize: 14 }}>
              {error}
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={loading}
            style={{
              width: '100%', padding: '16px', borderRadius: 14, border: 'none',
              background: loading ? '#a7f3d0' : '#06C755', color: '#fff',
              fontWeight: 700, fontSize: 18, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s'
            }}
          >
            {loading ? 'กำลังเปิดหน้าชำระเงิน...' : '💳 ชำระเงินด้วย Stripe'}
          </button>

          <p style={{ marginTop: 16, fontSize: 13, color: '#999' }}>
            ชำระเงินปลอดภัยผ่าน Stripe · ยกเลิกได้ทุกเมื่อ
          </p>

          <a href="/" style={{ display: 'block', marginTop: 20, color: '#06C755', fontSize: 14, textDecoration: 'none' }}>
            ← กลับหน้าหลัก
          </a>
        </div>
      </main>
    </>
  )
}
