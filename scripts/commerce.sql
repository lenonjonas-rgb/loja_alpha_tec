alter table public.products add column if not exists stock integer not null default 0;
alter table public.products add column if not exists discount_percent numeric(5,2) not null default 0;
alter table public.products add column if not exists flash_sale boolean not null default false;
alter table public.products add column if not exists show_in_banner boolean not null default false;

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_percent numeric(5,2) not null check (discount_percent >= 0 and discount_percent <= 100),
  active boolean not null default true,
  expires_at timestamptz,
  usage_limit integer,
  used_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists coupons_code_active_idx on public.coupons (code, active);
