-- Apply in a dedicated homologation database before enabling online order items.
-- The SECURITY DEFINER function enforces both membership and server-side product price.
create or replace function public.add_order_product(
  p_order_id uuid,
  p_product_id uuid,
  p_quantity integer
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_product public.products%rowtype;
  v_item_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 100 then
    raise exception 'Quantity must be between 1 and 100';
  end if;
  select * into v_order from public.orders
  where id = p_order_id and status = 'open' for update;
  if not found then raise exception 'Order not open'; end if;
  if not public.is_org_member(v_order.organization_id) then
    raise exception 'Access denied';
  end if;
  select * into v_product from public.products
  where id = p_product_id and organization_id = v_order.organization_id and active = true;
  if not found then raise exception 'Product unavailable'; end if;
  insert into public.order_items(order_id, product_id, product_name, unit_price, quantity, created_by)
  values (v_order.id, v_product.id, v_product.name, v_product.sale_price, p_quantity, (select auth.uid()))
  returning id into v_item_id;
  return v_item_id;
end;
$$;
revoke all on function public.add_order_product(uuid,uuid,integer) from public, anon;
grant execute on function public.add_order_product(uuid,uuid,integer) to authenticated;
