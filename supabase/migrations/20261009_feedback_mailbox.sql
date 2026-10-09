create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email,''),'@',1))
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  student_email text,
  student_name text,
  question_id text,
  question_title text,
  category text not null default 'Overig',
  message text not null,
  status text not null default 'open' check (status in ('open','resolved')),
  response text not null default '',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feedback_student_id_idx on public.feedback(student_id);
create index if not exists feedback_status_idx on public.feedback(status);
create index if not exists feedback_updated_at_idx on public.feedback(updated_at desc);

create or replace function public.touch_feedback_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists feedback_updated_at on public.feedback;
create trigger feedback_updated_at
before update on public.feedback
for each row execute procedure public.touch_feedback_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.feedback enable row level security;

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "feedback students read own" on public.feedback;
create policy "feedback students read own"
on public.feedback for select
to authenticated
using (student_id = auth.uid() or public.is_admin());

drop policy if exists "feedback students insert own" on public.feedback;
create policy "feedback students insert own"
on public.feedback for insert
to authenticated
with check (student_id = auth.uid());

drop policy if exists "feedback admin update" on public.feedback;
create policy "feedback admin update"
on public.feedback for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "feedback admin delete" on public.feedback;
create policy "feedback admin delete"
on public.feedback for delete
to authenticated
using (public.is_admin());

-- Promote an account to admin after creating it in Supabase Auth:
-- update public.profiles set role='admin' where email='jouw-admin-email@voorbeeld.nl';