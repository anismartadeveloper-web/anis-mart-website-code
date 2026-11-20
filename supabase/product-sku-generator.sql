begin;

create sequence if not exists public.products_ns_sku_seq;
create sequence if not exists public.products_mn_sku_seq;

with missing as (
  select id,
    case when category = 'Snack' then 'NS' else 'MN' end as prefix,
    row_number() over (partition by category order by created_at, id) as row_number
  from public.products
  where sku is null or btrim(sku) = ''
)
update public.products as p
set sku = missing.prefix || '-' || lpad(missing.row_number::text, 3, '0')
from missing
where p.id = missing.id;

select setval('public.products_ns_sku_seq'::regclass, greatest(coalesce(max(substring(sku from '[0-9]+$')::bigint), 0) + 1, 1), false)
from public.products where sku ~ '^NS-[0-9]+$';
select setval('public.products_mn_sku_seq'::regclass, greatest(coalesce(max(substring(sku from '[0-9]+$')::bigint), 0) + 1, 1), false)
from public.products where sku ~ '^MN-[0-9]+$';

create or replace function public.assign_product_sku()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sku is null or btrim(new.sku) = '' then
    if new.category = 'Snack' then
      new.sku := 'NS-' || lpad(nextval('public.products_ns_sku_seq'::regclass)::text, 3, '0');
    elsif new.category = 'Minuman' then
      new.sku := 'MN-' || lpad(nextval('public.products_mn_sku_seq'::regclass)::text, 3, '0');
    else
      raise exception 'Kategori produk tidak valid.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists products_assign_sku on public.products;
create trigger products_assign_sku before insert on public.products
for each row execute function public.assign_product_sku();

commit;
