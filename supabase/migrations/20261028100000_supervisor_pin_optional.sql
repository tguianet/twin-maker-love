-- TGuia Food — PIN de supervisor opcional (desligado por padrão).
--
-- Durante o desenvolvimento o cancelamento de item exige só o motivo (continua no log
-- de auditoria). Para exigir o PIN em produção:
--   update public.organizations set require_supervisor_pin = true where id = '<id>';
-- Depende de 20261028090000_audit_controls.sql.

alter table public.organizations add column if not exists require_supervisor_pin boolean not null default false;

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

  if v_role in ('owner', 'admin')
     or not coalesce((select o.require_supervisor_pin from public.organizations o where o.id = v_order.organization_id), false) then
    -- Gerente cancela sem PIN; com o PIN desligado, quem cancela fica como responsável.
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
