-- Skema Admin Console Anis Mart — aman dijalankan ulang.
-- migration juga diterapkan ke project Supabase terhubung.
begin;

alter table public.profiles add column if not exists is_active boolean not null default true;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('Snack', 'Minuman')),
  price numeric(12,2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  total_price numeric(12,2) not null default 0 check (total_price >= 0),
  shipping_address text not null,
  payment_method text not null,
  status text not null default 'pending' check (status in ('pending', 'diproses', 'selesai', 'dibatalkan')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity integer not null check (quantity > 0),
  price numeric(12,2) not null check (price >= 0)
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "baca profil sendiri" on public.profiles;
drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "profiles_read_own_or_admin" on public.profiles;
drop policy if exists "profiles_admin_update_active" on public.profiles;
drop policy if exists "products_read_authenticated" on public.products;
drop policy if exists "products_admin_insert" on public.products;
drop policy if exists "products_admin_update" on public.products;
drop policy if exists "products_admin_delete" on public.products;
drop policy if exists "orders_read_owner_or_admin" on public.orders;
drop policy if exists "orders_admin_update" on public.orders;
drop policy if exists "order_items_read_owner_or_admin" on public.order_items;

revoke all on public.profiles, public.products, public.orders, public.order_items from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (is_active) on public.profiles to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, update (status) on public.orders to authenticated;
grant select on public.order_items to authenticated;

create policy "profiles_read_own_or_admin" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles_admin_update_active" on public.profiles for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "products_read_authenticated" on public.products for select to authenticated using (true);
create policy "products_admin_insert" on public.products for insert to authenticated with check ((select public.is_admin()));
create policy "products_admin_update" on public.products for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "products_admin_delete" on public.products for delete to authenticated using ((select public.is_admin()));

create policy "orders_read_owner_or_admin" on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "orders_admin_update" on public.orders for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "order_items_read_owner_or_admin" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_items.order_id
    and (o.user_id = (select auth.uid()) or (select public.is_admin()))));

-- Seed produk idempoten berdasarkan nama.
insert into public.products (name, category, price, stock, image_url, description)
select seed.name, seed.category, seed.price, seed.stock, seed.image_url, seed.description
from (values
  ('Chitato Sapi Panggang', 'Snack', 11500::numeric, 8, 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=640&q=80', 'Keripik kentang renyah rasa sapi panggang.'),
  ('Lays Rumput Laut', 'Snack', 11000::numeric, 24, 'https://images.unsplash.com/photo-1621939514649-280e2aa2f2bb?auto=format&fit=crop&w=640&q=80', 'Keripik kentang gurih dengan rasa rumput laut.'),
  ('Teh Botol Sosro', 'Minuman', 5000::numeric, 6, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=640&q=80', 'Teh melati siap minum, nikmat disajikan dingin.'),
  ('Aqua Mineral 600ml', 'Minuman', 4000::numeric, 40, 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=640&q=80', 'Air mineral praktis untuk menemani aktivitas.'),
  ('Qtela Singkong Original', 'Snack', 8000::numeric, 18, 'https://images.unsplash.com/photo-1621939514649-280e2aa2f2bb?auto=format&fit=crop&w=640&q=80', 'Keripik singkong renyah untuk teman santai.'),
  ('Taro Net BBQ', 'Snack', 7500::numeric, 14, 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=640&q=80', 'Snack jagung dengan bumbu barbeku.'),
  ('Coca-Cola', 'Minuman', 7000::numeric, 22, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=640&q=80', 'Minuman soda segar, lebih nikmat disajikan dingin.'),
  ('Pocari Sweat', 'Minuman', 8000::numeric, 16, 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=640&q=80', 'Minuman isotonik untuk menemani aktivitas.')
) as seed(name, category, price, stock, image_url, description)
where not exists (select 1 from public.products p where p.name = seed.name);

-- Contoh transaksi hanya untuk akun pelanggan riil yang sudah tersedia.
do $$
declare sample_customer uuid; sample_product uuid; sample_order uuid;
begin
  if not exists (select 1 from public.orders where shipping_address = '[Contoh] Jl. Melati No. 1') then
    select id into sample_customer from public.profiles where role = 'user' and is_active = true order by created_at limit 1;
    select id into sample_product from public.products where name = 'Teh Botol Sosro' limit 1;
    if sample_customer is not null and sample_product is not null then
      insert into public.orders (user_id, total_price, shipping_address, payment_method, status)
      values (sample_customer, 10000, '[Contoh] Jl. Melati No. 1', 'Transfer bank', 'pending') returning id into sample_order;
      insert into public.order_items (order_id, product_id, quantity, price) values (sample_order, sample_product, 2, 5000);
    end if;
  end if;
end;
$$;
commit;
