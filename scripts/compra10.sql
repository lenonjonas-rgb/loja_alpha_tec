-- Executar depois de commerce.sql e cart-recovery.sql.
begin;

create table if not exists public.cart_recovery_offers (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  expires_at timestamptz not null,
  redeemed_order_id uuid,
  created_at timestamptz not null default now()
);
alter table public.cart_recovery_offers enable row level security;
revoke all on public.cart_recovery_offers from public, anon, authenticated;
grant all on public.cart_recovery_offers to service_role;

insert into public.coupons (code, discount_percent)
values ('COMPRA10', 10)
on conflict on constraint coupons_code_key do nothing;

do $$
begin
  if not exists (
    select 1 from public.coupons where code = 'COMPRA10'
      and discount_percent = 10 and active and expires_at is null
      and usage_limit is null and customer_id is null and product_id is null
      and category is null and not free_shipping
  ) then
    raise exception 'Já existe um COMPRA10 com regras diferentes. Revise antes de ativar a recuperação.';
  end if;
end;
$$;

create or replace function public.check_order_coupon_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  coupon public.coupons%rowtype;
  offer public.cart_recovery_offers%rowtype;
begin
  select * into coupon from public.coupons where code = new.coupon_code for update;
  if new.coupon_code = 'COMPRA10' then
    select * into offer from public.cart_recovery_offers where customer_id = new.customer_id for update;
    if not found then raise exception 'COMPRA10 não foi liberado para este cliente.'; end if;
    if offer.redeemed_order_id is not null then
      if offer.redeemed_order_id <> new.id then
        raise exception 'COMPRA10 já utilizado em outra compra.';
      end if;
      return new;
    end if;
    if not coupon.active or coupon.id is null or offer.expires_at <= now() then
      raise exception 'Oferta COMPRA10 inativa ou expirada.';
    end if;
    if new.payment_status = 'paid' then
      update public.cart_recovery_offers set redeemed_order_id = new.id where customer_id = new.customer_id;
    end if;
    return new;
  end if;
  if coupon.customer_id is null then return new; end if;
  if coupon.customer_id is distinct from new.customer_id then
    raise exception 'Este cupom é exclusivo para outro cliente.';
  end if;
  if new.payment_status = 'paid' then
    if coupon.redeemed_order_id is not null and coupon.redeemed_order_id <> new.id then
      raise exception 'Cupom exclusivo já utilizado em outra compra.';
    end if;
    if coupon.redeemed_order_id is null then
      if not coupon.active or coupon.expires_at < now() then
        raise exception 'Cupom exclusivo inativo ou expirado.';
      end if;
      update public.coupons set redeemed_order_id = new.id, used_count = 1 where id = coupon.id;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.create_cart_recovery_coupon(p_customer_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  cart public.carts%rowtype;
  offer public.cart_recovery_offers%rowtype;
begin
  select * into cart from public.carts where customer_id = p_customer_id for update;
  if not found or jsonb_typeof(cart.items) <> 'array' then
    raise exception 'O cliente não possui um carrinho para recuperar.';
  end if;
  if jsonb_array_length(cart.items) = 0 then
    raise exception 'O carrinho está vazio. Nenhuma oferta foi criada.';
  end if;
  if exists (
    select 1 from public.orders
    where customer_id = p_customer_id and created_at >= cart.updated_at and status <> 'cancelled'
  ) then
    raise exception 'O cliente já iniciou ou concluiu um pedido após este carrinho. Atualize a lista antes de oferecer um cupom.';
  end if;
  if not exists (select 1 from public.coupons c where c.code = 'COMPRA10' and c.active) then
    raise exception 'O cupom COMPRA10 não está ativo.';
  end if;
  select * into offer from public.cart_recovery_offers where customer_id = p_customer_id for update;
  if offer.redeemed_order_id is not null then
    raise exception 'Este cliente já utilizou o COMPRA10. O cupom permite uma única compra por cliente.';
  end if;
  insert into public.cart_recovery_offers as o (customer_id, expires_at)
    values (p_customer_id, now() + interval '7 days')
    on conflict (customer_id) do update set expires_at = excluded.expires_at
      where o.expires_at <= now() and o.redeemed_order_id is null;
  return query select 'COMPRA10'::text, o.expires_at from public.cart_recovery_offers o where o.customer_id = p_customer_id;
end;
$$;

revoke all on function public.create_cart_recovery_coupon(uuid) from public, anon, authenticated;
grant execute on function public.create_cart_recovery_coupon(uuid) to service_role;
revoke all on function public.check_order_coupon_customer() from public, anon, authenticated;

commit;
