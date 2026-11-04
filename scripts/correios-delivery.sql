-- Executar no SQL Editor do Supabase antes de ativar a assinatura.
create or replace function public.apply_correios_deliveries(deliveries jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  with events as (
    select tracking_code, min(delivered_at) as delivered_at
    from jsonb_to_recordset(deliveries) as e(tracking_code text, delivered_at timestamptz)
    group by tracking_code
  ), updated as (
    update public.orders o
    set status = 'delivered', delivered_at = e.delivered_at
    from events e
    where upper(trim(o.tracking_code)) = e.tracking_code
      and o.carrier ilike '%correios%'
      and o.status in ('confirmed', 'processing', 'shipped')
      and e.delivered_at >= o.created_at
    returning o.id, o.customer_id
  ), notified as (
    insert into public.notifications (customer_id, order_id, title, message, status)
    select customer_id, id, 'Atualização do pedido',
      'Seu pedido foi entregue pelos Correios.', 'delivered'
    from updated where customer_id is not null
  )
  select count(*) into updated_count from updated;
  return updated_count;
end;
$$;

revoke all on function public.apply_correios_deliveries(jsonb) from public, anon, authenticated;
grant execute on function public.apply_correios_deliveries(jsonb) to service_role;
