begin;

alter table public.carts add column if not exists pending_since timestamptz;
alter table public.carts add column if not exists pending_notified_at timestamptz;
alter table public.carts add column if not exists pending_version uuid;

-- Carrinhos anteriores já estavam sujeitos ao aviso imediato; não reenviar.
update public.carts set pending_version = gen_random_uuid(), pending_notified_at = now()
where pending_version is null;

create or replace function public.cart_item_signature(items jsonb)
returns jsonb
language sql immutable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_array(item->>'id', coalesce(item->>'selectedModel', ''), (item->>'quantity')::numeric)
    order by item->>'id', coalesce(item->>'selectedModel', ''), (item->>'quantity')::numeric), '[]'::jsonb)
  from jsonb_array_elements(items) item;
$$;

create or replace function public.track_cart_pending_notification()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if public.cart_item_signature(new.items) = public.cart_item_signature(old.items) then
      new.updated_at := old.updated_at;
      new.pending_since := old.pending_since;
      new.pending_notified_at := old.pending_notified_at;
      new.pending_version := old.pending_version;
      return new;
    end if;
  end if;
  new.updated_at := now();
  new.pending_since := case when jsonb_array_length(new.items) > 0 then now() else null end;
  new.pending_notified_at := null;
  new.pending_version := gen_random_uuid();
  return new;
end;
$$;

drop trigger if exists track_cart_pending_notification on public.carts;
create trigger track_cart_pending_notification
before insert or update of items on public.carts
for each row execute function public.track_cart_pending_notification();

create or replace function public.stop_paid_cart_notification()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.payment_status = 'paid' then
    if tg_op = 'UPDATE' then
      if old.payment_status = 'paid' then return new; end if;
    end if;
    update public.carts set pending_since = null, pending_notified_at = now()
    where customer_id = new.customer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists stop_paid_cart_notification on public.orders;
create trigger stop_paid_cart_notification
after insert or update of payment_status on public.orders
for each row execute function public.stop_paid_cart_notification();

create or replace function public.claim_pending_cart_notifications()
returns table (customer_id uuid, pending_version uuid)
language sql security definer
set search_path = public
as $$
  with due as (
    select c.customer_id from public.carts c
    where c.pending_since <= now() - interval '3 hours'
      and c.pending_notified_at is null and jsonb_array_length(c.items) > 0
      and not exists (
        select 1 from public.orders o where o.customer_id = c.customer_id
          and o.payment_status = 'paid' and o.created_at >= c.pending_since
      )
    order by c.pending_since
    limit 20 for update of c skip locked
  )
  update public.carts c set pending_notified_at = now()
  from due where c.customer_id = due.customer_id
  returning c.customer_id, c.pending_version;
$$;

create or replace function public.release_pending_cart_notification(p_customer_id uuid, p_version uuid)
returns void
language sql security definer
set search_path = public
as $$
  update public.carts set pending_notified_at = null
  where customer_id = p_customer_id and pending_version = p_version and pending_since is not null;
$$;

revoke all on function public.cart_item_signature(jsonb) from public, anon, authenticated;
grant execute on function public.cart_item_signature(jsonb) to service_role;
revoke all on function public.track_cart_pending_notification() from public, anon, authenticated;
revoke all on function public.stop_paid_cart_notification() from public, anon, authenticated;
revoke all on function public.claim_pending_cart_notifications() from public, anon, authenticated;
revoke all on function public.release_pending_cart_notification(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_pending_cart_notifications() to service_role;
grant execute on function public.release_pending_cart_notification(uuid, uuid) to service_role;

commit;
