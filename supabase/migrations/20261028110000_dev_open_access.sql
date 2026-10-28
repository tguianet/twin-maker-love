-- TGuia Food — acesso sem tela de login durante o desenvolvimento.
--
-- O site entra sozinho com um usuário anônimo do Supabase (Authentication → Sign In /
-- Providers → "Allow anonymous sign-ins" precisa estar ligado) e esta função vincula esse
-- usuário ao restaurante marcado com dev_open_access, como owner. Assim todas as regras de
-- segurança (RLS e funções do servidor) continuam valendo, só que sem pedir e-mail e senha.
--
-- ANTES DE USAR NO RESTAURANTE DE VERDADE, desligar:
--   update public.organizations set dev_open_access = false;
--   update public.organization_members set active = false
--    where user_id in (select id from auth.users where is_anonymous);
-- e desligar "Allow anonymous sign-ins" no Supabase.

alter table public.organizations add column if not exists dev_open_access boolean not null default false;

-- Fase de desenvolvimento: o restaurante existente fica aberto.
update public.organizations set dev_open_access = true;

create or replace function public.join_dev_organization()
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  -- Já vinculado (usuário real ou anônimo de uma visita anterior).
  select m.organization_id into v_org
    from public.organization_members m
   where m.user_id = auth.uid() and m.active
   order by m.created_at
   limit 1;
  if v_org is not null then return v_org; end if;

  select o.id into v_org from public.organizations o
   where o.dev_open_access
   order by o.created_at
   limit 1;
  if v_org is null then return null; end if;

  insert into public.organization_members(organization_id, user_id, role, active)
  values (v_org, auth.uid(), 'owner', true)
  on conflict (organization_id, user_id) do update set active = true, role = 'owner';
  return v_org;
end;
$$;
revoke all on function public.join_dev_organization() from public, anon;
grant execute on function public.join_dev_organization() to authenticated;
