-- Salve CART_NOTIFICATIONS_SECRET no ambiente Production da Vercel e o mesmo
-- valor no Vault do Supabase com o nome cart_notifications_secret.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets
    where name = 'cart_notifications_secret' and length(decrypted_secret) >= 32
  ) then
    raise exception 'Configure cart_notifications_secret no Vault antes de agendar.';
  end if;
end;
$$;

select cron.schedule('pending-cart-notifications', '*/5 * * * *', $job$
  select net.http_post(
    url := 'https://www.lojaalphatec.com.br/api/cron/cart-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'cart_notifications_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
