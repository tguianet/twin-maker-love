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
  const [selectedTableId, setSelectedTableId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<{ id: string; name: string; sale_price: number }[]>([]);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState<Record<string, number>>({});
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [message, setMessage] = useState("");
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
      const [ordersResult, tablesResult, productsResult] = await Promise.all([
        client.from("orders").select("id, order_number, status, customer_name, opened_at, table_id, order_items(id, product_name, quantity, unit_price)")
          .eq("organization_id", org).in("status", ["open", "closing"]).order("opened_at", { ascending: false }).limit(200),
        client.from("restaurant_tables").select("id, number").eq("organization_id", org),
        client.from("products").select("id, name, sale_price").eq("organization_id", org).eq("active", true).order("name").limit(500),
      ]);
      if (ordersResult.error) throw ordersResult.error;
      if (tablesResult.error) throw tablesResult.error;
      if (productsResult.error) throw productsResult.error;
      setOrders((ordersResult.data || []) as Order[]);
      setTables(Object.fromEntries((tablesResult.data || []).map(t => [t.id, t.number])));
      setProducts((productsResult.data || []) as { id: string; name: string; sale_price: number }[]);
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao consultar comandas."); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    if (!client || !org) return;
    // Refresh explicitly on organization changes, not on an interval.
    void Promise.resolve().then(refresh);
  }, [client, org]);
  const createOrder = async () => {
    if (!client || !org || !selectedTableId || saving) return;
    if (!Object.prototype.hasOwnProperty.call(tables, selectedTableId)) {
      setError("Selecione uma mesa válida da organização."); return;
    }
    setSaving(true); setError(""); setMessage("");
    try {
      const { data: session, error: authError } = await client.auth.getUser();
      if (authError) throw authError;
      if (!session.user) throw new Error("Sua sessão expirou. Entre novamente.");
      const { data, error: createError } = await client.from("orders").insert({
        organization_id: org, table_id: selectedTableId, order_type: "table", status: "open",
        customer_name: newCustomerName.trim().slice(0, 120) || null,
        created_by: session.user.id,
      }).select("id, order_number").single();
      if (createError) {
        if (createError.code === "23505") throw new Error("Já existe uma comanda aberta para esta mesa. Atualize a lista.");
        throw createError;
      }
      setMessage("Comanda #" + data.order_number + " aberta no Supabase. Adição de itens será habilitada após homologação.");
      setSelectedTableId(""); setNewCustomerName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir a comanda.");
    } finally { setSaving(false); }
  };
  const addItem = async (orderId: string) => {
    if (!client || addingTo || !org) return;
    const productId = selection[orderId];
    const amount = quantity[orderId] ?? 1;
    if (!productId || !products.some(p => p.id === productId) || !Number.isInteger(amount) || amount < 1 || amount > 100) {
      setError("Selecione um produto e uma quantidade inteira entre 1 e 100."); return;
    }
    const order = orders.find(o => o.id === orderId && o.status === "open");
    if (!order) { setError("Atualize a lista antes de lançar itens."); return; }
    setAddingTo(orderId); setError(""); setMessage("");
    try {
      const { error: rpcError } = await client.rpc("add_order_product", {
        p_order_id: orderId, p_product_id: productId, p_quantity: amount,
      });
      if (rpcError) throw rpcError;
      setMessage("Produto adicionado ao pedido #" + order.order_number + " com preço validado no servidor.");
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao adicionar produto."); }
    finally { setAddingTo(null); }
  };
  return <div className="min-h-screen bg-[#f3f6f9] text-[#273142]">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-[#e3eaf1] px-5 py-3">
      <div><strong>TGuia Food</strong><span className="ml-3 text-sm">Comandas compartilhadas</span></div>
      <a href="/" className="border bg-white px-4 py-2 text-sm">Voltar às mesas</a>
    </header>
    <main className="mx-auto max-w-5xl p-5">
      <h1 className="mb-2 text-xl font-bold">Pedidos no Supabase</h1>
      <p className="mb-4 border border-blue-200 bg-blue-50 p-3 text-sm">A abertura de comandas e o lançamento de produtos usam o Supabase. O lançamento exige a função segura add_order_product instalada no banco. Não há pagamentos nem movimentação de estoque.</p>
      {error && <p role="alert" className="mb-3 border border-red-300 bg-red-50 p-3 text-sm">{error}</p>}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select aria-label="Organização" className="border bg-white p-2" value={org} onChange={e => { setOrg(e.target.value); setOrders([]); setTables({}); setSelectedTableId(""); setMessage(""); }}>
          <option value="">Selecione a organização</option>
          {memberships.map(m => <option key={m.organization_id} value={m.organization_id}>{m.organizations?.name || m.organization_id}</option>)}
        </select>
        <button disabled={!org || loading} onClick={() => void refresh()} className="border bg-white px-4 py-2 font-semibold disabled:opacity-50">{loading ? "Consultando..." : "Atualizar consulta"}</button>
      </div>
      {message && <p role="status" className="mb-3 border border-green-200 bg-green-50 p-3 text-sm">{message}</p>}
      {!!org && <section className="mb-5 rounded border border-[#c4d0da] bg-white p-4">
        <h2 className="mb-2 font-bold">Abrir nova comanda no Supabase</h2>
        <p className="mb-3 text-xs text-slate-600">A mesa deve existir no cadastro do banco e não possuir outra comanda aberta. Esta ação grava uma comanda real, porém sem itens ou pagamentos.</p>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Mesa para nova comanda" className="min-w-[180px] flex-1 border p-2" value={selectedTableId} onChange={e => setSelectedTableId(e.target.value)}>
            <option value="">Selecione uma mesa</option>
            {Object.entries(tables).sort((a,b) => a[1]-b[1]).map(([id,number]) => <option key={id} value={id}>Mesa {number}</option>)}
          </select>
          <input aria-label="Nome opcional do cliente" maxLength={120} className="min-w-[180px] flex-1 border p-2" placeholder="Nome do cliente (opcional)" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} />
          <button type="button" disabled={saving || loading || !selectedTableId} onClick={() => void createOrder()} className="bg-[#315976] px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? "Gravando..." : "Abrir comanda"}</button>
        </div>
      </section>}
      {authReady && !!org && orders.length === 0 && !loading && !error && <p className="p-4 text-sm">Nenhuma comanda aberta encontrada.</p>}
      <div className="space-y-3">{orders.map(order => {
        const subtotal = order.order_items.reduce((n, item) => n + item.quantity * item.unit_price, 0);
        return <section key={order.id} className="rounded border border-[#c4d0da] bg-white p-4">
          <div className="flex flex-wrap justify-between gap-3"><strong>Pedido #{order.order_number} {order.table_id ? "· Mesa " + (tables[order.table_id] || "?") : ""}</strong><span>{order.status === "closing" ? "Em fechamento" : "Aberto"} · {money(subtotal)} (sem taxa)</span></div>
          <p className="mt-1 text-sm text-slate-600">{order.customer_name || "Cliente não informado"} · {new Date(order.opened_at).toLocaleString("pt-BR")}</p>
          <ul className="mt-2 text-sm">{order.order_items.map(item => <li key={item.id}>{item.quantity}× {item.product_name} — {money(item.unit_price)}</li>)}</ul>
          {order.status === "open" && <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
            <select aria-label={"Produto do pedido " + order.order_number} className="min-w-[220px] flex-1 border p-2 text-sm" value={selection[order.id] || ""} onChange={e => setSelection(prev => ({ ...prev, [order.id]: e.target.value }))}>
              <option value="">Selecione um produto</option>
              {products.map(product => <option key={product.id} value={product.id}>{product.name} — {money(product.sale_price)}</option>)}
            </select>
            <input aria-label={"Quantidade do pedido " + order.order_number} className="w-24 border p-2 text-sm" type="number" min={1} max={100} step={1} value={quantity[order.id] ?? 1} onChange={e => setQuantity(prev => ({ ...prev, [order.id]: Number(e.target.value) }))} />
            <button type="button" disabled={!selection[order.id] || addingTo !== null} onClick={() => void addItem(order.id)} className="bg-[#315976] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{addingTo === order.id ? "Gravando..." : "Adicionar produto"}</button>
          </div>
        </section>;
      })}</div>
    </main>
  </div>;
}
