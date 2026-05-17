-- ============================================================
-- LINE AI Secretary - Supabase Schema
-- ============================================================

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id TEXT UNIQUE NOT NULL,
  display_name TEXT,
  plan TEXT NOT NULL DEFAULT 'free',         -- free | plus | pro
  plan_expires_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Bangkok',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  due_time TIME,
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | done | cancelled
  priority TEXT NOT NULL DEFAULT 'normal',   -- low | normal | high
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reminders
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  remind_at TIMESTAMPTZ NOT NULL,
  sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subscriptions (สำหรับ web upgrade flow)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  plan TEXT NOT NULL,                        -- plus | pro
  status TEXT NOT NULL DEFAULT 'active',     -- active | cancelled | past_due
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Memories (placeholder สำหรับ V2)
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Usage Logs (quota tracking)
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,              -- 'summarize'
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_reminders_remind_at ON reminders(remind_at);
CREATE INDEX idx_reminders_sent ON reminders(sent);
CREATE INDEX idx_reminders_user_id ON reminders(user_id);
