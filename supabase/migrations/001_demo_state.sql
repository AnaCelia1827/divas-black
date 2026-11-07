-- MVP de demonstração: somente dados fictícios. Execute no SQL Editor do Supabase.
create table if not exists public.divas_demo_state (
  id text primary key check (id = 'demo'),
  revision bigint not null default 0 check (revision >= 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload ->> 'schemaVersion' is not distinct from '1'),
  updated_at timestamptz not null default now()
);
alter table public.divas_demo_state enable row level security;
-- Sem políticas públicas: browser e usuários anônimos não acessam a tabela.
revoke all on public.divas_demo_state from anon, authenticated;
grant select, insert, update on public.divas_demo_state to service_role;

create or replace function public.divas_save_demo(expected_revision bigint, next_payload jsonb)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare affected integer;
begin
  if next_payload ->> 'schemaVersion' is distinct from '1' then
    raise exception 'Unsupported schema version';
  end if;
  update public.divas_demo_state
  set payload = next_payload, revision = revision + 1, updated_at = now()
  where id = 'demo' and revision = expected_revision;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;
revoke all on function public.divas_save_demo(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.divas_save_demo(bigint, jsonb) to service_role;
