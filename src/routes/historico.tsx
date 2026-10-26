import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/historico")({ component: HistoryPage });

type ClosedItem = { name: string; quantity: number; price: number };
type ClosedOrder = { id: string; table: string; items: ClosedItem[]; subtotal: number; service: number; total: number; paymentMethod: string; closedAt: string; customer?: { id: string; name: string } | null; mode?: string };
const KEY = "tguia-food-closed-orders-v1";
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const methods: Record<string, string> = { pix: "Pix", dinheiro: "Dinheiro", debito: "Débito", credito: "Crédito" };

function readHistory(): ClosedOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const data: unknown = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(data)) return [];
    return data.filter((entry): entry is ClosedOrder =>
      entry !== null && typeof entry === "object" && typeof entry.id === "string" &&
      typeof entry.table === "string" && typeof entry.total === "number" &&
      Number.isFinite(entry.total) && typeof entry.closedAt === "string" &&
      Array.isArray(entry.items)
    );
  } catch { return []; }
}

function HistoryPage() {
  const [history, setHistory] = useState<ClosedOrder[]>([]);
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setHistory(readHistory());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); };
  }, []);

  const visible = useMemo(() => history.filter(order => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return (!term || order.table.toLocaleLowerCase("pt-BR").includes(term) ||
      order.items.some(item => item.name.toLocaleLowerCase("pt-BR").includes(term)) || (order.customer?.name || "").toLocaleLowerCase("pt-BR").includes(term)) &&
      (method === "all" || method === order.paymentMethod);
  }), [history, query, method]);
  const total = visible.reduce((sum, order) => sum + order.total, 0);
  const exportCsv = () => {
    const header = ["Data", "Mesa", "Cliente", "Forma informada", "Subtotal", "Servico", "Total", "Modo"];
    const escapeCsv = (value: string | number) => {
      const safe = String(value).replace(/^[=+@-]/, "'").replace(/"/g, '""');
      return '"' + safe + '"';
    };
    const rows = visible.map(order => [
      order.closedAt, order.table, order.customer?.name || "", methods[order.paymentMethod] || order.paymentMethod,
      order.subtotal.toFixed(2), order.service.toFixed(2), order.total.toFixed(2), order.mode || "local-demo",
    ]);
    const csv = [header, ...rows].map(row => row.map(escapeCsv).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "tguia-food-historico-local.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#f3f6f9] text-[#273142]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#b8c4d1] bg-[#e3eaf1] px-5 py-3">
        <div><strong className="text-lg">TGuia Food</strong><span className="ml-3 text-sm">Histórico de Comandas</span></div>
        <a href="/" className="rounded border border-[#acb9c5] bg-white px-4 py-2 text-sm font-semibold">Voltar às mesas</a>
      </header>
      <main className="mx-auto max-w-5xl p-5">
        <h1 className="mb-2 text-xl font-bold">Fechamentos locais</h1>
        <p className="mb-5 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Registros de demonstração armazenados apenas neste navegador. Não são comprovantes fiscais,
          cobranças confirmadas ou dados compartilhados com o Supabase.
        </p>
        <div className="mb-4 flex flex-wrap gap-3">
          <input aria-label="Pesquisar mesa ou produto" value={query} onChange={event => setQuery(event.target.value)}
            placeholder="Pesquisar mesa, cliente ou produto..." className="min-w-[220px] flex-1 rounded border border-[#aebcca] bg-white p-2 text-sm" />
          <select aria-label="Filtrar forma informada" value={method} onChange={event => setMethod(event.target.value)}
            className="rounded border border-[#aebcca] bg-white p-2 text-sm">
            <option value="all">Todas as formas</option>
            {Object.entries(methods).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
        <div className="mb-4 flex justify-end"><button type="button" disabled={visible.length === 0} onClick={exportCsv} className="rounded border border-[#aebcca] bg-white px-4 py-2 text-sm font-semibold hover:bg-[#e7edf3] disabled:opacity-50">Exportar CSV local</button></div>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded border border-[#c4d0da] bg-white p-4"><div className="text-xs text-slate-600">Comandas filtradas</div><strong className="text-xl">{visible.length}</strong></div>
          <div className="rounded border border-[#c4d0da] bg-white p-4"><div className="text-xs text-slate-600">Total registrado (demonstração)</div><strong className="text-xl">{money(total)}</strong></div>
        </div>
        <div className="overflow-x-auto rounded border border-[#c4d0da] bg-white">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-[#e7edf3]"><tr><th className="p-3">Data</th><th className="p-3">Mesa</th><th className="p-3">Cliente</th><th className="p-3">Forma informada</th><th className="p-3 text-right">Total</th><th className="p-3">Detalhes</th></tr></thead>
            <tbody>{visible.map(order => <Fragment key={order.id}><tr className="border-t">
              <td className="p-3">{Number.isFinite(Date.parse(order.closedAt)) ? new Date(order.closedAt).toLocaleString("pt-BR") : "Sem data"}</td>
              <td className="p-3">{order.table}</td><td className="p-3">{order.customer?.name || "Não vinculado"}</td><td className="p-3">{methods[order.paymentMethod] || order.paymentMethod}</td>
              <td className="p-3 text-right font-semibold">{money(order.total)}</td>
              <td className="p-3"><button type="button" onClick={() => setExpanded(expanded === order.id ? null : order.id)} className="font-semibold text-blue-700 underline">{expanded === order.id ? "Ocultar" : "Ver itens"}</button></td>
            </tr>{expanded === order.id && <tr key={order.id + "-details"} className="bg-slate-50"><td colSpan={6} className="p-3"><ul className="space-y-1">{order.items.map((item, i) => <li key={i}>{item.quantity}× {item.name} — {money(item.price * item.quantity)}</li>)}</ul><p className="mt-2 text-xs">Subtotal: {money(order.subtotal)} · Serviço: {money(order.service)} · Total: {money(order.total)}</p></td></tr>}</Fragment>)}</tbody>
          </table>
          {visible.length === 0 && <p className="p-5 text-sm text-slate-500">Nenhum fechamento encontrado neste navegador.</p>}
        </div>
      </main>
    </div>
  );
}
