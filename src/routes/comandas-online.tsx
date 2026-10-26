import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/comandas-online")({ component: SharedOrdersPage });

type Membership = { organization_id: string; organizations: { name: string } | null };
type Order = {
  id: string; order_number: number; status: string; customer_name: string | null;
  opened_at: string; table_id: string | null;
  order_items: { id: string; product_name: string; quantity: number; unit_price: number }[];
};
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
function SharedOrdersPage() {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [org, setOrg] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        setError("Supabase não configurado neste ambiente."); setAuthReady(true); return;
      }
      try {
        const { supabase } = await import("../lib/supabase");
        if (cancelled) return;
        setClient(supabase);
        const { data: userResult, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userResult.user) { setError("Entre no sistema pela Gestão para consultar as comandas compartilhadas."); return; }
        const { data, error: memberError } = await supabase.from("organization_members")
          .select("organization_id, organizations(name)").eq("user_id", userResult.user.id).eq("active", true);
        if (memberError) throw memberError;
        if (cancelled) return;
        const memberships = (data || []) as unknown as Membership[];
        setMemberships(memberships);
        setOrg(memberships[0]?.organization_id || "");
        if (memberships.length === 0) setError("Sua conta não está vinculada a uma organização ativa.");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha na autenticação.");
      } finally { if (!cancelled) setAuthReady(true); }
    }
    void init();
    return () => { cancelled = true; };
  }, []);
  const refresh = async () => {
    if (!client || !org) return;
    setLoading(true); setError("");
    try {
      const [ordersResult, tablesResult] = await Promise.all([
        client.from("orders").select("id, order_number, status, customer_name, opened_at, table_id, order_items(id, product_name, quantity, unit_price)")
          .eq("organization_id", org).in("status", ["open", "closing"]).order("opened_at", { ascending: false }).limit(200),
        client.from("restaurant_tables").select("id, number").eq("organization_id", org),
      ]);
      if (ordersResult.error) throw ordersResult.error;
      if (tablesResult.error) throw tablesResult.error;
      setOrders((ordersResult.data || []) as Order[]);
      setTables(Object.fromEntries((tablesResult.data || []).map(t => [t.id, t.number])));
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao consultar comandas."); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    if (!client || !org) return;
    // Refresh explicitly on organization changes, not on an interval.
    void Promise.resolve().then(refresh);
  }, [client, org]);
  return <div className="min-h-screen bg-[#f3f6f9] text-[#273142]">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-[#e3eaf1] px-5 py-3">
      <div><strong>TGuia Food</strong><span className="ml-3 text-sm">Comandas compartilhadas — somente leitura</span></div>
      <a href="/" className="border bg-white px-4 py-2 text-sm">Voltar às mesas</a>
    </header>
    <main className="mx-auto max-w-5xl p-5">
      <h1 className="mb-2 text-xl font-bold">Pedidos no Supabase</h1>
      <p className="mb-4 border border-blue-200 bg-blue-50 p-3 text-sm">Consulta de pedidos abertos da organização autorizada. Nenhum pedido, pagamento ou estoque será alterado nesta tela.</p>
      {error && <p role="alert" className="mb-3 border border-red-300 bg-red-50 p-3 text-sm">{error}</p>}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select aria-label="Organização" className="border bg-white p-2" value={org} onChange={e => { setOrg(e.target.value); setOrders([]); setTables({}); }}>
          <option value="">Selecione a organização</option>
          {memberships.map(m => <option key={m.organization_id} value={m.organization_id}>{m.organizations?.name || m.organization_id}</option>)}
        </select>
        <button disabled={!org || loading} onClick={() => void refresh()} className="border bg-white px-4 py-2 font-semibold disabled:opacity-50">{loading ? "Consultando..." : "Atualizar consulta"}</button>
      </div>
      {authReady && !!org && orders.length === 0 && !loading && !error && <p className="p-4 text-sm">Nenhuma comanda aberta encontrada.</p>}
      <div className="space-y-3">{orders.map(order => {
        const subtotal = order.order_items.reduce((n, item) => n + item.quantity * item.unit_price, 0);
        return <section key={order.id} className="rounded border border-[#c4d0da] bg-white p-4">
          <div className="flex flex-wrap justify-between gap-3"><strong>Pedido #{order.order_number} {order.table_id ? "· Mesa " + (tables[order.table_id] || "?") : ""}</strong><span>{order.status === "closing" ? "Em fechamento" : "Aberto"} · {money(subtotal)} (sem taxa)</span></div>
          <p className="mt-1 text-sm text-slate-600">{order.customer_name || "Cliente não informado"} · {new Date(order.opened_at).toLocaleString("pt-BR")}</p>
          <ul className="mt-2 text-sm">{order.order_items.map(item => <li key={item.id}>{item.quantity}× {item.product_name} — {money(item.unit_price)}</li>)}</ul>
        </section>;
      })}</div>
    </main>
  </div>;
}
