alter table public.products add column if not exists stock integer not null default 0;
alter table public.products add column if not exists discount_percent numeric(5,2) not null default 0;
alter table public.products add column if not exists flash_sale boolean not null default false;
alter table public.products add column if not exists show_in_banner boolean not null default false;
alter table public.products add column if not exists weight_kg numeric(10,3) not null default 0;
alter table public.products add column if not exists height_cm numeric(10,2) not null default 0;
alter table public.products add column if not exists width_cm numeric(10,2) not null default 0;
alter table public.products add column if not exists length_cm numeric(10,2) not null default 0;

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_percent numeric(5,2) not null check (discount_percent >= 0 and discount_percent <= 100),
  active boolean not null default true,
  expires_at timestamptz,
  usage_limit integer,
  used_count integer not null default 0,
  product_id text,
  category text,
  free_shipping boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.coupons add column if not exists product_id text;
alter table public.coupons add column if not exists category text;
alter table public.coupons add column if not exists free_shipping boolean not null default false;
create index if not exists coupons_code_active_idx on public.coupons (code, active);
create index if not exists coupons_product_id_idx on public.coupons (product_id);
create index if not exists coupons_category_idx on public.coupons (category);

create table if not exists public.store_profiles (
  id smallint primary key default 1 check (id = 1),
  cnpj text not null,
  legal_name text not null,
  trade_name text,
  email text,
  phone text,
  cep text not null,
  street text not null,
  number text not null,
  neighborhood text,
  city text not null,
  state text not null,
  updated_at timestamptz not null default now()
);

alter table public.orders add column if not exists payment_reference text;
create unique index if not exists orders_payment_reference_idx on public.orders (payment_reference) where payment_reference is not null;
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists tracking_code text;

create or replace function public.consume_coupon(p_coupon_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.coupons
  set used_count = used_count + 1
  where id = p_coupon_id
    and active = true
    and (expires_at is null or expires_at >= now())
    and (usage_limit is null or used_count < usage_limit);

  return found;
end;
$$;

create or replace function public.confirm_paid_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  order_coupon_code text;
  coupon_id uuid;
begin
  select coupon_code into order_coupon_code
  from public.orders
  where id = p_order_id and payment_status <> 'paid'
  for update;

  if not found then
    return false;
  end if;

  if order_coupon_code is not null then
    select id into coupon_id
    from public.coupons
    where code = order_coupon_code
      and active = true
      and (expires_at is null or expires_at >= now())
      and (usage_limit is null or used_count < usage_limit)
    for update;

    if not found then
      raise exception 'Cupom esgotado antes da confirmação do pagamento.';
    end if;

    update public.coupons set used_count = used_count + 1 where id = coupon_id;
  end if;

  update public.orders
  set status = 'confirmed', payment_status = 'paid'
  where id = p_order_id;

  return true;
end;
$$;
