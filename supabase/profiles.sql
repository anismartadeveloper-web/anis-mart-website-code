-- Jalankan sekali di Supabase SQL Editor.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  email text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  constraint profiles_username_length check (char_length(username) between 3 and 24)
);

create unique index profiles_username_lower_unique on public.profiles (lower(username));

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
begin
  requested_username := pg_catalog.btrim(new.raw_user_meta_data ->> 'username');
  if requested_username is null or pg_catalog.char_length(requested_username) < 3 or pg_catalog.char_length(requested_username) > 24 then
    raise exception 'Username must be between 3 and 24 characters';
  end if;

  insert into public.profiles (id, username, email)
  values (new.id, requested_username, new.email)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_username_available(candidate_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.char_length(pg_catalog.btrim(candidate_username)) between 3 and 24
    and not exists (
      select 1 from public.profiles p
      where pg_catalog.lower(p.username) = pg_catalog.lower(pg_catalog.btrim(candidate_username))
    );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

commit;

-- Menetapkan akun admin:
-- Di Supabase Table Editor > public.profiles, ubah role baris akun yang dituju menjadi 'admin'.
-- Untuk mengubah lewat SQL Editor (ganti email dengan akun yang tepat):
-- update public.profiles set role = 'admin' where email = 'nama@domain.com';
-- Akses UPDATE tidak diberikan kepada role authenticated; perubahan ini hanya oleh operator berhak.
