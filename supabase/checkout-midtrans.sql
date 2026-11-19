begin;

alter table public.orders
  add column if not exists subtotal numeric(12,2) not null default 0,
  add column if not exists shipping_fee numeric(12,2) not null default 0,
  add column if not exists delivery_method text not null default 'ambil',
  add column if not exists payment_status text not null default 'belum dibayar',
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists snap_token text,
  add column if not exists stock_restored boolean not null default false;

alter table public.orders alter column payment_method set default 'COD';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_delivery_method_check' AND conrelid = 'public.orders'::regclass) THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_delivery_method_check CHECK (delivery_method IN ('ambil', 'antar'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_status_check' AND conrelid = 'public.orders'::regclass) THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('belum dibayar', 'bayar di tempat', 'lunas'));
  END IF;
END $$;

create or replace function public.place_order(
  p_product_id uuid,
  p_quantity integer,
  p_delivery_method text,
  p_shipping_address text,
  p_latitude double precision,
  p_longitude double precision,
  p_shipping_fee numeric,
  p_payment_method text
)
returns table(order_id uuid, subtotal numeric, shipping_fee numeric, total_price numeric, product_name text, unit_price numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_product public.products%rowtype;
  v_subtotal numeric(12,2);
  v_shipping numeric(12,2);
  v_total numeric(12,2);
  v_address text := nullif(btrim(p_shipping_address), '');
  v_order_id uuid;
  v_distance double precision;
begin
  if v_user_id is null then raise exception 'Silakan masuk untuk membuat pesanan.'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_user_id and p.is_active) then
    raise exception 'Akun tidak aktif dan tidak dapat memesan.';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 99 then raise exception 'Jumlah pesanan tidak valid.'; end if;
  if p_delivery_method not in ('ambil', 'antar') then raise exception 'Metode pengiriman tidak valid.'; end if;
  if p_payment_method not in ('COD', 'DANA', 'GoPay', 'ShopeePay', 'OVO') then raise exception 'Metode pembayaran tidak valid.'; end if;
  if p_delivery_method = 'antar' and v_address is null then raise exception 'Alamat lengkap wajib diisi.'; end if;
  if (p_latitude is null) <> (p_longitude is null) then raise exception 'Koordinat lokasi tidak lengkap.'; end if;
  if p_latitude is not null and (p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180) then raise exception 'Koordinat lokasi tidak valid.'; end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then raise exception 'Produk tidak ditemukan.'; end if;
  if v_product.stock < p_quantity then raise exception 'Stok tidak mencukupi.'; end if;

  v_subtotal := round(v_product.price * p_quantity, 2);
  if p_delivery_method = 'ambil' then
    v_shipping := 0;
  elsif p_latitude is null then
    v_shipping := 10000;
  else
    -- Titik pusat Anis Mart dan tarif harus sama dengan lib/store/config.ts.
    v_distance := 6371 * 2 * asin(sqrt(
      power(sin(radians(p_latitude - (-7.2575)) / 2), 2) +
      cos(radians(-7.2575)) * cos(radians(p_latitude)) *
      power(sin(radians(p_longitude - 112.7521) / 2), 2)
    ));
    v_shipping := greatest(5000, ceil(v_distance * 3000));
  end if;
  v_total := v_subtotal + v_shipping;

  update public.products set stock = stock - p_quantity where id = p_product_id;
  insert into public.orders (user_id, subtotal, shipping_fee, total_price, shipping_address, delivery_method, latitude, longitude, payment_method, payment_status, status, stock_restored)
  values (v_user_id, v_subtotal, v_shipping, v_total, coalesce(v_address, 'Ambil di toko'), p_delivery_method, p_latitude, p_longitude, p_payment_method, case when p_payment_method = 'COD' then 'bayar di tempat' else 'belum dibayar' end, 'pending', false)
  returning id into v_order_id;
  insert into public.order_items (order_id, product_id, quantity, price) values (v_order_id, p_product_id, p_quantity, v_product.price);
  return query select v_order_id, v_subtotal, v_shipping, v_total, v_product.name, v_product.price;
end;
$$;

create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then raise exception 'Silakan masuk terlebih dahulu.'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pesanan tidak ditemukan.'; end if;
  if auth.uid() is not null and v_order.user_id <> auth.uid() and not public.is_admin() then raise exception 'Tidak memiliki akses ke pesanan ini.'; end if;
  if v_order.status in ('selesai', 'dibatalkan') then raise exception 'Pesanan ini tidak dapat dibatalkan.'; end if;
  if v_order.stock_restored then raise exception 'Stok pesanan ini sudah dikembalikan.'; end if;

  for v_item in select product_id, quantity from public.order_items where order_id = p_order_id and product_id is not null loop
    update public.products set stock = stock + v_item.quantity where id = v_item.product_id;
  end loop;
  update public.orders set status = 'dibatalkan', stock_restored = true where id = p_order_id;
end;
$$;

create or replace function public.attach_snap_token(p_order_id uuid, p_snap_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (select 1 from public.orders o where o.id = p_order_id and o.user_id = auth.uid() and o.payment_method <> 'COD' and o.status = 'pending') then
    raise exception 'Pesanan tidak ditemukan atau tidak dapat diperbarui.';
  end if;
  update public.orders set snap_token = p_snap_token where id = p_order_id;
end;
$$;

create or replace function public.apply_midtrans_status(p_order_id uuid, p_midtrans_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pesanan tidak ditemukan.'; end if;
  if p_midtrans_status in ('settlement', 'capture') then
    if v_order.status <> 'dibatalkan' and v_order.status <> 'selesai' then
      update public.orders set payment_status = 'lunas', status = 'diproses' where id = p_order_id;
    end if;
  elsif p_midtrans_status in ('expire', 'cancel', 'deny', 'failure') then
    if v_order.status not in ('dibatalkan', 'selesai') and not v_order.stock_restored then
      perform public.cancel_order(p_order_id);
    end if;
  end if;
end;
$$;

revoke all on function public.place_order(uuid, integer, text, text, double precision, double precision, numeric, text) from public, anon;
grant execute on function public.place_order(uuid, integer, text, text, double precision, double precision, numeric, text) to authenticated;
revoke all on function public.cancel_order(uuid) from public, anon;
grant execute on function public.cancel_order(uuid) to authenticated;
revoke all on function public.attach_snap_token(uuid, text) from public, anon;
grant execute on function public.attach_snap_token(uuid, text) to authenticated;
revoke all on function public.apply_midtrans_status(uuid, text) from public, anon, authenticated;
grant execute on function public.apply_midtrans_status(uuid, text) to service_role;

commit;
