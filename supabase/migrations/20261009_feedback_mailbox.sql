-- MedQNL feedback/mailbox compatibility migration.
-- The project already contains public.profiles and public.feedback.
-- This migration extends those existing tables without replacing them.

create extension if not exists pgcrypto;

alter table public.feedback
  add column if not exists student_name text,
  add column if not exists student_email text,
  add column if not exists status text,
  add column if not exists response text not null default '',
  add column if not exists responded_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.feedback f
set
  status = coalesce(f.status, case when f.handled then 'resolved' else 'open' end),
  student_name = coalesce(f.student_name, p.name, 'Student'),
  student_email = coalesce(f.student_email, p.email)
from public.profiles p
where p.id = f.user_id;

alter table public.feedback
  alter column status set default 'open';

alter table public.feedback
  alter column status set not null;

do $$
begin
  alter table public.feedback
    add constraint feedback_status_check
    check (status in ('open','resolved'));
exception
  when duplicate_object then null;
end $$;

create index if not exists feedback_student_id_idx on public.feedback(user_id);
create index if not exists feedback_status_idx on public.feedback(status);
create index if not exists feedback_updated_at_idx on public.feedback(updated_at desc);

create or replace function public.touch_feedback_fields()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.handled = (new.status = 'resolved');
  if new.status = 'resolved'
     and (old.status is distinct from 'resolved' or old.response is distinct from new.response) then
    new.responded_at = coalesce(new.responded_at, now());
  elsif new.status = 'open' and old.status is distinct from 'open' then
    new.responded_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists feedback_updated_at on public.feedback;
create trigger feedback_updated_at
before update on public.feedback
for each row execute function public.touch_feedback_fields();

drop policy if exists "feedback_insert" on public.feedback;
create policy "feedback_insert"
on public.feedback
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "feedback_select_own" on public.feedback;
create policy "feedback_select_own"
on public.feedback
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "feedback_select_admin" on public.feedback;
create policy "feedback_select_admin"
on public.feedback
for select
to authenticated
using (is_admin());

drop policy if exists "feedback_update_admin" on public.feedback;
create policy "feedback_update_admin"
on public.feedback
for update
to authenticated
using (is_admin())
with check (is_admin());
