-- TGuia Food: estoque da geladeira isolado por estabelecimento.
-- Executar em ambiente de homologacao antes de aplicar em producao.
create table if not exists public.refrigerator_stock (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, product_id)
);

create table if not exists public.refrigerator_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  delta integer not null check (delta <> 0),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists refrigerator_movements_org_date_idx
on public.refrigerator_movements (organization_id, created_at desc);

alter table public.refrigerator_stock enable row level security;
alter table public.refrigerator_movements enable row level security;

create policy refrigerator_stock_member_read
on public.refrigerator_stock for select to authenticated
using (public.is_org_member(organization_id));

create policy refrigerator_movements_member_read
on public.refrigerator_movements for select to authenticated
using (public.is_org_member(organization_id));

-- Escritas apenas via funcao transacional, nunca diretamente do navegador.
revoke insert, update, delete on public.refrigerator_stock from anon, authenticated;
revoke insert, update, delete on public.refrigerator_movements from anon, authenticated;

create or replace function public.register_refrigerator_movement(
  p_organization_id uuid,
  p_product_id uuid,
  p_delta integer,
  p_note text default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current integer;
  v_next integer;
begin
  if auth.uid() is null or not public.can_manage_org(p_organization_id) then
    raise exception 'Sem permissao para movimentar o estoque';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'Quantidade deve ser diferente de zero';
  end if;
  if not exists (
    select 1 from public.products p
    where p.id = p_product_id and p.organization_id = p_organization_id and p.active = true
  ) then
    raise exception 'Produto invalido para este estabelecimento';
  end if;

  insert into public.refrigerator_stock (organization_id, product_id, quantity)
  values (p_organization_id, p_product_id, 0)
  on conflict (organization_id, product_id) do nothing;

  select quantity into v_current from public.refrigerator_stock
    where organization_id = p_organization_id and product_id = p_product_id
    for update;
  v_next := v_current + p_delta;
  if v_next < 0 then
    raise exception 'Estoque insuficiente';
  end if;

  update public.refrigerator_stock
    set quantity = v_next, updated_at = now()
    where organization_id = p_organization_id and product_id = p_product_id;

  insert into public.refrigerator_movements
    (organization_id, product_id, delta, note, created_by)
  values (p_organization_id, p_product_id, p_delta, left(p_note, 250), auth.uid());

  return v_next;
end;
$$;
revoke all on function public.register_refrigerator_movement(uuid, uuid, integer, text) from public, anon;
grant execute on function public.register_refrigerator_movement(uuid, uuid, integer, text) to authenticated;
