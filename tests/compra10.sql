begin;

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  order_a uuid := gen_random_uuid();
  order_b uuid := gen_random_uuid();
  duplicate_order uuid := gen_random_uuid();
  offer_a record;
  offer_b record;
  repeated record;
  rejected boolean;
begin
  insert into auth.users (id, email) values
    (a, a::text || '@compra10-test.invalid'),
    (b, b::text || '@compra10-test.invalid'),
    (outsider, outsider::text || '@compra10-test.invalid');
  insert into public.customers (id, name, email) values
    (a, 'Test', a::text || '@compra10-test.invalid'),
    (b, 'Test', b::text || '@compra10-test.invalid'),
    (outsider, 'Test', outsider::text || '@compra10-test.invalid');
  insert into public.carts (customer_id, items, updated_at) values
    (a, '[{"name":"Test","quantity":1,"price":100}]', now() - interval '1 day'),
    (b, '[{"name":"Test","quantity":1,"price":100}]', now() - interval '1 day');

  select * into offer_a from public.create_cart_recovery_coupon(a);
  select * into offer_b from public.create_cart_recovery_coupon(b);
  assert offer_a.code = 'COMPRA10' and offer_b.code = 'COMPRA10';
  assert offer_a.expires_at = now() + interval '7 days';
  update public.cart_recovery_offers set expires_at = now() + interval '2 days' where customer_id = a;
  select * into repeated from public.create_cart_recovery_coupon(a);
  assert repeated.expires_at = now() + interval '2 days', 'Clique repetido prorrogou prazo.';
  assert (select expires_at = now() + interval '7 days' from public.cart_recovery_offers where customer_id = b),
    'Validades não são independentes.';

  rejected := false;
  begin
    insert into public.orders (customer_id, subtotal, total, coupon_code) values (outsider, 100, 90, 'COMPRA10');
  exception when raise_exception then
    if sqlerrm not like '%não foi liberado%' then raise; end if;
    rejected := true;
  end;
  assert rejected, 'Conta sem oferta usou o cupom.';
  update public.cart_recovery_offers set expires_at = now() - interval '1 day' where customer_id = b;
  rejected := false;
  begin
    insert into public.orders (customer_id, subtotal, total, coupon_code) values (b, 100, 90, 'COMPRA10');
  exception when raise_exception then
    if sqlerrm not like '%expirada%' then raise; end if;
    rejected := true;
  end;
  assert rejected, 'Oferta expirada foi aceita.';
  select * into repeated from public.create_cart_recovery_coupon(b);
  assert repeated.expires_at = now() + interval '7 days', 'Oferta não usada não foi renovada.';

  insert into public.orders (id, customer_id, subtotal, total, coupon_code) values
    (order_a, a, 100, 90, 'COMPRA10'),
    (duplicate_order, a, 100, 90, 'COMPRA10'),
    (order_b, b, 100, 90, 'COMPRA10');
  assert public.confirm_paid_order(order_a);
  assert not public.confirm_paid_order(order_a), 'Confirmação duplicada.';
  assert public.confirm_paid_order(order_b), 'Uso de um cliente bloqueou o outro.';
  rejected := false;
  begin
    perform public.confirm_paid_order(duplicate_order);
  exception when raise_exception then
    if sqlerrm not like '%já utilizado%' then raise; end if;
    rejected := true;
  end;
  assert rejected, 'Cliente usou duas vezes.';
  rejected := false;
  begin
    update public.orders set payment_status = 'paid' where id = duplicate_order;
  exception when raise_exception then
    if sqlerrm not like '%já utilizado%' then raise; end if;
    rejected := true;
  end;
  assert rejected, 'Confirmação manual reutilizou oferta.';
  assert (select redeemed_order_id = order_a from public.cart_recovery_offers where customer_id = a);
  assert (select redeemed_order_id = order_b from public.cart_recovery_offers where customer_id = b);
  delete from public.orders where id in (order_a, order_b, duplicate_order);
  rejected := false;
  begin
    perform public.create_cart_recovery_coupon(a);
  exception when raise_exception then
    if sqlerrm not like '%já utilizou%' then raise; end if;
    rejected := true;
  end;
  assert rejected, 'Exclusão de pedido liberou novo uso.';
  assert not has_table_privilege('anon', 'public.cart_recovery_offers', 'SELECT');
  assert not has_table_privilege('authenticated', 'public.cart_recovery_offers', 'SELECT');
  assert has_table_privilege('service_role', 'public.cart_recovery_offers', 'SELECT');
end;
$$;

rollback;
select 'OK: COMPRA10 por cliente, validade individual, renovação, bloqueios e consumo único; testes revertidos.' as result;
