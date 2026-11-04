begin;

alter table public.coupons add column if not exists customer_id uuid references public.customers(id) on delete cascade;
alter table public.coupons add column if not exists redeemed_order_id uuid;
create index if not exists coupons_customer_idx on public.coupons (customer_id) where customer_id is not null;

create or replace function public.check_order_coupon_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  coupon public.coupons%rowtype;
begin
  select * into coupon from public.coupons where code = new.coupon_code for update;
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
      -- confirm_paid_order incrementa antes desta atualização; o admin pode confirmar diretamente.
      update public.coupons set redeemed_order_id = new.id, used_count = 1 where id = coupon.id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists check_order_coupon_customer on public.orders;
create trigger check_order_coupon_customer
before insert or update of customer_id, coupon_code, payment_status on public.orders
for each row execute function public.check_order_coupon_customer();

create or replace function public.create_cart_recovery_coupon(p_customer_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  cart public.carts%rowtype;
begin
  select * into cart from public.carts where customer_id = p_customer_id for update;
  if not found or jsonb_typeof(cart.items) <> 'array' then
    raise exception 'O cliente não possui um carrinho para recuperar.';
  end if;
  if jsonb_array_length(cart.items) = 0 then
    raise exception 'O carrinho está vazio. Nenhum cupom foi criado.';
  end if;
  if exists (
    select 1 from public.orders
    where customer_id = p_customer_id and created_at >= cart.updated_at and status <> 'cancelled'
  ) then
    raise exception 'O cliente já iniciou ou concluiu um pedido após este carrinho. Atualize a lista antes de oferecer um cupom.';
  end if;
  return query
    insert into public.coupons as c (code, discount_percent, expires_at, usage_limit, customer_id)
    values ('VOLTE10-' || upper(replace(gen_random_uuid()::text, '-', '')), 10, now() + interval '7 days', 1, p_customer_id)
    returning c.code, c.expires_at;
end;
$$;

revoke all on function public.create_cart_recovery_coupon(uuid) from public, anon, authenticated;
grant execute on function public.create_cart_recovery_coupon(uuid) to service_role;
revoke all on function public.check_order_coupon_customer() from public, anon, authenticated;

commit;
