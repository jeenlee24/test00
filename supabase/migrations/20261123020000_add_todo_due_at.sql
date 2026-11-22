-- 할 일의 일정(날짜·시간). 추가 날짜(created_at)와는 별개이며, 없으면 null.
alter table public.todos
  add column if not exists due_at timestamptz;

create index if not exists todos_due_at_idx on public.todos(due_at);
