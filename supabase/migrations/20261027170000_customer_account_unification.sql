-- TGuia Food: foundation for unified customer accounts and refrigerator sales.
-- STAGING ONLY until authentication, RLS, concurrency and hardware integration pass review.
create table if not exists public.customers (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 full_name text not null check (length(trim(full_name))>=2),
 phone text,
 active boolean not null default true,
 credit_enabled boolean not null default false,
 credit_limit numeric(12,2) not null default 0 check (credit_limit>=0),
 created_at timestamptz not null default now(),
 unique (organization_id,id)
);
create index if not exists customers_org_name_idx on public.customers(organization_id,full_name);
alter table public.orders add column if not exists customer_id uuid;
alter table public.orders add constraint orders_customer_same_org_fk
 foreign key (organization_id,customer_id) references public.customers(organization_id,id);
create unique index if not exists one_active_customer_order
 on public.orders(organization_id,customer_id)
 where customer_id is not null and status in ('open','closing');
create table if not exists public.customer_credit_ledger (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 customer_id uuid not null,
 order_id uuid references public.orders(id),
 amount numeric(12,2) not null check (amount<>0),
 entry_type text not null check (entry_type in ('debit','payment','adjustment')),
 reference text not null,
 created_at timestamptz not null default now(),
 created_by uuid references auth.users(id),
 foreign key (organization_id,customer_id) references public.customers(organization_id,id),
 unique (organization_id,reference)
);
alter table public.customers enable row level security;
alter table public.customer_credit_ledger enable row level security;
create policy customers_staff_read on public.customers for select to authenticated
 using (public.is_org_member(organization_id));
create policy customers_admin_insert on public.customers for insert to authenticated
 with check (public.can_manage_org(organization_id));
create policy customers_admin_update on public.customers for update to authenticated
 using (public.can_manage_org(organization_id)) with check (public.can_manage_org(organization_id));
create policy credit_ledger_staff_read on public.customer_credit_ledger for select to authenticated
 using (public.can_manage_org(organization_id));
-- No direct ledger writes: server-side accounting functions are required.
revoke insert,update,delete on public.customer_credit_ledger from anon,authenticated;

-- Atomic sale: order creation/lookup, debit at product catalogue price and stock update.
-- This function is staff-initiated for now. Customer PIN/passkeys and hardware access
-- must be verified by a trusted service, never by granting the kiosk a staff session.
create or replace function public.sell_refrigerator_to_customer(
 p_organization_id uuid,p_customer_id uuid,p_product_id uuid,p_quantity integer,
 p_request_id uuid
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare
 v_order uuid; v_product public.products%rowtype; v_stock integer; v_item uuid;
begin
 if auth.uid() is null or not public.can_manage_org(p_organization_id) then
  raise exception 'Not authorized for refrigerator sale';
 end if;
 if p_quantity is null or p_quantity<1 or p_quantity>100 then raise exception 'Invalid quantity'; end if;
 if p_request_id is null then raise exception 'Request identifier required'; end if;
 if not exists(select 1 from public.customers where id=p_customer_id and organization_id=p_organization_id and active) then
  raise exception 'Unknown or inactive customer';
 end if;
 select * into v_product from public.products
  where id=p_product_id and organization_id=p_organization_id and active;
 if not found then raise exception 'Product unavailable'; end if;
 -- Serialize all refrigerator sales for this customer to prevent duplicate open orders.
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||p_customer_id::text,0));
 select id into v_order from public.orders
  where organization_id=p_organization_id and customer_id=p_customer_id and status='open' for update;
 if v_order is null then
  if exists(select 1 from public.orders where organization_id=p_organization_id and customer_id=p_customer_id and status='closing') then
   raise exception 'Customer account is awaiting settlement';
  end if;
  insert into public.orders(organization_id,customer_id,order_type,status,customer_name,created_by)
   select p_organization_id,c.id,'counter','open',c.full_name,auth.uid()
   from public.customers c where c.id=p_customer_id returning id into v_order;
 end if;
 -- Request idempotency recorded in order_items.notes with enforced unique index below.
 select id into v_item from public.order_items
   where order_id=v_order and notes='refrigerator-request:'||p_request_id::text limit 1;
 if v_item is not null then return v_item; end if;
 insert into public.refrigerator_stock(organization_id,product_id,quantity)
  values(p_organization_id,p_product_id,0)
  on conflict(organization_id,product_id) do nothing;
 select quantity into v_stock from public.refrigerator_stock
  where organization_id=p_organization_id and product_id=p_product_id for update;
 if v_stock<p_quantity then raise exception 'Insufficient refrigerator inventory'; end if;
 update public.refrigerator_stock set quantity=quantity-p_quantity,updated_at=now()
  where organization_id=p_organization_id and product_id=p_product_id;
 insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,notes,created_by)
  values(v_order,p_product_id,v_product.name,v_product.sale_price,p_quantity,
   'refrigerator-request:'||p_request_id::text,auth.uid()) returning id into v_item;
 insert into public.refrigerator_movements(organization_id,product_id,delta,note,created_by)
  values(p_organization_id,p_product_id,-p_quantity,'Venda ligada a pedido '||v_order::text,auth.uid());
 return v_item;
end; $$;
create unique index if not exists order_items_refrigerator_request_unique
 on public.order_items(notes) where notes like 'refrigerator-request:%';
revoke all on function public.sell_refrigerator_to_customer(uuid,uuid,uuid,integer,uuid) from public,anon;
grant execute on function public.sell_refrigerator_to_customer(uuid,uuid,uuid,integer,uuid) to authenticated;
