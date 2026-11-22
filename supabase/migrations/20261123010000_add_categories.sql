-- 카테고리 테이블
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 30),
  created_at timestamptz not null default now()
);

-- todos 와 같은 방식: RLS 켜고 정책 없음 → 서버(secret 키)만 접근 가능
alter table public.categories enable row level security;

-- 할 일 → 카테고리 연결. 카테고리를 삭제하면 해당 할 일은 '카테고리 없음'이 됩니다.
alter table public.todos
  add column if not exists category_id uuid references public.categories(id) on delete set null;

create index if not exists todos_category_id_idx on public.todos(category_id);
