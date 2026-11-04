begin;

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  v uuid;
  original_time timestamptz;
  claimed record;
  found_a boolean;
begin
  insert into auth.users (id, email) values
    (a, a::text || '@cart-notifications-test.invalid'),
    (b, b::text || '@cart-notifications-test.invalid');
  insert into public.customers (id, name, email) values
    (a, 'Test', a::text || '@cart-notifications-test.invalid'),
    (b, 'Test', b::text || '@cart-notifications-test.invalid');
  insert into public.carts (customer_id, items) values
    (a, '[{"id":"one","name":"One","quantity":1},{"id":"two","quantity":2}]'),
    (b, '[{"id":"one","quantity":1}]');
  select pending_version, updated_at into v, original_time from public.carts where customer_id = a;
  assert (select pending_since = now() and pending_notified_at is null from public.carts where customer_id = a);

  update public.carts set pending_since = now() - interval '3 hours' + interval '1 millisecond' where customer_id = a;
  assert not exists (select 1 from public.claim_pending_cart_notifications() where customer_id = a),
    'Notificou antes de completar 3 horas.';
  update public.carts set items = '[{"id":"two","quantity":2},{"id":"one","name":"Renamed","price":200,"quantity":1}]',
    updated_at = now() + interval '1 day' where customer_id = a;
  assert (select pending_version = v and updated_at = original_time
    and pending_since = now() - interval '3 hours' + interval '1 millisecond'
    from public.carts where customer_id = a), 'Sync/login reiniciou o prazo.';

  update public.carts set pending_since = now() - interval '3 hours' where customer_id = a;
  found_a := false;
  for claimed in select * from public.claim_pending_cart_notifications() loop
    if claimed.customer_id = a then found_a := true; end if;
  end loop;
  assert found_a, 'Não notificou no limite exato de 3 horas.';
  assert not exists (select 1 from public.claim_pending_cart_notifications() where customer_id = a),
    'Execução repetida duplicou aviso.';
  update public.carts set items = '[{"id":"one","quantity":1},{"id":"two","quantity":2}]' where customer_id = a;
  assert (select pending_version = v and pending_notified_at is not null from public.carts where customer_id = a),
    'Mesmo carrinho após login perdeu a deduplicação.';
  assert not exists (select 1 from public.claim_pending_cart_notifications() where customer_id = a);

  update public.carts set items = '[{"id":"one","quantity":2}]' where customer_id = a;
  assert (select pending_version <> v and pending_since = now() and pending_notified_at is null
    from public.carts where customer_id = a), 'Mudança real não iniciou novo ciclo.';
  perform public.release_pending_cart_notification(a, v);
  assert (select pending_since = now() from public.carts where customer_id = a);
  update public.carts set pending_since = now() - interval '4 hours' where customer_id = a;
  perform public.claim_pending_cart_notifications();
  perform public.release_pending_cart_notification(a, v);
  assert (select pending_notified_at is not null from public.carts where customer_id = a),
    'Versão antiga liberou um aviso novo.';
  select pending_version into v from public.carts where customer_id = a;
  perform public.release_pending_cart_notification(a, v);
  assert (select pending_notified_at is null from public.carts where customer_id = a),
    'Falha total não permitiu nova tentativa.';

  update public.carts set items = '[]' where customer_id = a;
  assert (select pending_since is null from public.carts where customer_id = a);
  assert not exists (select 1 from public.claim_pending_cart_notifications() where customer_id = a);
  update public.carts set items = '[{"id":"one","quantity":1,"selectedModel":"new"}]' where customer_id = a;
  assert (select pending_since = now() from public.carts where customer_id = a);

  update public.carts set pending_since = now() - interval '4 hours' where customer_id = b;
  insert into public.orders (customer_id, subtotal, total, payment_status) values (b, 100, 100, 'pending');
  assert exists (select 1 from public.claim_pending_cart_notifications() where customer_id = b),
    'Pedido sem pagamento impediu aviso de abandono.';
  perform public.release_pending_cart_notification(b, (select pending_version from public.carts where customer_id = b));
  update public.orders set payment_status = 'paid' where customer_id = b;
  assert (select pending_since is null and pending_notified_at is not null from public.carts where customer_id = b);
  assert not exists (select 1 from public.claim_pending_cart_notifications() where customer_id = b),
    'Pagamento concluído não cancelou aviso.';
  update public.carts set items = '[{"id":"one","quantity":1}]' where customer_id = b;
  assert (select pending_since is null from public.carts where customer_id = b),
    'Login após pagar reabriu o mesmo carrinho.';

  assert not has_function_privilege('anon', 'public.claim_pending_cart_notifications()', 'EXECUTE');
  assert not has_function_privilege('authenticated', 'public.claim_pending_cart_notifications()', 'EXECUTE');
  assert has_function_privilege('service_role', 'public.claim_pending_cart_notifications()', 'EXECUTE');
end;
$$;

rollback;
select 'OK: limite de 3 horas, login, ordem/metadados, repetição, novos ciclos, falha total, vazio e pagamento; rollback.' as result;
