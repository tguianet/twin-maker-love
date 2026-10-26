-- Impede encerramento de comandas sem recebimento integral, inclusive por UPDATE direto.
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
    select service_rate into v_service from public.organizations where id=new.organization_id;
    select coalesce(sum(unit_price * quantity),0) into v_items from public.order_items where order_id=new.id;
    v_total := round(v_items*(1+coalesce(v_service,0)/100),2);
    select coalesce(sum(amount),0) into v_paid from public.order_payments where order_id=new.id;
    if v_total <= 0 or v_paid <> v_total then
      raise exception 'Comanda nao pode ser encerrada sem pagamento integral registrado';
    end if;
    new.closed_at := coalesce(new.closed_at,now());
  end if;
  return new;
end;
$$;
drop trigger if exists orders_require_payment_on_close on public.orders;
create trigger orders_require_payment_on_close before update of status on public.orders
for each row execute function public.ensure_order_settlement();
revoke all on function public.ensure_order_settlement() from public,anon,authenticated;
