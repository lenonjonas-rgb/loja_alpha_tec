alter table public.products add column if not exists stock integer not null default 0;
alter table public.products add column if not exists discount_percent numeric(5,2) not null default 0;
alter table public.products add column if not exists flash_sale boolean not null default false;
alter table public.products add column if not exists show_in_banner boolean not null default false;
alter table public.products add column if not exists weight_kg numeric(10,3) not null default 0;
alter table public.products add column if not exists height_cm numeric(10,2) not null default 0;
alter table public.products add column if not exists width_cm numeric(10,2) not null default 0;
alter table public.products add column if not exists length_cm numeric(10,2) not null default 0;

-- carrinho do cliente sincronizado entre dispositivos: 1 linha por cliente logado
create table if not exists public.carts (
  customer_id uuid primary key references auth.users (id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

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
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists invoice_url text;
alter table public.orders add column if not exists carrier text;

create table if not exists public.password_reset_codes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists password_reset_codes_email_idx on public.password_reset_codes (email, created_at desc);

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

-- Programa de pontos: cliente avalia o pedido entregue (com fotos opcionais) e ganha pontos,
-- que expiram em 90 dias e podem ser trocados por desconto em compras futuras.
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  photos jsonb not null default '[]'::jsonb,
  points_awarded integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_reviews_customer_idx on public.product_reviews (customer_id);

create table if not exists public.loyalty_points (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  points integer not null,
  reason text not null check (reason in ('review', 'redeem', 'purchase')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists loyalty_points_customer_idx on public.loyalty_points (customer_id);
alter table public.loyalty_points drop constraint if exists loyalty_points_reason_check;
alter table public.loyalty_points add constraint loyalty_points_reason_check check (reason in ('review', 'redeem', 'purchase'));

alter table public.orders add column if not exists points_redeemed integer not null default 0;
alter table public.orders add column if not exists points_discount numeric(10,2) not null default 0;

-- Saldo de pontos disponível: soma dos ganhos ainda não expirados menos tudo que já foi resgatado
create or replace function public.get_loyalty_balance(p_customer_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(
    case
      when reason = 'redeem' then points
      when expires_at is null or expires_at >= now() then points
      else 0
    end
  ), 0)::integer
  from public.loyalty_points
  where customer_id = p_customer_id;
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
  order_customer_id uuid;
  order_points_redeemed integer;
  order_subtotal numeric(12,2);
  available_points integer;
  purchase_points integer;
begin
  select coupon_code, customer_id, points_redeemed, subtotal into order_coupon_code, order_customer_id, order_points_redeemed, order_subtotal
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

  if order_points_redeemed > 0 then
    select public.get_loyalty_balance(order_customer_id) into available_points;
    if available_points < order_points_redeemed then
      raise exception 'Saldo de pontos insuficiente para concluir o resgate.';
    end if;
    insert into public.loyalty_points (customer_id, order_id, points, reason)
    values (order_customer_id, p_order_id, -order_points_redeemed, 'redeem');
  end if;

  update public.orders
  set status = 'confirmed', payment_status = 'paid'
  where id = p_order_id;

  -- pontos por real gasto: taxa conservadora (1 ponto a cada R$ 5 do subtotal), pois o catálogo tem itens caros
  purchase_points := floor(coalesce(order_subtotal, 0) / 5)::integer;
  if purchase_points > 0 then
    insert into public.loyalty_points (customer_id, order_id, points, reason, expires_at)
    values (order_customer_id, p_order_id, purchase_points, 'purchase', now() + interval '90 days');
  end if;

  -- baixa o estoque dos itens do pedido assim que o pagamento é confirmado (uma única vez, dentro da mesma transação)
  update public.products p
  set stock = greatest(0, p.stock - oi.quantity)
  from public.order_items oi
  where oi.order_id = p_order_id
    and p.id::text = oi.product_id::text;

  return true;
end;
$$;
