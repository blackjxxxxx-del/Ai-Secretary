import Head from 'next/head'

export default function Success() {
  return (
    <>
      <Head>
        <title>ชำระเงินสำเร็จ - AI Secretary</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main style={{ fontFamily: "'Sarabun', sans-serif", background: '#f0fdf4', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#fff', borderRadius: 24, padding: '48px 40px', maxWidth: 400, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 12px', color: '#111' }}>ยินดีด้วยครับ!</h1>
          <p style={{ color: '#666', fontSize: 16, margin: '0 0 8px', lineHeight: 1.6 }}>
            คุณเป็นสมาชิก <strong style={{ color: '#06C755' }}>Pro</strong> แล้ว
          </p>
          <p style={{ color: '#666', fontSize: 15, margin: '0 0 32px', lineHeight: 1.6 }}>
            กลับไปที่ LINE แล้วลองสรุปเอกสารได้เลยครับ ✨
          </p>
          <a
            href="https://line.me"
            style={{
              display: 'block', padding: '14px', borderRadius: 14,
              background: '#06C755', color: '#fff', fontWeight: 700,
              fontSize: 16, textDecoration: 'none'
            }}
          >
            กลับไปที่ LINE
          </a>
          <a href="/" style={{ display: 'block', marginTop: 16, color: '#06C755', fontSize: 14, textDecoration: 'none' }}>
            ← หน้าหลัก
          </a>
        </div>
      </main>
    </>
  )
}
