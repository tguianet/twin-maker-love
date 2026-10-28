-- TGuia Food — controles de auditoria (fase 1)
--
-- Origem: auditoria do PDV anterior (Consumer) encontrou exclusões e cancelamentos
-- sem rastreio, login compartilhado e caixa nunca conferido. Esta migration:
--   1. cria um log de auditoria somente-inserção, alimentado por triggers no banco;
--   2. troca o DELETE físico de itens por cancelamento com motivo, e exige PIN de um
--      supervisor (owner/admin) diferente de quem pede quando o pedido vem da equipe;
--   3. cria o PIN de autorização por usuário (bcrypt), sem permitir PIN repetido;
--   4. implementa o fechamento de caixa às cegas (valor contado x esperado no servidor);
--   5. bloqueia escrita direta em itens, pagamentos e caixa: só pelas funções do servidor.
--
-- Aplicar somente no banco exclusivo do TGuia Food, depois das migrations anteriores.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Log de auditoria (imutável)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  -- Nulo apenas quando a organização não pode ser resolvida (ex.: exclusão em cascata).
  organization_id uuid references public.organizations(id) on delete set null,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  authorized_by uuid,
  action text not null,
  entity text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  reason text
);
create index if not exists audit_log_org_time_idx on public.audit_log(organization_id, occurred_at desc);
create index if not exists audit_log_org_action_idx on public.audit_log(organization_id, action, occurred_at desc);

alter table public.audit_log enable row level security;
drop policy if exists audit_log_manager_read on public.audit_log;
create policy audit_log_manager_read on public.audit_log for select to authenticated
  using (organization_id is not null and public.can_manage_org(organization_id));
revoke insert, update, delete, truncate on public.audit_log from public, anon, authenticated;

create or replace function public.audit_log_is_append_only()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'audit_log é somente inserção';
end;
$$;
drop trigger if exists audit_log_no_update_delete on public.audit_log;
create trigger audit_log_no_update_delete before update or delete on public.audit_log
  for each row execute function public.audit_log_is_append_only();
drop trigger if exists audit_log_no_truncate on public.audit_log;
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function public.audit_log_is_append_only();

-- Gravação centralizada. Uso interno (triggers e funções SECURITY DEFINER).
create or replace function public.write_audit(
  p_organization_id uuid, p_action text, p_entity text, p_entity_id text,
  p_old jsonb, p_new jsonb, p_reason text default null, p_authorized_by uuid default null
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.audit_log(organization_id, actor_id, authorized_by, action, entity, entity_id, old_data, new_data, reason)
  values (p_organization_id, auth.uid(), p_authorized_by, p_action, p_entity, p_entity_id, p_old, p_new, p_reason);
end;
$$;
revoke all on function public.write_audit(uuid, text, text, text, jsonb, jsonb, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Itens: cancelamento lógico (nunca DELETE)
-- ---------------------------------------------------------------------------
alter table public.order_items add column if not exists cancelled_at timestamptz;
alter table public.order_items add column if not exists cancelled_by uuid references auth.users(id) on delete set null;
alter table public.order_items add column if not exists cancel_reason text;
alter table public.order_items add column if not exists cancel_authorized_by uuid references auth.users(id) on delete set null;
alter table public.order_items drop constraint if exists order_items_cancel_consistency;
alter table public.order_items add constraint order_items_cancel_consistency check (
  (cancelled_at is null and cancelled_by is null and cancel_reason is null and cancel_authorized_by is null)
  or (cancelled_at is not null and cancelled_by is not null and length(trim(cancel_reason)) >= 3)
);
create index if not exists order_items_active_idx on public.order_items(order_id) where cancelled_at is null;

-- Um item cancelado não volta a valer, e seus dados de cobrança não mudam depois.
create or replace function public.guard_order_item_update()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.cancelled_at is not null then
    raise exception 'Item cancelado não pode ser alterado';
  end if;
  if new.order_id <> old.order_id or new.unit_price <> old.unit_price
     or new.product_id is distinct from old.product_id or new.product_name <> old.product_name then
    raise exception 'Dados de cobrança do item são imutáveis';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_order_item_update on public.order_items;
create trigger guard_order_item_update before update on public.order_items
  for each row execute function public.guard_order_item_update();

-- Totais passam a ignorar itens cancelados.
create or replace function public.ensure_order_settlement()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_items numeric(12,2);
  v_paid numeric(12,2);
  v_service numeric(5,2);
  v_total numeric(12,2);
begin
  if new.status = 'closed' and old.status is distinct from new.status then
    select service_rate into v_service from public.organizations where id = new.organization_id;
    select coalesce(sum(unit_price * quantity), 0) into v_items
      from public.order_items where order_id = new.id and cancelled_at is null;
    v_total := round(v_items * (1 + coalesce(v_service, 0) / 100), 2);
    select coalesce(sum(amount), 0) into v_paid from public.order_payments where order_id = new.id;
    if v_total <= 0 or v_paid <> v_total then
      raise exception 'Comanda nao pode ser encerrada sem pagamento integral registrado';
    end if;
    new.closed_at := coalesce(new.closed_at, now());
  end if;
  return new;
end;
$$;
revoke all on function public.ensure_order_settlement() from public, anon, authenticated;

create or replace function public.close_order_manual(p_order_id uuid, p_method text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
 v_order public.orders%rowtype;
 v_total numeric(12,2);
 v_rate numeric(5,2);
 v_role public.member_role;
 v_session uuid;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 if p_method not in ('cash','pix','debit','credit') then raise exception 'Invalid payment method'; end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found or v_order.status <> 'closing' then raise exception 'Order must be awaiting payment'; end if;
 select role into v_role from public.organization_members
 where organization_id=v_order.organization_id and user_id=(select auth.uid()) and active=true;
 if v_role is null or v_role not in ('owner','admin','cashier') then raise exception 'Cashier permission required'; end if;
 select id into v_session from public.cash_sessions where organization_id=v_order.organization_id and closed_at is null for update;
 if v_session is null then raise exception 'Abra o caixa antes de receber esta comanda'; end if;
 select service_rate into v_rate from public.organizations where id=v_order.organization_id;
 select round(coalesce(sum(unit_price*quantity),0)*(1+coalesce(v_rate,0)/100),2)
 into v_total from public.order_items where order_id=p_order_id and cancelled_at is null;
 if v_total is null or v_total<=0 then raise exception 'Cannot close empty order'; end if;
 if exists (select 1 from public.order_payments where order_id=p_order_id) then raise exception 'Existing payment requires reconciliation'; end if;
 insert into public.order_payments(order_id,method,amount,created_by,cash_session_id)
 values (p_order_id,p_method,v_total,(select auth.uid()),v_session);
 update public.orders set status='closed',closed_at=now() where id=p_order_id;
end;
$$;
revoke all on function public.close_order_manual(uuid,text) from public,anon;
grant execute on function public.close_order_manual(uuid,text) to authenticated;

-- Escrita direta bloqueada: itens só entram/saem pelas funções do servidor
-- (add_order_product, sell_refrigerator_to_customer, cancel_order_item);
-- pagamentos só por close_order_manual; pedidos nunca são apagados.
revoke insert, update, delete on public.order_items from anon, authenticated;
revoke insert, update, delete on public.order_payments from anon, authenticated;
revoke delete on public.orders from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. PIN de autorização (supervisor)
-- ---------------------------------------------------------------------------
create table if not exists public.staff_pins (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pin_hash text not null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
alter table public.staff_pins enable row level security;
-- Sem políticas: ninguém lê ou grava direto; só pelas funções abaixo.
revoke all on public.staff_pins from public, anon, authenticated;

create or replace function public.set_my_pin(p_organization_id uuid, p_pin text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_other record;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_org_member(p_organization_id) then raise exception 'Access denied'; end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then raise exception 'O PIN deve ter de 4 a 6 números'; end if;
  if p_pin ~ '^(.)\1+$' or p_pin in ('1234','12345','123456','4321','654321') then
    raise exception 'PIN muito fácil. Escolha outro';
  end if;
  -- Cada pessoa precisa de um PIN próprio (no sistema antigo duas contas tinham a mesma senha).
  for v_other in
    select pin_hash from public.staff_pins
    where organization_id = p_organization_id and user_id <> auth.uid()
  loop
    if v_other.pin_hash = extensions.crypt(p_pin, v_other.pin_hash) then
      raise exception 'Este PIN já está em uso. Escolha outro';
    end if;
  end loop;
  insert into public.staff_pins(organization_id, user_id, pin_hash, updated_at)
  values (p_organization_id, auth.uid(), extensions.crypt(p_pin, extensions.gen_salt('bf', 8)), now())
  on conflict (organization_id, user_id)
  do update set pin_hash = excluded.pin_hash, updated_at = now();
  perform public.write_audit(p_organization_id, 'pin.changed', 'staff_pins', auth.uid()::text, null, null, null, null);
end;
$$;
revoke all on function public.set_my_pin(uuid, text) from public, anon;
grant execute on function public.set_my_pin(uuid, text) to authenticated;

create or replace function public.has_my_pin(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.staff_pins
                 where organization_id = p_organization_id and user_id = auth.uid());
$$;
revoke all on function public.has_my_pin(uuid) from public, anon;
grant execute on function public.has_my_pin(uuid) to authenticated;

-- Encontra o supervisor (owner/admin ativo, diferente de quem pede) dono do PIN.
create or replace function public.resolve_supervisor_pin(p_organization_id uuid, p_pin text)
returns uuid language plpgsql stable security definer set search_path = ''
as $$
declare
  v_row record;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then return null; end if;
  for v_row in
    select p.user_id, p.pin_hash
    from public.staff_pins p
    join public.organization_members m
      on m.organization_id = p.organization_id and m.user_id = p.user_id
    where p.organization_id = p_organization_id
      and m.active and m.role in ('owner', 'admin')
      and p.user_id <> auth.uid()
  loop
    if v_row.pin_hash = extensions.crypt(p_pin, v_row.pin_hash) then
      return v_row.user_id;
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function public.resolve_supervisor_pin(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Cancelamento de item com motivo
-- ---------------------------------------------------------------------------
-- Retorna jsonb {ok, error?}. Não usa exceção para PIN errado, para que a tentativa
-- fique registrada no log (uma exceção desfaria o registro).
create or replace function public.cancel_order_item(p_item_id uuid, p_reason text, p_supervisor_pin text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_item public.order_items%rowtype;
  v_order public.orders%rowtype;
  v_role public.member_role;
  v_authorizer uuid;
  v_failures integer;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(v_reason) < 3 then
    return jsonb_build_object('ok', false, 'error', 'Informe o motivo do cancelamento');
  end if;
  select * into v_item from public.order_items where id = p_item_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Item não encontrado'); end if;
  select * into v_order from public.orders where id = v_item.order_id for update;
  select role into v_role from public.organization_members
    where organization_id = v_order.organization_id and user_id = auth.uid() and active;
  if v_role is null then raise exception 'Access denied'; end if;
  if v_item.cancelled_at is not null then
    return jsonb_build_object('ok', false, 'error', 'Item já cancelado');
  end if;
  if v_order.status not in ('open', 'closing') then
    return jsonb_build_object('ok', false, 'error', 'Só é possível cancelar itens de comandas abertas');
  end if;
  if exists (select 1 from public.order_payments where order_id = v_order.id) then
    return jsonb_build_object('ok', false, 'error', 'Comanda já tem pagamento registrado');
  end if;

  if v_role in ('owner', 'admin') then
    v_authorizer := auth.uid();
  else
    select count(*) into v_failures from public.audit_log
      where actor_id = auth.uid() and action = 'auth.pin_failed'
        and occurred_at > now() - interval '10 minutes';
    if v_failures >= 5 then
      return jsonb_build_object('ok', false, 'error', 'Muitas tentativas de PIN. Aguarde 10 minutos');
    end if;
    if nullif(trim(coalesce(p_supervisor_pin, '')), '') is null then
      return jsonb_build_object('ok', false, 'error', 'Peça a um supervisor para digitar o PIN', 'needs_pin', true);
    end if;
    v_authorizer := public.resolve_supervisor_pin(v_order.organization_id, p_supervisor_pin);
    if v_authorizer is null then
      perform public.write_audit(v_order.organization_id, 'auth.pin_failed', 'order_items', v_item.id::text,
        null, jsonb_build_object('order_id', v_order.id), v_reason, null);
      return jsonb_build_object('ok', false, 'error', 'PIN de supervisor inválido', 'needs_pin', true);
    end if;
  end if;

  update public.order_items
     set cancelled_at = now(), cancelled_by = auth.uid(),
         cancel_reason = v_reason, cancel_authorized_by = v_authorizer
   where id = v_item.id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.cancel_order_item(uuid, text, text) from public, anon;
grant execute on function public.cancel_order_item(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Caixa: fechamento às cegas
-- ---------------------------------------------------------------------------
alter table public.cash_sessions add column if not exists counted_cash numeric(12,2);
alter table public.cash_sessions add column if not exists expected_cash numeric(12,2);
alter table public.cash_sessions add column if not exists cash_difference numeric(12,2);
alter table public.cash_sessions drop constraint if exists cash_sessions_blind_close;
alter table public.cash_sessions add constraint cash_sessions_blind_close check (
  closed_at is null
  -- Turnos fechados antes desta migration não têm contagem registrada.
  or counted_cash is null and expected_cash is null and cash_difference is null
  or (counted_cash >= 0 and expected_cash is not null and cash_difference = counted_cash - expected_cash)
);

-- Fechamento agora só pela função (que calcula o esperado no servidor).
revoke update on public.cash_sessions from anon, authenticated;

create or replace function public.close_cash_session(p_session_id uuid, p_counted_cash numeric, p_note text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_session public.cash_sessions%rowtype;
  v_expected numeric(12,2);
  v_difference numeric(12,2);
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  c_tolerance constant numeric := 10.00;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_session from public.cash_sessions where id = p_session_id for update;
  if not found then raise exception 'Caixa não encontrado'; end if;
  if not public.can_manage_org(v_session.organization_id) then raise exception 'Sem permissão para fechar o caixa'; end if;
  if v_session.closed_at is not null then
    return jsonb_build_object('ok', false, 'error', 'Este caixa já foi fechado em outro terminal');
  end if;
  if p_counted_cash is null or p_counted_cash < 0 or p_counted_cash > 10000000 then
    return jsonb_build_object('ok', false, 'error', 'Informe o valor contado em dinheiro');
  end if;

  select round(
      v_session.opening_balance
    + coalesce((select sum(case when m.direction = 'in' then m.amount else -m.amount end)
                  from public.cash_movements m
                 where m.session_id = v_session.id and m.method = 'cash'), 0)
    + coalesce((select sum(p.amount) from public.order_payments p
                 where p.cash_session_id = v_session.id and p.method = 'cash'), 0), 2)
    into v_expected;
  v_difference := round(p_counted_cash, 2) - v_expected;

  -- Não revela o valor esperado antes do fechamento: só pede justificativa.
  if abs(v_difference) > c_tolerance and v_note is null then
    return jsonb_build_object('ok', false, 'needs_note', true,
      'error', 'A contagem não confere com o sistema (diferença acima de R$ 10,00). Recontar ou informar uma justificativa');
  end if;

  update public.cash_sessions
     set closed_at = now(), closed_by = auth.uid(), closing_note = v_note,
         counted_cash = round(p_counted_cash, 2), expected_cash = v_expected, cash_difference = v_difference
   where id = v_session.id;

  return jsonb_build_object('ok', true, 'counted', round(p_counted_cash, 2),
    'expected', v_expected, 'difference', v_difference);
end;
$$;
revoke all on function public.close_cash_session(uuid, numeric, text) from public, anon;
grant execute on function public.close_cash_session(uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Triggers que alimentam o log
-- ---------------------------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_org uuid;
  v_action text;
  v_reason text;
  v_authorized uuid;
begin
  -- Organização da linha (direta ou via pedido).
  if v_row ? 'organization_id' then
    v_org := (v_row ->> 'organization_id')::uuid;
  elsif v_row ? 'order_id' then
    select o.organization_id into v_org from public.orders o where o.id = (v_row ->> 'order_id')::uuid;
  end if;

  v_action := case tg_table_name
    when 'orders' then case tg_op
      when 'INSERT' then 'order.opened'
      when 'DELETE' then 'order.deleted'
      else case
        when v_old ->> 'status' is distinct from v_new ->> 'status' then 'order.status_' || (v_new ->> 'status')
        when v_old ->> 'table_id' is distinct from v_new ->> 'table_id' then 'order.table_changed'
        when v_old ->> 'customer_id' is distinct from v_new ->> 'customer_id'
          or v_old ->> 'customer_name' is distinct from v_new ->> 'customer_name' then 'order.customer_changed'
        else null end
      end
    when 'order_items' then case tg_op
      when 'INSERT' then 'item.added'
      when 'DELETE' then 'item.deleted'
      else case
        when v_old ->> 'cancelled_at' is null and v_new ->> 'cancelled_at' is not null then 'item.cancelled'
        when v_old ->> 'quantity' is distinct from v_new ->> 'quantity' then 'item.quantity_changed'
        else null end
      end
    when 'order_payments' then case tg_op when 'INSERT' then 'payment.received' when 'DELETE' then 'payment.deleted' else 'payment.changed' end
    when 'cash_sessions' then case
      when tg_op = 'INSERT' then 'cash.opened'
      when v_old ->> 'closed_at' is null and v_new ->> 'closed_at' is not null then 'cash.closed'
      else 'cash.changed' end
    when 'cash_movements' then case when v_row ->> 'direction' = 'in' then 'cash.deposit' else 'cash.withdrawal' end
    when 'products' then case tg_op
      when 'INSERT' then 'product.created'
      when 'DELETE' then 'product.deleted'
      else case
        when v_old ->> 'sale_price' is distinct from v_new ->> 'sale_price' then 'product.price_changed'
        when v_old ->> 'active' is distinct from v_new ->> 'active' then 'product.active_changed'
        when v_old ->> 'name' is distinct from v_new ->> 'name' then 'product.renamed'
        else null end
      end
    when 'customer_credit_ledger' then 'credit.' || (v_row ->> 'entry_type')
    when 'organization_members' then case tg_op
      when 'INSERT' then 'member.added'
      when 'DELETE' then 'member.removed'
      else 'member.changed' end
    else lower(tg_table_name) || '.' || lower(tg_op)
  end;

  if v_action is null then
    return null; -- alteração sem relevância de auditoria (ex.: updated_at)
  end if;

  if tg_table_name = 'order_items' and v_action = 'item.cancelled' then
    v_reason := v_new ->> 'cancel_reason';
    v_authorized := (v_new ->> 'cancel_authorized_by')::uuid;
  elsif tg_table_name = 'cash_sessions' and v_action = 'cash.closed' then
    v_reason := v_new ->> 'closing_note';
  end if;

  perform public.write_audit(v_org, v_action, tg_table_name, coalesce(v_row ->> 'id', v_row ->> 'user_id'),
    v_old, v_new, v_reason, v_authorized);
  return null;
end;
$$;
revoke all on function public.audit_row_change() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['orders', 'order_items', 'order_payments', 'cash_sessions', 'cash_movements',
                           'products', 'customer_credit_ledger', 'organization_members']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists audit_row_change on public.%I', t);
      execute format('create trigger audit_row_change after insert or update or delete on public.%I
                        for each row execute function public.audit_row_change()', t);
    end if;
  end loop;
end;
$$;
