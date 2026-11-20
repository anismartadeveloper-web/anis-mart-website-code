-- Anis Mart account profile, privacy, and avatar storage migration.
-- Safe to run after the existing supabase/profiles.sql schema.
-- The profiles.username column already exists; this adds the requested profile fields
-- without replacing or deleting existing account data.

begin;

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists birth_date date,
  add column if not exists avatar_url text;

update public.profiles
set display_name = left(coalesce(nullif(btrim(display_name), ''), nullif(btrim(username), ''), split_part(email, '@', 1)), 30)
where display_name is null or btrim(display_name) = '';

do $migration$
declare
  profile_row record;
  candidate text;
  base_name text;
  suffix integer;
begin
  for profile_row in select id, email from public.profiles where username is null or btrim(username) = '' loop
    base_name := lower(regexp_replace(split_part(coalesce(profile_row.email, ''), '@', 1), '[^a-z0-9._]', '', 'g'));
    if length(base_name) < 3 then base_name := 'user' || left(replace(profile_row.id::text, '-', ''), 6); end if;
    base_name := left(base_name, 20);
    candidate := base_name;
    suffix := 1;
    while exists (select 1 from public.profiles p where lower(p.username) = lower(candidate) and p.id <> profile_row.id) loop
      suffix := suffix + 1;
      candidate := left(base_name, 20 - length(suffix::text)) || suffix::text;
    end loop;
    update public.profiles set username = candidate where id = profile_row.id;
  end loop;
end;
$migration$;

create unique index if not exists profiles_username_lower_unique on public.profiles (lower(username));

alter table public.profiles enable row level security;
drop policy if exists profiles_read_own_or_admin on public.profiles;
drop policy if exists profiles_admin_update_active on public.profiles;
drop policy if exists profiles_read_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_read_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke update on public.profiles from anon, authenticated;
grant update (display_name, username, birth_date, avatar_url) on public.profiles to authenticated;
grant select on public.profiles to authenticated;

create or replace function public.guard_profile_account_updates()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if auth.uid() is not null and auth.uid() = old.id then
    if new.id is distinct from old.id
      or new.email is distinct from old.email
      or new.role is distinct from old.role
      or new.is_active is distinct from old.is_active
      or new.created_at is distinct from old.created_at then
      raise exception 'Kolom akun sensitif tidak dapat diubah melalui profil.' using errcode = '42501';
    end if;
  end if;

  if new.username is distinct from old.username and new.username !~ '^[a-z0-9._]{3,20}$' then
    raise exception 'Username harus 3–20 karakter, huruf kecil, angka, titik, atau garis bawah.' using errcode = '22023';
  end if;
  if new.display_name is distinct from old.display_name
    and (new.display_name is null or char_length(btrim(new.display_name)) < 2 or char_length(btrim(new.display_name)) > 30) then
    raise exception 'Nama panggilan harus 2–30 karakter.' using errcode = '22023';
  end if;
  if new.birth_date is distinct from old.birth_date and new.birth_date > current_date then
    raise exception 'Tanggal lahir tidak boleh di masa depan.' using errcode = '22023';
  end if;
  return new;
end;
$function$;
drop trigger if exists guard_profile_account_updates on public.profiles;
create trigger guard_profile_account_updates
  before update on public.profiles for each row
  execute function public.guard_profile_account_updates();
revoke all on function public.guard_profile_account_updates() from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requested_username text;
begin
  requested_username := lower(pg_catalog.btrim(new.raw_user_meta_data ->> 'username'));
  if requested_username is null or requested_username !~ '^[a-z0-9._]{3,20}$' then
    raise exception 'Username must be 3 to 20 characters: lowercase letters, numbers, dots, or underscores';
  end if;
  insert into public.profiles (id, username, email)
  values (new.id, requested_username, new.email)
  on conflict (id) do nothing;
  return new;
end;
$function$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.is_username_available(candidate_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select candidate_username ~ '^[a-z0-9._]{3,20}$'
    and not exists (
      select 1 from public.profiles p
      where pg_catalog.lower(p.username) = pg_catalog.lower(candidate_username)
    );
$function$;
revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

create or replace function public.is_account_username_available(candidate_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select auth.uid() is not null
    and candidate_username ~ '^[a-z0-9._]{3,20}$'
    and not exists (
      select 1 from public.profiles p
      where pg_catalog.lower(p.username) = pg_catalog.lower(candidate_username)
        and p.id <> (select auth.uid())
    );
$function$;
revoke all on function public.is_account_username_available(text) from public, anon;
grant execute on function public.is_account_username_available(text) to authenticated;

-- Keep existing admin customer controls, but never return account PII to the admin UI.
create or replace function public.admin_list_customers()
returns table (id uuid, is_active boolean, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $function$
  select p.id, p.is_active, p.created_at
  from public.profiles p
  where p.role = 'user' and public.is_admin()
  order by p.created_at desc;
$function$;
revoke all on function public.admin_list_customers() from public, anon;
grant execute on function public.admin_list_customers() to authenticated;

create or replace function public.admin_set_customer_active(target_user uuid, new_active boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  updated_count integer;
begin
  if not public.is_admin() then
    raise exception 'Akses admin diperlukan.' using errcode = '42501';
  end if;
  update public.profiles set is_active = new_active where id = target_user and role = 'user';
  get diagnostics updated_count = row_count;
  if updated_count = 0 then
    raise exception 'Akun pelanggan tidak ditemukan.' using errcode = 'P0002';
  end if;
  return true;
end;
$function$;
revoke all on function public.admin_set_customer_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_customer_active(uuid, boolean) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_public_read on storage.objects;
drop policy if exists avatars_owner_insert on storage.objects;
drop policy if exists avatars_owner_update on storage.objects;
drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_public_read on storage.objects
  for select to public using (bucket_id = 'avatars');
create policy avatars_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
