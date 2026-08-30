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
