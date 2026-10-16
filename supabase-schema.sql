-- Chạy trong Supabase SQL Editor.
create table if not exists public.mt5_market_latest (
  symbol text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

-- Không tạo policy public. API server dùng secret/service-role key; không đưa key này vào trình duyệt.
alter table public.mt5_market_latest enable row level security;
