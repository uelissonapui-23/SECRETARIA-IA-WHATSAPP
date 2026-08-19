begin;

-- A política RLS "suggestions member update" continua limitando a alteração
-- aos membros da própria empresa. Este grant apenas expõe a operação à API.
grant update on table public.ai_suggestions to authenticated;

commit;
