# LINE AI Secretary

AI เลขาส่วนตัวใน LINE

## โครงสร้างโปรเจกต์

```
line-ai-secretary/
├── bot/          # LINE Bot (Node.js + Express)
├── web/          # หน้าเว็บ (Next.js) - Landing + Upgrade
└── supabase/     # Database schema
```

## เริ่มต้นใช้งาน

### 1. ตั้งค่า Database
รัน `supabase/schema.sql` ใน Supabase SQL Editor

### 2. ตั้งค่า Bot
```bash
cd bot
cp .env.example .env
# กรอก API keys ใน .env
npm install
npm run dev
```

### 3. ตั้งค่า LINE Webhook
- ไปที่ LINE Developers Console
- ตั้ง Webhook URL เป็น `https://your-domain.com/webhook`

## Environment Variables (bot)

| ตัวแปร | ได้จากไหน |
|--------|----------|
| LINE_CHANNEL_SECRET | LINE Developers Console |
| LINE_CHANNEL_ACCESS_TOKEN | LINE Developers Console |
| GEMINI_API_KEY | Google AI Studio |
| SUPABASE_URL | Supabase Project Settings |
| SUPABASE_SERVICE_KEY | Supabase Project Settings → Service Role |
