-- Executar no SQL Editor depois de scripts/cart-recovery.sql. Tudo é revertido.
begin;

do $$
declare
  first_customer uuid := gen_random_uuid();
  other_customer uuid := gen_random_uuid();
  first_coupon record;
  next_coupon record;
  first_order uuid := gen_random_uuid();
  next_order uuid := gen_random_uuid();
  rejected boolean;
  confirmed boolean;
begin
  insert into auth.users (id, email) values
    (first_customer, first_customer::text || '@cart-recovery-test.invalid'),
    (other_customer, other_customer::text || '@cart-recovery-test.invalid');
  insert into public.customers (id, name, email) values
    (first_customer, 'Recovery SQL test', first_customer::text || '@cart-recovery-test.invalid'),
    (other_customer, 'Recovery SQL test', other_customer::text || '@cart-recovery-test.invalid');
  insert into public.carts (customer_id, items, updated_at)
    values (first_customer, '[{"name":"Test","quantity":1,"price":100}]', now() - interval '1 day');

  select * into first_coupon from public.create_cart_recovery_coupon(first_customer);
  select * into next_coupon from public.create_cart_recovery_coupon(first_customer);
  assert first_coupon.code <> next_coupon.code, 'Cada emissão precisa gerar um código diferente.';
  assert first_coupon.expires_at = now() + interval '7 days', 'Validade incorreta.';
  assert exists (
    select 1 from public.coupons where code = first_coupon.code and discount_percent = 10
      and customer_id = first_customer and usage_limit = 1 and used_count = 0 and not free_shipping
  ), 'Cupom com regras incorretas.';

  rejected := false;
  begin
    insert into public.orders (customer_id, subtotal, total, coupon_code)
      values (other_customer, 100, 90, first_coupon.code);
  exception when raise_exception then
    if sqlerrm not like '%exclusivo%' then raise; end if;
    rejected := true;
  end;
  assert rejected, 'Outra conta conseguiu usar o cupom.';

  insert into public.orders (id, customer_id, subtotal, total, coupon_code)
    values (first_order, first_customer, 100, 90, first_coupon.code),
      (next_order, first_customer, 100, 90, first_coupon.code);
  select public.confirm_paid_order(first_order) into confirmed;
  assert confirmed, 'Pagamento não confirmado.';
  select public.confirm_paid_order(first_order) into confirmed;
  assert not confirmed, 'Confirmação duplicada não foi idempotente.';
  rejected := false;
  begin
    perform public.confirm_paid_order(next_order);
  exception when raise_exception then
    if sqlerrm not like '%Cupom esgotado%' then raise; end if;
    rejected := true;
  end;
  assert rejected, 'Cupom foi consumido duas vezes.';
  rejected := false;
  begin
    update public.orders set payment_status = 'paid' where id = next_order;
  exception when raise_exception then
    if sqlerrm not like '%já utilizado%' then raise; end if;
    rejected := true;
  end;
  assert rejected, 'Confirmação administrativa reutilizou o cupom.';
  assert (select used_count = 1 from public.coupons where code = first_coupon.code), 'Contagem de uso incorreta.';
  assert (select count(*) = 1 from public.notifications where order_id = first_order), 'Notificação duplicada.';
  update public.orders set coupon_code = next_coupon.code, payment_status = 'paid' where id = next_order;
  assert (select used_count = 1 and redeemed_order_id = next_order from public.coupons where code = next_coupon.code),
    'Confirmação administrativa não consumiu o cupom.';

  rejected := false;
  begin
    perform public.create_cart_recovery_coupon(first_customer);
  exception when raise_exception then
    if sqlerrm not like '%já iniciou%' then raise; end if;
    rejected := true;
  end;
  assert rejected, 'Oferta criada para carrinho convertido.';

  update public.carts set items = '[]' where customer_id = first_customer;
  rejected := false;
  begin
    perform public.create_cart_recovery_coupon(first_customer);
  exception when raise_exception then
    if sqlerrm not like '%vazio%' then raise; end if;
    rejected := true;
  end;
  assert rejected, 'Oferta criada para carrinho vazio.';
  assert not has_function_privilege('anon', 'public.create_cart_recovery_coupon(uuid)', 'EXECUTE');
  assert not has_function_privilege('authenticated', 'public.create_cart_recovery_coupon(uuid)', 'EXECUTE');
  assert has_function_privilege('service_role', 'public.create_cart_recovery_coupon(uuid)', 'EXECUTE');
end;
$$;

rollback;
select 'OK: emissão, exclusividade, validade, consumo único, idempotência, carrinho e permissões; testes revertidos.' as result;
