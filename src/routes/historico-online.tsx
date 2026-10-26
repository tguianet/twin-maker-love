import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/historico-online")({ component: ClosedOrders });
type ClosedOrder = { id: string; order_number: number; customer_name: string | null; closed_at: string | null; order_payments: { id: string; method: string; amount: number }[] };
const money = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
function ClosedOrders() {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [orgs, setOrgs] = useState<{id: string; name: string}[]>([]);
  const [org, setOrg] = useState("");
  const [orders, setOrders] = useState<ClosedOrder[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void import("../lib/supabase").then(async ({ supabase }) => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !auth.user) { setError("Entre pela Gestão antes de consultar o histórico."); return; }
      const { data, error: failure } = await supabase.from("organization_members")
        .select("organization_id, organizations(id,name)").eq("user_id", auth.user.id).eq("active", true);
      if (!active) return;
      if (failure) { setError(failure.message); return; }
      const found = (data || []).flatMap(row => {
        const joined = row.organizations as unknown as {id:string;name:string} | {id:string;name:string}[] | null;
        return joined ? (Array.isArray(joined) ? joined : [joined]) : [];
      });
      setClient(supabase); setOrgs(found); setOrg(found[0]?.id || "");
      if (!found.length) setError("Usuário sem restaurante autorizado.");
    }).catch(() => { if (active) setError("Não foi possível conectar ao Supabase."); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!client || !org) return;
    let active = true;
    const load = async () => {
      setBusy(true); setError("");
      const { data, error: failure } = await client.from("orders")
        .select("id,order_number,customer_name,closed_at,order_payments(id,method,amount)")
        .eq("organization_id", org).eq("status", "closed").order("closed_at", {ascending:false}).limit(200);
      if (!active) return;
      setBusy(false);
      if (failure) setError(failure.message);
      else setOrders((data || []) as ClosedOrder[]);
    };
    void load();
    return () => { active = false; };
  }, [client, org]);
  const exportCsv = () => {
    if (!orders.length || !org) return;
    const rows = [["comanda","cliente","fechamento","metodo","valor"]];
    for (const order of orders) {
      for (const payment of order.order_payments) {
        rows.push([String(order.order_number), order.customer_name || "", order.closed_at || "", payment.method, Number(payment.amount).toFixed(2)]);
      }
    }
    const csv = "\uFEFF" + rows.map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "tguia-food-caixa.csv"; link.click();
    URL.revokeObjectURL(url);
  };
  const total = orders.reduce((sum, o) => sum + o.order_payments.reduce((n, p) => n + Number(p.amount), 0), 0);
  return <main className="min-h-screen bg-[#f3f6f9] p-5 text-[#273142]">
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-bold">TGuia Food · Histórico do caixa</h1><a href="/comandas-online" className="border bg-white px-4 py-2 text-sm">Voltar às comandas</a></header>
      <p className="mb-4 bg-blue-50 p-3 text-sm">Somente as últimas 200 comandas fechadas. Valores de pagamentos registrados no Supabase; não comprova compensação externa de Pix ou cartão.</p>
      {error && <p role="alert" className="mb-4 border border-red-300 bg-red-50 p-3">{error}</p>}
      <select aria-label="Restaurante" className="mb-4 border bg-white p-2" value={org} onChange={e => {setOrg(e.target.value); setOrders([]);}}><option value="">Selecione o restaurante</option>{orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
      <div className="mb-4 border bg-white p-4"><button type="button" disabled={!orders.length || busy} onClick={exportCsv} className="float-right border bg-[#e9eff5] px-3 py-2 text-sm font-semibold disabled:opacity-50">Exportar CSV</button><strong>{orders.length} comandas fechadas</strong><p className="mt-2 text-lg font-bold">Recebimentos registrados: {money(total)}</p></div>
      {busy && <p>Carregando histórico...</p>}
      <div className="space-y-3">{orders.map(o => <section className="border bg-white p-4" key={o.id}><div className="flex justify-between gap-3"><strong>Comanda #{o.order_number}</strong><strong>{money(o.order_payments.reduce((n,p) => n + Number(p.amount),0))}</strong></div><p className="mt-1 text-sm">{o.customer_name || "Sem cliente"} · {o.closed_at ? new Date(o.closed_at).toLocaleString("pt-BR") : "Sem data de fechamento"}</p><ul className="mt-2 text-sm">{o.order_payments.map(p => <li key={p.id}>{p.method}: {money(Number(p.amount))}</li>)}</ul></section>)}</div>
    </div>
  </main>;
}
