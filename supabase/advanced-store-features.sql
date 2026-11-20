begin;

alter table public.products
  add column if not exists sku text,
  add column if not exists promo_price numeric(12,2),
  add column if not exists extra_shipping_fee numeric(12,2) not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists image_path text;

with numbered_products as (
  select id,
    case when category = 'Snack' then 'NS' else 'MN' end || '-' ||
      lpad(row_number() over (partition by category order by created_at, id)::text, 3, '0') as generated_sku
  from public.products
  where sku is null or btrim(sku) = ''
)
update public.products as p
set sku = numbered_products.generated_sku
from numbered_products
where p.id = numbered_products.id;

alter table public.products alter column sku set not null;
create unique index if not exists products_sku_unique_idx on public.products (sku);
create unique index if not exists products_sku_lower_unique_idx on public.products (lower(sku));

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'products_sku_format_check' and conrelid = 'public.products'::regclass) then
    alter table public.products add constraint products_sku_format_check check (sku ~ '^[A-Z]{2,4}-[0-9]{3,}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_price_promo_check' and conrelid = 'public.products'::regclass) then
    alter table public.products add constraint products_price_promo_check check (promo_price is null or (promo_price >= 0 and promo_price < price));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_extra_shipping_fee_check' and conrelid = 'public.products'::regclass) then
    alter table public.products add constraint products_extra_shipping_fee_check check (extra_shipping_fee >= 0);
  end if;
end $$;

alter table public.orders add column if not exists distance_km double precision;

create table if not exists public.store_settings (
  id boolean primary key default true check (id),
  store_name text not null default 'Anis Mart',
  store_lat double precision not null default -7.2575 check (store_lat between -90 and 90),
  store_lng double precision not null default 112.7521 check (store_lng between -180 and 180),
  store_address text not null default 'Alamat toko belum diatur',
  tarif_dasar numeric(12,2) not null default 0 check (tarif_dasar >= 0),
  tarif_per_km numeric(12,2) not null default 3000 check (tarif_per_km >= 0),
  jarak_gratis_km double precision not null default 0 check (jarak_gratis_km >= 0),
  maks_jarak_km double precision not null default 25 check (maks_jarak_km > 0),
  ongkir_minimum numeric(12,2) not null default 5000 check (ongkir_minimum >= 0),
  gratis_ongkir_min_belanja numeric(12,2) check (gratis_ongkir_min_belanja is null or gratis_ongkir_min_belanja >= 0),
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.payment_methods (
  id text primary key check (id in ('cod', 'dana', 'gopay', 'shopeepay', 'ovo')),
  label text not null,
  deskripsi text not null default '',
  is_active boolean not null default true,
  urutan integer not null default 0
);

insert into public.payment_methods (id, label, deskripsi, is_active, urutan) values
  ('cod', 'Bayar di tempat', 'Tunai saat pesanan diterima', true, 1),
  ('dana', 'DANA', 'Dompet digital', true, 2),
  ('gopay', 'GoPay', 'Dompet digital', true, 3),
  ('shopeepay', 'ShopeePay', 'Dompet digital', true, 4),
  ('ovo', 'OVO', 'Dompet digital', true, 5)
on conflict (id) do nothing;

create or replace function public.prevent_disabling_all_payment_methods()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.is_active and not new.is_active then
    perform pg_advisory_xact_lock(hashtext('payment_methods_keep_one_active'));
    if not exists (select 1 from public.payment_methods pm where pm.id <> old.id and pm.is_active) then
      raise exception 'Minimal satu metode pembayaran harus tetap aktif.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists payment_methods_keep_one_active on public.payment_methods;
create trigger payment_methods_keep_one_active before update of is_active on public.payment_methods
for each row execute function public.prevent_disabling_all_payment_methods();

alter table public.products enable row level security;
alter table public.store_settings enable row level security;
alter table public.payment_methods enable row level security;

-- Data sensitif produk hanya dapat dibaca dari jalur admin; katalog memakai view dengan kolom aman.
drop policy if exists "products_read_authenticated" on public.products;
drop policy if exists "products_read_admin" on public.products;
drop policy if exists "products_admin_insert" on public.products;
drop policy if exists "products_admin_update" on public.products;
drop policy if exists "products_admin_delete" on public.products;
create policy "products_read_admin" on public.products for select to authenticated using ((select public.is_admin()));

revoke all on public.products from anon, authenticated;
grant select, insert, update, delete on public.products to authenticated;
create policy "products_admin_insert" on public.products for insert to authenticated with check ((select public.is_admin()));
create policy "products_admin_update" on public.products for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "products_admin_delete" on public.products for delete to authenticated using ((select public.is_admin()));

drop view if exists public.products_public;
create view public.products_public with (security_barrier = true) as
select id, name, category, price, promo_price, stock, image_url, description
from public.products
where is_active = true;
revoke all on public.products_public from public;
grant select on public.products_public to anon, authenticated;

create policy "store_settings_admin_select" on public.store_settings for select to authenticated using ((select public.is_admin()));
create policy "store_settings_admin_insert" on public.store_settings for insert to authenticated with check ((select public.is_admin()) and id);
create policy "store_settings_admin_update" on public.store_settings for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()) and id);
create policy "store_settings_admin_delete" on public.store_settings for delete to authenticated using ((select public.is_admin()));
revoke all on public.store_settings from anon, authenticated;
grant select, insert, update, delete on public.store_settings to authenticated;

create policy "payment_methods_admin_select" on public.payment_methods for select to authenticated using ((select public.is_admin()));
create policy "payment_methods_admin_update" on public.payment_methods for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.payment_methods from anon, authenticated;
grant select, update (is_active) on public.payment_methods to authenticated;

drop view if exists public.payment_methods_public;
create view public.payment_methods_public with (security_barrier = true) as
select id, label, deskripsi, urutan from public.payment_methods where is_active = true;
revoke all on public.payment_methods_public from public;
grant select on public.payment_methods_public to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "product_images_admin_read" on storage.objects;
drop policy if exists "product_images_admin_insert" on storage.objects;
drop policy if exists "product_images_admin_update" on storage.objects;
drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_read" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
create policy "product_images_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "product_images_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()))
  with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "product_images_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));

create or replace function public.quote_shipping(
  p_items jsonb,
  p_delivery_method text,
  p_latitude double precision,
  p_longitude double precision
)
returns table(distance_km double precision, shipping_fee numeric, is_deliverable boolean, quote_message text)
language plpgsql security definer set search_path = '' as $$
declare
  v_settings public.store_settings%rowtype;
  v_distance double precision;
  v_subtotal numeric(12,2) := 0;
  v_extra numeric(12,2) := 0;
  v_base numeric(12,2) := 0;
  v_fee numeric(12,2) := 0;
  v_requested jsonb;
  v_item record;
  v_input jsonb;
  v_quantity numeric;
  v_seen integer := 0;
begin
  if auth.uid() is null then raise exception 'Silakan masuk terlebih dahulu.'; end if;
  if p_delivery_method not in ('antar', 'ambil') then raise exception 'Metode pengiriman tidak valid.'; end if;
  if p_delivery_method = 'ambil' then return query select 0::double precision, 0::numeric, true, null::text; return; end if;
  if p_latitude is null or p_longitude is null or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Lokasi pengiriman wajib dipilih.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Daftar produk pesanan tidak valid.';
  end if;
  for v_input in select value from jsonb_array_elements(p_items) loop
    v_seen := v_seen + 1;
    if jsonb_typeof(v_input) <> 'object' or jsonb_typeof(v_input -> 'product_id') is distinct from 'string' or
      (v_input ->> 'product_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or
      jsonb_typeof(v_input -> 'quantity') is distinct from 'number' then raise exception 'Data produk pesanan tidak valid.'; end if;
    v_quantity := (v_input ->> 'quantity')::numeric;
    if v_quantity <> trunc(v_quantity) or v_quantity < 1 or v_quantity > 99 then raise exception 'Jumlah pesanan tidak valid.'; end if;
  end loop;
  select jsonb_agg(jsonb_build_object('product_id', grouped.product_id, 'quantity', grouped.quantity)) into v_requested
  from (select (entry.value ->> 'product_id')::uuid product_id,
    sum((entry.value ->> 'quantity')::integer)::integer quantity
    from jsonb_array_elements(p_items) entry(value) group by (entry.value ->> 'product_id')::uuid) grouped;
  if exists (select 1 from jsonb_to_recordset(v_requested) as req(product_id uuid, quantity integer) where req.quantity > 99) then
    raise exception 'Jumlah pesanan per produk tidak valid.';
  end if;
  for v_item in
    select p.price, p.promo_price, p.extra_shipping_fee, req.quantity
    from jsonb_to_recordset(v_requested) as req(product_id uuid, quantity integer)
    join public.products p on p.id = req.product_id and p.is_active
  loop
    v_subtotal := v_subtotal + coalesce(v_item.promo_price, v_item.price) * v_item.quantity;
    v_extra := v_extra + v_item.extra_shipping_fee * v_item.quantity;
  end loop;
  select * into v_settings from public.store_settings where id = true;
  if not found then raise exception 'Pengaturan toko belum tersedia.'; end if;
  v_distance := 6371 * 2 * asin(sqrt(least(1::double precision, greatest(0::double precision,
    power(sin(radians(p_latitude - v_settings.store_lat) / 2), 2) +
    cos(radians(v_settings.store_lat)) * cos(radians(p_latitude)) * power(sin(radians(p_longitude - v_settings.store_lng) / 2), 2)
  )))));
  if v_distance > v_settings.maks_jarak_km then
    return query select v_distance, 0::numeric, false, 'Di luar jangkauan antar'; return;
  end if;
  v_base := greatest(v_settings.ongkir_minimum, v_settings.tarif_dasar + greatest(0::double precision, v_distance - v_settings.jarak_gratis_km) * v_settings.tarif_per_km);
  v_fee := round((v_base + v_extra) / 500) * 500;
  if v_settings.gratis_ongkir_min_belanja is not null and v_subtotal >= v_settings.gratis_ongkir_min_belanja then v_fee := 0; end if;
  return query select v_distance, v_fee, true, null::text;
end;
$$;

drop function if exists public.place_order(jsonb, text, text, double precision, double precision, text);

create function public.place_order(
  p_items jsonb,
  p_delivery_method text,
  p_shipping_address text,
  p_latitude double precision,
  p_longitude double precision,
  p_payment_method text
)
returns table(order_id uuid, subtotal numeric, shipping_fee numeric, total_price numeric, items jsonb, distance_km double precision)
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_address text := nullif(btrim(p_shipping_address), '');
  v_order_id uuid;
  v_requested jsonb;
  v_items jsonb := '[]'::jsonb;
  v_item_count integer := 0;
  v_processed integer := 0;
  v_subtotal numeric(12,2) := 0;
  v_extra numeric(12,2) := 0;
  v_shipping numeric(12,2) := 0;
  v_total numeric(12,2);
  v_distance double precision;
  v_settings public.store_settings%rowtype;
  v_payment_label text;
  v_item record;
  v_input jsonb;
  v_quantity numeric;
begin
  if v_user_id is null then raise exception 'Silakan masuk untuk membuat pesanan.'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_user_id and p.is_active) then raise exception 'Akun tidak aktif dan tidak dapat memesan.'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then raise exception 'Daftar produk pesanan tidak valid.'; end if;
  if p_delivery_method not in ('ambil', 'antar') then raise exception 'Metode pengiriman tidak valid.'; end if;
  if p_delivery_method = 'antar' and (v_address is null or length(v_address) < 8 or length(v_address) > 500) then raise exception 'Alamat lengkap wajib diisi.'; end if;
  if p_delivery_method = 'antar' and (p_latitude is null or p_longitude is null or p_latitude not between -90 and 90 or p_longitude not between -180 and 180) then raise exception 'Lokasi pengiriman wajib dipilih.'; end if;
  if p_delivery_method = 'ambil' then p_latitude := null; p_longitude := null; end if;
  select pm.label into v_payment_label from public.payment_methods pm where pm.id = lower(p_payment_method) and pm.is_active;
  if not found then raise exception 'Metode pembayaran tidak aktif atau tidak valid.'; end if;
  select * into v_settings from public.store_settings where id = true;
  if not found then raise exception 'Pengaturan toko belum tersedia.'; end if;

  for v_input in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_input) <> 'object' or jsonb_typeof(v_input -> 'product_id') is distinct from 'string' or
      (v_input ->> 'product_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or
      jsonb_typeof(v_input -> 'quantity') is distinct from 'number' then raise exception 'Data produk pesanan tidak valid.'; end if;
    v_quantity := (v_input ->> 'quantity')::numeric;
    if v_quantity <> trunc(v_quantity) or v_quantity < 1 or v_quantity > 99 then raise exception 'Jumlah pesanan tidak valid.'; end if;
  end loop;

  select jsonb_agg(jsonb_build_object('product_id', grouped.product_id, 'quantity', grouped.quantity) order by grouped.product_id), count(*)
    into v_requested, v_item_count
  from (select (entry.value ->> 'product_id')::uuid product_id,
    sum((entry.value ->> 'quantity')::integer)::integer quantity
    from jsonb_array_elements(p_items) entry(value) group by (entry.value ->> 'product_id')::uuid) grouped;
  if exists (select 1 from jsonb_to_recordset(v_requested) as req(product_id uuid, quantity integer) where req.quantity > 99) then raise exception 'Jumlah pesanan per produk tidak valid.'; end if;

  for v_item in
    select p.id, p.name, p.price, p.promo_price, p.extra_shipping_fee, p.stock, req.quantity
    from jsonb_to_recordset(v_requested) as req(product_id uuid, quantity integer)
    join public.products p on p.id = req.product_id and p.is_active
    order by p.id for update of p
  loop
    if v_item.stock < v_item.quantity then raise exception 'Stok tidak mencukupi untuk produk: %.', v_item.name; end if;
    update public.products set stock = stock - v_item.quantity where id = v_item.id;
    v_subtotal := v_subtotal + coalesce(v_item.promo_price, v_item.price) * v_item.quantity;
    v_extra := v_extra + v_item.extra_shipping_fee * v_item.quantity;
    v_items := v_items || jsonb_build_array(jsonb_build_object('product_id', v_item.id, 'name', v_item.name,
      'unit_price', coalesce(v_item.promo_price, v_item.price), 'quantity', v_item.quantity));
    v_processed := v_processed + 1;
  end loop;
  if v_processed <> v_item_count then raise exception 'Satu atau lebih produk tidak tersedia.'; end if;

  if p_delivery_method = 'antar' then
    v_distance := 6371 * 2 * asin(sqrt(least(1::double precision, greatest(0::double precision,
      power(sin(radians(p_latitude - v_settings.store_lat) / 2), 2) +
      cos(radians(v_settings.store_lat)) * cos(radians(p_latitude)) * power(sin(radians(p_longitude - v_settings.store_lng) / 2), 2)
    ))));
    if v_distance > v_settings.maks_jarak_km then raise exception 'Di luar jangkauan antar'; end if;
    v_shipping := round((greatest(v_settings.ongkir_minimum,
      v_settings.tarif_dasar + greatest(0::double precision, v_distance - v_settings.jarak_gratis_km) * v_settings.tarif_per_km) + v_extra) / 500) * 500;
    if v_settings.gratis_ongkir_min_belanja is not null and v_subtotal >= v_settings.gratis_ongkir_min_belanja then v_shipping := 0; end if;
  end if;
  v_total := v_subtotal + v_shipping;

  insert into public.orders (user_id, subtotal, shipping_fee, total_price, shipping_address, delivery_method, latitude, longitude, distance_km, payment_method, payment_status, status, stock_restored)
  values (v_user_id, v_subtotal, v_shipping, v_total, coalesce(v_address, 'Ambil di toko'), p_delivery_method, p_latitude, p_longitude, v_distance, v_payment_label, case when lower(p_payment_method) = 'cod' then 'bayar di tempat' else 'belum dibayar' end, 'pending', false)
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, quantity, price)
  select v_order_id, req.product_id, req.quantity, coalesce(p.promo_price, p.price)
  from jsonb_to_recordset(v_requested) as req(product_id uuid, quantity integer)
  join public.products p on p.id = req.product_id;

  return query select v_order_id, v_subtotal, v_shipping, v_total, v_items, v_distance;
end;
$$;

-- Tutup overload lama yang menerima ongkir dari klien agar tidak dapat melewati harga promo dan validasi metode aktif.
revoke all on function public.place_order(uuid, integer, text, text, double precision, double precision, numeric, text) from public, anon, authenticated;
revoke all on function public.place_order(jsonb, text, text, double precision, double precision, text) from public, anon;
grant execute on function public.place_order(jsonb, text, text, double precision, double precision, text) to authenticated;
revoke all on function public.quote_shipping(jsonb, text, double precision, double precision) from public, anon;
grant execute on function public.quote_shipping(jsonb, text, double precision, double precision) to authenticated;

commit;
