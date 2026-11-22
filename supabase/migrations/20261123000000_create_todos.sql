-- 할 일 테이블
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 1 and 200),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS 활성화 + 정책 없음:
-- 브라우저용 공개 키(anon/publishable)로는 이 테이블에 접근할 수 없고,
-- 서버(Flask)가 가진 secret 키로만 읽고 쓸 수 있습니다.
alter table public.todos enable row level security;
