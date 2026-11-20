begin;

alter table public.products
  add column if not exists unit_size numeric,
  add column if not exists unit_label text,
  add column if not exists unit_note text;

alter table public.products
  drop constraint if exists products_unit_size_positive_check,
  add constraint products_unit_size_positive_check check (unit_size is null or unit_size > 0),
  drop constraint if exists products_unit_label_length_check,
  add constraint products_unit_label_length_check check (unit_label is null or (char_length(btrim(unit_label)) between 1 and 12)),
  drop constraint if exists products_unit_note_length_check,
  add constraint products_unit_note_length_check check (unit_note is null or char_length(unit_note) <= 120),
  drop constraint if exists products_sku_key,
  add constraint products_sku_key unique (sku);

drop index if exists public.products_sku_unique_idx;

create or replace view public.products_public
with (security_barrier = true) as
select id, name, category, price, promo_price, stock, image_url, description,
       unit_size, unit_label, unit_note
from public.products
where is_active = true;

revoke all on public.products_public from public;
grant select on public.products_public to anon, authenticated;

-- Produk dan SKU hanya dapat ditulis oleh admin; kolom baru mengikuti kebijakan tabel yang sama.
drop policy if exists products_read_authenticated on public.products;
drop policy if exists products_admin_select on public.products;
drop policy if exists products_admin_insert on public.products;
drop policy if exists products_admin_update on public.products;
drop policy if exists products_admin_delete on public.products;
create policy products_read_authenticated on public.products for select to authenticated
  using (true);
create policy products_admin_insert on public.products for insert to authenticated
  with check ((select public.is_admin()));
create policy products_admin_update on public.products for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy products_admin_delete on public.products for delete to authenticated
  using ((select public.is_admin()));

revoke all on table public.products from public, anon, authenticated;
grant select, insert, update, delete on table public.products to authenticated;

commit;
