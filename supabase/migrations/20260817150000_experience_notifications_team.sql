begin;

alter table public.company_settings
  add column if not exists notifications_enabled boolean not null default true,
  add column if not exists daily_summary_enabled boolean not null default true,
  add column if not exists daily_summary_time time not null default '08:00',
  add column if not exists notify_overdue boolean not null default true,
  add column if not exists notify_new_suggestions boolean not null default true;

create or replace function public.get_company_team(target_company_id uuid)
returns table (
  user_id uuid,
  display_name text,
  role public.company_role,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_company_member(target_company_id) then
    raise exception 'not_company_member' using errcode = '42501';
  end if;

  return query
  select cm.user_id,
         coalesce(nullif(trim(p.display_name), ''), 'Membro da equipe') as display_name,
         cm.role,
         cm.created_at as joined_at
  from public.company_members cm
  left join public.profiles p on p.id = cm.user_id
  where cm.company_id = target_company_id
  order by case cm.role when 'owner' then 0 when 'admin' then 1 else 2 end, cm.created_at;
end;
$$;

grant execute on function public.get_company_team(uuid) to authenticated;

commit;
