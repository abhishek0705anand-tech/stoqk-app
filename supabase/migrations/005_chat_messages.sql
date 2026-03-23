CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  message     TEXT NOT NULL,
  plain       TEXT,
  deeper      TEXT,
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'error')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx ON public.chat_messages (user_id, created_at DESC);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
-- Service role bypasses RLS; anon/user reads via API (we use service key on backend)
