import Head from 'next/head'

export default function GoogleSuccess() {
  return (
    <>
      <Head>
        <title>เชื่อม Google สำเร็จ - AI Secretary</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main style={{ fontFamily: "'Sarabun', sans-serif", background: '#f0fdf4', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#fff', borderRadius: 24, padding: '48px 40px', maxWidth: 400, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 12px', color: '#111' }}>เชื่อม Google สำเร็จ!</h1>
          <p style={{ color: '#666', fontSize: 15, margin: '0 0 28px', lineHeight: 1.6 }}>
            ตอนนี้ AI Secretary สามารถช่วยจัดการ Gmail, Calendar และ Sheets ได้แล้วครับ
          </p>
          <div style={{ background: '#f0fdf4', borderRadius: 12, padding: 16, marginBottom: 24, textAlign: 'left' }}>
            <p style={{ margin: '4px 0', fontSize: 14, color: '#166534' }}>💬 ลองพิมพ์ใน LINE:</p>
            <p style={{ margin: '6px 0', fontSize: 14, color: '#166534' }}>• "สรุปอีเมลวันนี้"</p>
            <p style={{ margin: '6px 0', fontSize: 14, color: '#166534' }}>• "ดู Google Calendar"</p>
            <p style={{ margin: '6px 0', fontSize: 14, color: '#166534' }}>• "เพิ่มประชุมลง Calendar พรุ่งนี้ 10 โมง"</p>
          </div>
          <a href="https://line.me" style={{ display: 'block', padding: '14px', borderRadius: 14, background: '#06C755', color: '#fff', fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
            กลับไปที่ LINE
          </a>
        </div>
      </main>
    </>
  )
}
