alter table public.order_payments add column if not exists cash_session_id uuid references public.cash_sessions(id);
create index if not exists order_payments_cash_session_idx on public.order_payments(cash_session_id);
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
 into v_total from public.order_items where order_id=p_order_id;
 if v_total is null or v_total<=0 then raise exception 'Cannot close empty order'; end if;
 if exists (select 1 from public.order_payments where order_id=p_order_id) then raise exception 'Existing payment requires reconciliation'; end if;
 insert into public.order_payments(order_id,method,amount,created_by,cash_session_id)
 values (p_order_id,p_method,v_total,(select auth.uid()),v_session);
 update public.orders set status='closed',closed_at=now() where id=p_order_id;
end;
$$;
revoke all on function public.close_order_manual(uuid,text) from public,anon;
grant execute on function public.close_order_manual(uuid,text) to authenticated;