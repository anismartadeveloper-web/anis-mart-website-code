begin;

insert into storage.buckets (id, name, public, allowed_mime_types)
values ('branding', 'branding', true, array['image/png']::text[])
on conflict (id) do nothing;

create policy branding_public_read
  on storage.objects for select to public
  using (bucket_id = 'branding');

create policy branding_admin_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'branding'
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    )
  );

create policy branding_admin_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'branding'
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    )
  )
  with check (
    bucket_id = 'branding'
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    )
  );

create policy branding_admin_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'branding'
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    )
  );

commit;
