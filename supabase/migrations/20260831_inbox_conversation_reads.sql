create table if not exists public.inbox_conversation_reads (
  conversation_key text primary key,
  read_through timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.inbox_conversation_reads enable row level security;

drop policy if exists "Inbox read states are readable" on public.inbox_conversation_reads;
create policy "Inbox read states are readable"
  on public.inbox_conversation_reads for select
  to anon, authenticated
  using (true);

drop policy if exists "Inbox read states are writable" on public.inbox_conversation_reads;
create policy "Inbox read states are writable"
  on public.inbox_conversation_reads for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Inbox read states are updateable" on public.inbox_conversation_reads;
create policy "Inbox read states are updateable"
  on public.inbox_conversation_reads for update
  to anon, authenticated
  using (true)
  with check (true);

grant select, insert, update on public.inbox_conversation_reads to anon, authenticated;
