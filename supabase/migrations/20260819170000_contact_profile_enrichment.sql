alter table public.contacts
  add column if not exists home_address text,
  add column if not exists work_address text,
  add column if not exists store_address text,
  add column if not exists company_name text,
  add column if not exists profile_updated_at timestamptz;

-- Um LID é um identificador interno do WhatsApp, não um telefone.
update public.contacts
set phone = null,
    updated_at = now()
where whatsapp_id like 'pilot:%@lid'
  and phone = substring(whatsapp_id from 'pilot:([0-9]+)@lid');

grant select, insert, update on table public.contacts to service_role;
