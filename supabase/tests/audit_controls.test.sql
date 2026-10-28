-- Testes de comportamento da migration 20261028090000_audit_controls.sql.
-- Uso (Postgres local descartável): crie um banco vazio, rode local_supabase_stub.sql,
-- depois todas as migrations em ordem, depois este arquivo com psql. NUNCA em banco real.
\set ON_ERROR_STOP 0
\pset footer off
-- fixtures
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-000000000001','dono@x'),('00000000-0000-0000-0000-000000000002','admin@x'),
 ('00000000-0000-0000-0000-000000000003','caixa@x'),('00000000-0000-0000-0000-000000000004','garcom@x'),
 ('00000000-0000-0000-0000-000000000005','outro@x');
insert into public.organizations(id,name,slug) values ('10000000-0000-0000-0000-000000000001','TGuia','tguia'),('10000000-0000-0000-0000-000000000002','Outro','outro');
insert into public.organization_members(organization_id,user_id,role) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','owner'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','admin'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','cashier'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','waiter'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000005','owner');
insert into public.restaurant_tables(id,organization_id,number) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',1);
insert into public.products(id,organization_id,name,sale_price) values ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Heineken',10);
-- Os cenários abaixo testam o PIN ligado; o cenário T18 testa o padrão (desligado).
update public.organizations set require_supervisor_pin = true;
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub',u,false); end $$;

\echo '== garcom abre comanda e lanca 3 itens'
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
insert into public.orders(id,organization_id,table_id,created_by) values ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004');
select public.add_order_product('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1) is not null as add1;
select public.add_order_product('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1) is not null as add2;
select public.add_order_product('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1) is not null as add3;
\echo '== T1 garcom DELETE direto em item (deve falhar)'
delete from public.order_items;
\echo '== T2 garcom INSERT direto em pagamento (deve falhar)'
insert into public.order_payments(order_id,method,amount) values ('40000000-0000-0000-0000-000000000001','cash',1);
\echo '== T2b garcom UPDATE direto do preco do item (deve falhar)'
update public.order_items set unit_price=0;
\echo '== T2c garcom DELETE do pedido (deve falhar)'
delete from public.orders;
\echo '== T3 garcom cancela sem PIN (needs_pin)'
select public.cancel_order_item((select id from public.order_items order by created_at limit 1),'cliente desistiu',null);
\echo '== T4 dono define PIN; admin tenta o mesmo PIN; PIN facil'
select pg_temp.as_user('00000000-0000-0000-0000-000000000001'); select public.set_my_pin('10000000-0000-0000-0000-000000000001','2580');
select pg_temp.as_user('00000000-0000-0000-0000-000000000002'); select public.set_my_pin('10000000-0000-0000-0000-000000000001','2580');
select public.set_my_pin('10000000-0000-0000-0000-000000000001','1111');
select public.set_my_pin('10000000-0000-0000-0000-000000000001','9734'); select public.has_my_pin('10000000-0000-0000-0000-000000000001') as admin_tem_pin;
\echo '== T5 garcom cancela com PIN do dono (ok)'
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select public.cancel_order_item((select id from public.order_items order by created_at limit 1),'cliente desistiu','2580');
select count(*) filter (where cancelled_at is not null) cancelados, max(cancel_authorized_by::text) autorizado_por from public.order_items;
\echo '== T6 cancelar de novo o mesmo item'
select public.cancel_order_item((select id from public.order_items order by created_at limit 1),'de novo','2580');
\echo '== T7 garcom sem motivo'
select public.cancel_order_item((select id from public.order_items order by created_at desc limit 1),'  ','2580');
\echo '== T8 bloqueio apos 5 PINs errados'
select (public.cancel_order_item((select id from public.order_items order by created_at desc limit 1),'teste','0000'))->>'error' from generate_series(1,5);
select public.cancel_order_item((select id from public.order_items order by created_at desc limit 1),'teste','2580')->>'error' as apos_bloqueio;
\echo '== T9 usuario de outra empresa tenta cancelar (Access denied)'
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select public.cancel_order_item((select id from public.order_items order by created_at desc limit 1),'teste',null);
\echo '== T10 dono abre caixa 100, entrada 20 dinheiro'
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
insert into public.cash_sessions(id,organization_id,opened_by,opening_balance) values ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',100);
insert into public.cash_movements(session_id,organization_id,created_by,description,direction,method,amount) values ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','troco','in','cash',20);
\echo '== T11 caixa recebe comanda (2 itens validos x 10 + 10% = 22)'
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
update public.orders set status='closing' where id='40000000-0000-0000-0000-000000000001';
select public.close_order_manual('40000000-0000-0000-0000-000000000001','cash');
select status, (select amount from public.order_payments) pago from public.orders;
\echo '== T12 dono tenta fechar caixa por UPDATE direto (deve falhar)'
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
update public.cash_sessions set closed_at=now(), closed_by='00000000-0000-0000-0000-000000000001';
\echo '== T13 fechamento as cegas: contado 130 sem justificativa (esperado 142)'
select public.close_cash_session('50000000-0000-0000-0000-000000000001',130,null);
select closed_at is null as continua_aberto from public.cash_sessions;
\echo '== T14 com justificativa'
select public.close_cash_session('50000000-0000-0000-0000-000000000001',130,'faltou troco do motoboy');
select counted_cash, expected_cash, cash_difference, closing_note from public.cash_sessions;
\echo '== T14b caixa fechado nao reabre'
select public.close_cash_session('50000000-0000-0000-0000-000000000001',142,null);
\echo '== T15 garcom ve o log? (0 linhas)'
select pg_temp.as_user('00000000-0000-0000-0000-000000000004'); select count(*) from public.audit_log;
\echo '== T16 dono ve o log'
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select action, count(*), max(reason) motivo, bool_or(authorized_by is not null) autorizado from public.audit_log group by action order by action;
\echo '== T18 PIN desligado (padrao): garcom cancela so com motivo'
reset role; update public.organizations set require_supervisor_pin = false;
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
insert into public.orders(id,organization_id,table_id,created_by) values ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004');
select public.add_order_product('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001',1) is not null as add;
select public.cancel_order_item((select id from public.order_items where order_id='40000000-0000-0000-0000-000000000002'),'lancado errado',null);
select cancel_authorized_by::text as responsavel from public.order_items where order_id='40000000-0000-0000-0000-000000000002';
select public.cancel_order_item((select id from public.order_items where order_id='40000000-0000-0000-0000-000000000002'),'',null) ->> 'error' as sem_motivo;
reset role;
\echo '== T17 nem o superusuario altera o log'
update public.audit_log set reason='x'; delete from public.audit_log; truncate public.audit_log;
select count(*) total_log from public.audit_log;
