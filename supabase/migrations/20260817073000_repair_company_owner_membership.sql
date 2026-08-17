begin;

-- Fonte de verdade de autorização: quem criou a empresa precisa permanecer owner.
-- Corrige bases criadas durante as primeiras versões do onboarding sem ampliar
-- permissões para terceiros.
insert into public.company_members(company_id, user_id, role)
select c.id, c.created_by, 'owner'::public.company_role
from public.companies c
where c.created_by is not null
on conflict (company_id, user_id)
do update set role = 'owner'::public.company_role
where public.company_members.role <> 'owner'::public.company_role;

-- Explicita privilégios das funções usadas pelo cliente autenticado.
revoke all on function public.company_role_for(uuid) from anon;
grant execute on function public.company_role_for(uuid) to authenticated;

commit;
