alter table public.platform_branding
  add column if not exists full_logo_light_url text,
  add column if not exists full_logo_dark_url text,
  add column if not exists menu_logo_light_url text,
  add column if not exists menu_logo_dark_url text,
  add column if not exists login_logo_light_url text,
  add column if not exists login_logo_dark_url text,
  add column if not exists icon_light_url text,
  add column if not exists icon_dark_url text,
  add column if not exists favicon_light_url text,
  add column if not exists favicon_dark_url text;

update public.platform_branding set
  full_logo_light_url=coalesce(full_logo_light_url,full_logo_url),
  menu_logo_dark_url=coalesce(menu_logo_dark_url,menu_logo_url),
  login_logo_light_url=coalesce(login_logo_light_url,login_logo_url),
  favicon_light_url=coalesce(favicon_light_url,favicon_url)
where id=1;

drop function if exists public.get_platform_branding();
create function public.get_platform_branding()
returns table(
  app_name text,short_name text,full_logo_url text,menu_logo_url text,login_logo_url text,
  favicon_url text,app_icon_192_url text,app_icon_512_url text,
  full_logo_light_url text,full_logo_dark_url text,menu_logo_light_url text,menu_logo_dark_url text,
  login_logo_light_url text,login_logo_dark_url text,icon_light_url text,icon_dark_url text,
  favicon_light_url text,favicon_dark_url text
)
language sql stable security definer set search_path=public as $$
  select b.app_name,b.short_name,b.full_logo_url,b.menu_logo_url,b.login_logo_url,
    b.favicon_url,b.app_icon_192_url,b.app_icon_512_url,
    b.full_logo_light_url,b.full_logo_dark_url,b.menu_logo_light_url,b.menu_logo_dark_url,
    b.login_logo_light_url,b.login_logo_dark_url,b.icon_light_url,b.icon_dark_url,
    b.favicon_light_url,b.favicon_dark_url
  from public.platform_branding b where b.id=1
$$;
grant execute on function public.get_platform_branding() to anon,authenticated;
