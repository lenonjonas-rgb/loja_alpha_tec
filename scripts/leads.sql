create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text not null,
  document text,
  cep text not null,
  street text not null default '',
  number text not null default '',
  complement text,
  neighborhood text not null default '',
  city text not null default '',
  state text not null default '',
  service_type text not null,
  details text not null,
  equipment jsonb not null default '[]'::jsonb,
  estimated_total numeric(12,2) not null default 0,
  status text not null default 'new' check (status in ('new', 'contacted', 'proposal', 'won', 'lost')),
  notes text not null default ''
);

alter table public.leads add column if not exists updated_at timestamptz not null default now();
create index if not exists leads_status_created_at_idx on public.leads (status, created_at desc);
