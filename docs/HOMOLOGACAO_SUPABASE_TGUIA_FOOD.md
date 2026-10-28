# TGuia Food — homologação do banco compartilhado

## Estado conhecido
O Lovable informou que o banco integrado deste projeto está desativado.
Os bancos acessíveis identificados como `manu.menu` e `jf-aliancas` não foram confirmados como pertencentes ao TGuia Food.
**Não execute migrations nesses projetos sem confirmação explícita da identidade do banco.**

## Pré-requisitos para ativar
1. Criar ou identificar um projeto Supabase **exclusivo** para TGuia Food.
2. Configurar no ambiente de homologação as variáveis públicas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, sem expor service_role.
3. Executar as migrações do repositório na ordem de versionamento, começando por `20260830010000_initial_restaurant_schema.sql`.
4. Validar organizações, perfis, tabelas, produtos, RLS e os privilégios da função `add_order_product`.
5. Testar login com dois usuários de uma mesma organização, uma organização distinta e usuário anônimo.
6. Verificar que um usuário não pode alterar pedidos de outra organização; que itens de produtos inativos são recusados; e que preços inseridos vêm do banco.
7. Só então habilitar por configuração controlada os lançamentos online. Hoje estão **deliberadamente desativados** em `src/routes/comandas-online.tsx`.
8. Não habilitar pagamentos reais nem dedução automática de estoque nesta etapa.

## Consultas de diagnóstico (somente leitura)
Execute apenas no banco comprovadamente exclusivo do TGuia Food.

```sql
select to_regclass('public.organizations') as organizations,
       to_regclass('public.orders') as orders,
       to_regclass('public.order_items') as order_items,
       to_regclass('public.products') as products;

select to_regprocedure('public.add_order_product(uuid,uuid,integer)') as function_installed;

select n.nspname, c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('organizations','organization_members','orders','order_items','products','restaurant_tables');

select has_function_privilege('anon', 'public.add_order_product(uuid,uuid,integer)', 'execute') as anon_can_execute,
       has_function_privilege('authenticated', 'public.add_order_product(uuid,uuid,integer)', 'execute') as authenticated_can_execute;
```

A existência da função e das políticas **não comprova** segurança funcional: testes autenticados com organizações diferentes continuam obrigatórios.

## Controles de auditoria (migration `20261028090000_audit_controls.sql`)
Aplicar **depois** de todas as anteriores, no banco exclusivo do TGuia Food (SQL Editor do Supabase).

O que muda no banco:
- `audit_log`: registro somente-inserção (nem o administrador apaga ou altera) de pedidos, itens, pagamentos, caixa, produtos, fiado e membros. Só owner/admin leem.
- Itens não são mais apagados: `cancel_order_item(item, motivo, pin)` marca o item como cancelado com motivo, quem cancelou e quem autorizou. Garçom e caixa precisam do PIN de um owner/admin **diferente** deles. 5 PINs errados em 10 minutos bloqueiam novas tentativas.
- `set_my_pin` / `has_my_pin`: PIN pessoal de 4 a 6 números (bcrypt), sem PINs óbvios e sem repetir o PIN de outra pessoa.
- Escrita direta bloqueada em `order_items`, `order_payments` e `cash_sessions`, e DELETE bloqueado em `orders`: tudo passa pelas funções do servidor.
- `close_cash_session(caixa, contado, justificativa)`: fechamento às cegas. O esperado em dinheiro é calculado no servidor; diferença acima de R$ 10,00 exige justificativa; contado, esperado e diferença ficam gravados.
- `close_order_manual` e a trava de encerramento passam a ignorar itens cancelados.

Teste local: `supabase/tests/audit_controls.test.sql` (instruções no cabeçalho). Depois de aplicar no banco real, testar com um usuário garçom: cancelar item sem PIN (deve pedir PIN), com PIN do dono (deve cancelar) e fechar o caixa informando o valor contado.
