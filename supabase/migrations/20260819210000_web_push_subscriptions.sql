create table if not exists public.push_subscriptions(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_recipient_idx on public.push_subscriptions(company_id,user_id) where enabled;
alter table public.push_subscriptions enable row level security;
drop policy if exists "push subscriptions own select" on public.push_subscriptions;
drop policy if exists "push subscriptions own insert" on public.push_subscriptions;
drop policy if exists "push subscriptions own update" on public.push_subscriptions;
drop policy if exists "push subscriptions own delete" on public.push_subscriptions;
create policy "push subscriptions own select" on public.push_subscriptions for select to authenticated using(user_id=auth.uid());
create policy "push subscriptions own insert" on public.push_subscriptions for insert to authenticated with check(user_id=auth.uid() and public.is_company_member(company_id));
create policy "push subscriptions own update" on public.push_subscriptions for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and public.is_company_member(company_id));
create policy "push subscriptions own delete" on public.push_subscriptions for delete to authenticated using(user_id=auth.uid());
grant select,insert,update,delete on public.push_subscriptions to authenticated;

create extension if not exists pg_net with schema extensions;
create or replace function public.dispatch_app_notification_push()
returns trigger language plpgsql security definer set search_path=public,extensions,vault as $$
declare webhook_secret text;
begin
  select decrypted_secret into webhook_secret from vault.decrypted_secrets where name='push_webhook_secret' order by created_at desc limit 1;
  if webhook_secret is null then return new; end if;
  perform net.http_post(
    url:='https://rqqdvssisioxkhuxymdw.supabase.co/functions/v1/send-web-push',
    headers:=jsonb_build_object('Content-Type','application/json','x-webhook-secret',webhook_secret),
    body:=jsonb_build_object('record',row_to_json(new))
  );
  return new;
end $$;
drop trigger if exists app_notifications_send_web_push on public.app_notifications;
create trigger app_notifications_send_web_push after insert on public.app_notifications for each row execute function public.dispatch_app_notification_push();
