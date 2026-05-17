import Head from 'next/head'

const LINE_ADD_FRIEND_URL = process.env.NEXT_PUBLIC_LINE_ADD_FRIEND_URL || 'https://line.me/add-friend'

export default function Home() {
  return (
    <>
      <Head>
        <title>AI Secretary - เลขา AI ส่วนตัวใน LINE</title>
        <meta name="description" content="จัดการงาน สรุปเอกสาร แจ้งเตือน ด้วย AI ใน LINE" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main style={{ fontFamily: "'Sarabun', sans-serif", background: '#f9fafb', minHeight: '100vh' }}>

        {/* Hero */}
        <section style={{ background: 'linear-gradient(135deg, #06C755 0%, #00a040 100%)', color: '#fff', padding: '80px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🤖</div>
          <h1 style={{ fontSize: 36, fontWeight: 700, margin: '0 0 12px' }}>AI Secretary</h1>
          <p style={{ fontSize: 20, opacity: 0.9, margin: '0 0 32px' }}>เลขา AI ส่วนตัวของคุณใน LINE</p>
          <p style={{ fontSize: 16, opacity: 0.8, maxWidth: 480, margin: '0 auto 40px' }}>
            พิมพ์ภาษาไทยธรรมดา บอทจัดการงาน สรุปเอกสาร และแจ้งเตือนให้อัตโนมัติ
          </p>
          <a
            href={LINE_ADD_FRIEND_URL}
            style={{
              display: 'inline-block', background: '#fff', color: '#06C755',
              fontWeight: 700, fontSize: 18, padding: '14px 36px', borderRadius: 50,
              textDecoration: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
            }}
          >
            เพิ่มเพื่อนใน LINE ฟรี
          </a>
        </section>

        {/* Features */}
        <section style={{ maxWidth: 800, margin: '0 auto', padding: '64px 20px' }}>
          <h2 style={{ textAlign: 'center', fontSize: 28, fontWeight: 700, marginBottom: 48, color: '#111' }}>ทำอะไรได้บ้าง?</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
            {[
              { icon: '📋', title: 'จัดการงาน', desc: 'เพิ่ม ดู ทำเสร็จ ลบงาน ด้วยภาษาไทยธรรมดา' },
              { icon: '⏰', title: 'แจ้งเตือนอัตโนมัติ', desc: 'ส่งเตือนก่อนถึงกำหนดงาน ไม่มีลืม' },
              { icon: '📄', title: 'สรุปเอกสาร', desc: 'ส่งรูป PDF หรือข้อความยาว บอทสรุปให้ทันที' },
              { icon: '💬', title: 'คุยได้ทุกเรื่อง', desc: 'ถามอะไรก็ได้ บอทตอบเป็นภาษาไทยเสมอ' },
              { icon: '🌅', title: 'สรุปงานทุกเช้า', desc: 'รับสรุปงานวันนี้ตอน 7 โมงเช้าทุกวัน' },
              { icon: '📊', title: 'สรุปงานทุกอาทิตย์', desc: 'สรุปภาพรวมงานทุกวันจันทร์เช้า' },
            ].map(f => (
              <div key={f.title} style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>{f.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px', color: '#111' }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: '#666', margin: 0, lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section style={{ background: '#fff', padding: '64px 20px' }}>
          <h2 style={{ textAlign: 'center', fontSize: 28, fontWeight: 700, marginBottom: 48, color: '#111' }}>แผนราคา</h2>
          <div style={{ display: 'flex', gap: 24, maxWidth: 700, margin: '0 auto', justifyContent: 'center' }}>

            {/* Free */}
            <div style={{ flex: '1 1 0', minWidth: 0, border: '2px solid #e5e7eb', borderRadius: 20, padding: '32px 28px' }}>
              <h3 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: '#111' }}>Free</h3>
              <p style={{ fontSize: 32, fontWeight: 800, color: '#111', margin: '8px 0 24px' }}>0฿</p>
              {['จัดการงานไม่จำกัด', 'แจ้งเตือนอัตโนมัติ', 'สรุปรายวัน/รายอาทิตย์', 'สรุปเอกสาร 3 ครั้ง/เดือน'].map(f => (
                <p key={f} style={{ margin: '8px 0', fontSize: 15, color: '#444' }}>✅ {f}</p>
              ))}
              <a href={LINE_ADD_FRIEND_URL} style={{ display: 'block', textAlign: 'center', marginTop: 28, padding: '12px', borderRadius: 12, background: '#f3f4f6', color: '#111', fontWeight: 600, textDecoration: 'none', fontSize: 15 }}>
                เริ่มใช้ฟรี
              </a>
            </div>

            {/* Pro */}
            <div style={{ flex: '1 1 0', minWidth: 0, border: '2px solid #06C755', borderRadius: 20, padding: '32px 28px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 14, right: -20, background: '#06C755', color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 32px', transform: 'rotate(35deg)' }}>แนะนำ</div>
              <h3 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: '#111' }}>Pro</h3>
              <p style={{ fontSize: 32, fontWeight: 800, color: '#06C755', margin: '8px 0 24px' }}>499฿ <span style={{ fontSize: 16, color: '#666', fontWeight: 400 }}>/เดือน</span></p>
              {['ทุกอย่างใน Free', 'สรุปเอกสารไม่จำกัด', 'รองรับ PDF และรูปภาพ', 'Priority support'].map(f => (
                <p key={f} style={{ margin: '8px 0', fontSize: 15, color: '#444' }}>✅ {f}</p>
              ))}
              <a href="/upgrade" style={{ display: 'block', textAlign: 'center', marginTop: 28, padding: '12px', borderRadius: 12, background: '#06C755', color: '#fff', fontWeight: 700, textDecoration: 'none', fontSize: 15 }}>
                อัปเกรด Pro
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={{ textAlign: 'center', padding: '32px 20px', color: '#999', fontSize: 14 }}>
          <p>© 2025 AI Secretary · <a href="/upgrade" style={{ color: '#06C755' }}>อัปเกรด Pro</a></p>
        </footer>
      </main>
    </>
  )
}
