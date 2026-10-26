import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TableOrderModal } from "../components/TableOrderModal";
import { CashRegisterModal } from "../components/CashRegisterModal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TGuia Food - Sistema de Mesas e Comandas" },
      {
        name: "description",
        content:
          "Sistema TGuia Food: controle de caixa, mesas, comandas, pedidos delivery e balcão em uma única tela.",
      },
      { property: "og:title", content: "TGuia Food - Sistema de Mesas e Comandas" },
      {
        property: "og:description",
        content:
          "Painel do TGuia Food com pedidos em andamento, mesas livres e atalhos de caixa e vendas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const TABLE_STATE_KEY = "tguia-food-table-closing-state";
const TABLE_NAME_KEY = "tguia-food-table-names";
const TABLE_ORDERS_KEY = "tguia-food-orders-v1";

function readOrdersWithItems(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(TABLE_ORDERS_KEY) || "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return new Set();
    return new Set(Object.entries(saved).filter(([, items]) => Array.isArray(items) && items.some(item => item && typeof item === "object" && "quantity" in item && typeof item.quantity === "number" && item.quantity > 0)).map(([number]) => number));
  } catch { return new Set(); }
}

const allFreeTables = Array.from({ length: 85 }, (_, i) => String(i + 2).padStart(2, "0"));

const icon = (path: string, className: string) => (
  <svg className={`mb-1 h-8 w-8 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d={path} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
  </svg>
);

function RibbonButton({ width, children, svg, href, onClick }: { width: string; children: React.ReactNode; svg: React.ReactNode; href?: string; onClick?:()=>void }) {
  const className = `ribbon-button flex flex-col items-center justify-start rounded-sm border border-transparent p-1 ${width}`;
  if (href) return <a href={href} className={className}>{svg}<span className="leading-tight">{children}</span></a>;
  return <button type="button" onClick={onClick} className={className}>{svg}<span className="leading-tight">{children}</span></button>;
}

function readTableStates(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(TABLE_STATE_KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

function readTableNames(): Record<string, string> {
  const defaults: Record<string, string> = { "01": "marcos", "02": "lucas" };
  if (typeof window === "undefined") return defaults;
  try {
    return {
      ...defaults,
      ...(JSON.parse(window.localStorage.getItem(TABLE_NAME_KEY) ?? "{}") as Record<string, string>),
    };
  } catch {
    return defaults;
  }
}

function Index() {
  const [tableStates, setTableStates] = useState<Record<string, boolean>>(() => readTableStates());
  const [tableNames, setTableNames] = useState<Record<string, string>>(() => readTableNames());
  const [ordersWithItems, setOrdersWithItems] = useState<Set<string>>(() => readOrdersWithItems());
  const [tableQuery, setTableQuery] = useState("");
  const [cashOpen,setCashOpen] = useState(false);
  const [liveTables, setLiveTables] = useState<{id:string;number:number}[] | null>(null);
  const [liveOrders, setLiveOrders] = useState<{table_id:string|null;status:string;customer_name:string|null}[]>([]);
  const [liveError, setLiveError] = useState("");
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveOrg, setLiveOrg] = useState("");
  const [supabase,setSupabase] = useState<SupabaseClient|null>(null);
  const [selectedLiveTable, setSelectedLiveTable] = useState<{id:string;number:number}|null>(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveNotice, setLiveNotice] = useState("");
  const [liveProducts, setLiveProducts] = useState<{id:string;name:string;sale_price:number}[]>([]);
  const [liveSelectedProduct, setLiveSelectedProduct] = useState("");
  const [liveQty, setLiveQty] = useState(1);
  const [liveOrder, setLiveOrder] = useState<{id:string;status:string;order_number:number}|null>(null);
  const [liveItems, setLiveItems] = useState<{id:string;product_name:string;quantity:number;unit_price:number}[]>([]);
  const [liveRate, setLiveRate] = useState(0);
  useEffect(() => {
    let active = true;
    let refreshLive: (() => Promise<void>) | null = null;
    void import("../lib/supabase").then(async ({ supabase: browserClient }) => {
      if (active) setSupabase(browserClient);
      const supabase = browserClient;
      const refresh = async () => {
        const { data: auth } = await supabase.auth.getUser();
        if (!active) return;
        if (!auth.user) { setLiveTables(null); setLiveLoading(false); return; }
        const { data: memberships, error: memberError } = await supabase.from("organization_members").select("organization_id").eq("user_id", auth.user.id).eq("active", true).limit(1);
        if (memberError) throw memberError;
        const orgId = memberships?.[0]?.organization_id;
        if (orgId) setLiveOrg(orgId);
        if (!orgId) { setLiveError("Conta sem restaurante vinculado. Acesse Gestão."); setLiveTables(null); setLiveLoading(false); return; }
        const [tablesResult, ordersResult] = await Promise.all([
          supabase.from("restaurant_tables").select("id,number").eq("organization_id",orgId).eq("active",true).order("number"),
          supabase.from("orders").select("table_id,status,customer_name").eq("organization_id",orgId).in("status",["open","closing"]),
        ]);
        if (tablesResult.error || ordersResult.error) throw tablesResult.error || ordersResult.error;
        if (!active) return;
        setLiveTables(tablesResult.data || []);
        setLiveOrders(ordersResult.data || []);
        setLiveError(""); setLiveLoading(false);
      };
      refreshLive = refresh;
      await refresh();
    }).catch(() => { if (active) { setLiveError("Não foi possível carregar as mesas online."); setLiveLoading(false); } });
    const onFocus = () => { void refreshLive?.().catch(() => { if (active) setLiveError("Falha ao atualizar mesas."); }); };
    window.addEventListener("focus", onFocus);
    return () => { active = false; window.removeEventListener("focus", onFocus); };
  }, []);


  useEffect(() => {
    const refresh = () => {
      setTableStates(readTableStates());
      setTableNames(readTableNames());
      setOrdersWithItems(readOrdersWithItems());
    };
    window.addEventListener("tguia:table-state-change", refresh as EventListener);
    window.addEventListener("tguia:table-name-change", refresh as EventListener);
    window.addEventListener("storage", refresh);
    window.addEventListener("tguia:orders-change", refresh);
    return () => {
      window.removeEventListener("tguia:table-state-change", refresh as EventListener);
      window.removeEventListener("tguia:table-name-change", refresh as EventListener);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("tguia:orders-change", refresh);
    };
  }, []);

  const openLiveTable = async (table:{id:string;number:number}) => {
    if (!liveOrg || !supabase) return;
    setSelectedLiveTable(table); setLiveBusy(true); setLiveNotice("");
    setLiveOrder(null); setLiveItems([]); setLiveSelectedProduct(""); setLiveQty(1);
    try {
      const [orderResult,productResult,orgResult] = await Promise.all([
        supabase.from("orders").select("id,status,order_number,order_items(id,product_name,quantity,unit_price)").eq("organization_id",liveOrg).eq("table_id",table.id).in("status",["open","closing"]).maybeSingle(),
        supabase.from("products").select("id,name,sale_price").eq("organization_id",liveOrg).eq("active",true).order("name"),
        supabase.from("organizations").select("service_rate").eq("id",liveOrg).single(),
      ]);
      if (orderResult.error || productResult.error || orgResult.error) throw orderResult.error || productResult.error || orgResult.error;
      setLiveOrder(orderResult.data ? {id:orderResult.data.id,status:orderResult.data.status,order_number:orderResult.data.order_number} : null);
      setLiveItems(orderResult.data?.order_items || []);
      setLiveProducts(productResult.data || []);
      setLiveRate(Number(orgResult.data?.service_rate || 0));
      const {data: currentOrders, error: refreshError} = await supabase.from("orders")
        .select("table_id,status,customer_name").eq("organization_id",liveOrg).in("status",["open","closing"]);
      if (refreshError) throw refreshError;
      setLiveOrders(currentOrders || []);
    } catch(e) { setLiveNotice(e instanceof Error ? e.message : "Erro ao consultar mesa."); }
    finally { setLiveBusy(false); }
  };
  const saveLiveOrder = async () => {
    if (!selectedLiveTable || !liveOrg || !supabase || liveBusy) return;
    setLiveBusy(true); setLiveNotice("");
    try {
      if (!liveOrder) {
        const {data:auth} = await supabase.auth.getUser();
        if (!auth.user) throw Error("Faça login na Gestão.");
        const {error} = await supabase.from("orders").insert({organization_id:liveOrg,table_id:selectedLiveTable.id,order_type:"table",status:"open",created_by:auth.user.id});
        if (error) throw error;
      } else {
        if (liveOrder.status !== "open" || !liveSelectedProduct) throw Error("Selecione um produto para uma comanda aberta.");
        const {error} = await supabase.rpc("add_order_product",{p_order_id:liveOrder.id,p_product_id:liveSelectedProduct,p_quantity:liveQty});
        if (error) throw error;
      }
      await openLiveTable(selectedLiveTable);
      setLiveNotice("Comanda atualizada no Supabase.");
    } catch(e) { setLiveNotice(e instanceof Error ? e.message : "Falha ao salvar pedido."); }
    finally { setLiveBusy(false); }
  };
  const sendLiveOrderToCashier = async () => {
    if (!liveOrder || !selectedLiveTable || !liveOrg || !supabase || liveBusy || liveOrder.status !== "open") return;
    if (liveItems.length === 0) { setLiveNotice("Adicione um produto antes de encaminhar ao caixa."); return; }
    setLiveBusy(true); setLiveNotice("");
    try {
      const {data,error} = await supabase.from("orders").update({status:"closing",closing_at:new Date().toISOString()})
        .eq("id",liveOrder.id).eq("organization_id",liveOrg).eq("status","open").select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw Error("Comanda alterada em outro terminal. Consulte novamente.");
      await openLiveTable(selectedLiveTable);
      setLiveNotice("Comanda enviada ao caixa. Pagamento ainda não registrado.");
    } catch(e) { setLiveNotice(e instanceof Error ? e.message : "Falha ao enviar ao caixa."); }
    finally { setLiveBusy(false); }
  };
  const closingTables = useMemo(
    () => allFreeTables.filter((table) => Boolean(tableStates[table]) || ordersWithItems.has(table)),
    [tableStates, ordersWithItems],
  );

  const freeTables = useMemo(
    () => allFreeTables.filter((table) => !tableStates[table] && !ordersWithItems.has(table)),
    [tableStates, ordersWithItems],
  );

  const normalizedTableQuery = tableQuery.trim().toLocaleLowerCase("pt-BR");
  const matchesTableQuery = (number: string) => !normalizedTableQuery || number.includes(normalizedTableQuery) || String(Number(number)).includes(normalizedTableQuery) || (tableNames[number] || "").toLocaleLowerCase("pt-BR").includes(normalizedTableQuery);
  const visibleClosingTables = closingTables.filter(matchesTableQuery);
  const visibleFreeTables = freeTables.filter(matchesTableQuery);
  const table01Visible = matchesTableQuery("01");
  const table01Blocked = Boolean(tableStates["01"]);
  const table01HasOrder = ordersWithItems.has("01");
  const ongoingCount = 1 + closingTables.length;

  return (
    <div className="relative mx-auto flex h-[1080px] w-[1920px] select-none flex-col bg-background text-app-text">
      <header className="flex h-8 items-center justify-between border-b border-app-border bg-app-chrome px-2 text-xs">
        <div className="flex space-x-1">
          <button className="translate-y-[1px] border-b-background border-l border-r border-t border-app-border bg-background px-3 py-1 font-semibold text-app-blue">PRINCIPAL</button>
          {["PRODUTOS", "FINANCEIRO", "CONFIGURAÇÕES", "APPS"].map((t) => (
            <button key={t} className="px-3 py-1 text-app-muted hover:bg-app-chrome-hover">{t}</button>
          ))}
          <a href="/gestao" className="px-3 py-1 font-semibold text-app-blue hover:bg-app-chrome-hover">GESTÃO / GELADEIRA</a>
          <a href="/historico" className="px-3 py-1 font-semibold text-app-blue hover:bg-app-chrome-hover">HISTÓRICO LOCAL</a>
          <a href="/comandas-online" className="px-3 py-1 font-semibold text-app-blue hover:bg-app-chrome-hover">COMANDAS ONLINE</a>
        </div>
        <div className="flex space-x-0">
          <button className="flex h-8 w-8 items-center justify-center text-app-muted hover:bg-app-chrome-hover">_</button>
          <button className="flex h-8 w-8 items-center justify-center text-app-muted hover:bg-app-chrome-hover">□</button>
          <button className="flex h-8 w-8 items-center justify-center text-app-muted hover:bg-app-close hover:text-app-on-dark">✕</button>
        </div>
      </header>

      <nav className="flex h-[88px] items-stretch border-b border-app-border bg-app-ribbon text-center text-xs">
        <div className="relative flex min-w-[130px] items-stretch border-r border-app-border px-1 pb-1 pt-1">
          <div className="flex w-full justify-center space-x-1">
            <RibbonButton onClick={() => setCashOpen(true)} width="w-20" svg={icon("M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10", "text-app-icon-blue")}>Abrir / Fechar<br />Meu Caixa</RibbonButton>
            <RibbonButton href="/historico-online" width="w-20" svg={icon("M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", "text-app-icon-navy")}>Histórico<br />do Caixa</RibbonButton>
          </div>
          <div className="absolute bottom-0 left-0 w-full pb-0.5 text-center text-[10px] text-app-muted">Caixa</div>
        </div>

        <div className="relative flex items-stretch border-r border-app-border px-1 pb-1 pt-1">
          <div className="flex w-full justify-center space-x-1">
            <RibbonButton width="w-24" svg={icon("M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", "text-app-icon-yellow")}>Mesas / Comandas<br /><span className="font-semibold">(F3)</span></RibbonButton>
            <RibbonButton width="w-24" svg={icon("M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z", "text-app-icon-red")}>Pedidos Delivery<br /><span className="font-semibold">(F4)</span></RibbonButton>
            <RibbonButton width="w-24" svg={icon("M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", "text-app-icon-green")}>Pedido no Caixa<br /><span className="font-semibold">(F5)</span></RibbonButton>
            <RibbonButton width="w-20" svg={icon("M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9", "text-app-icon-sky")}>Cardápio<br />Online</RibbonButton>
          </div>
          <div className="absolute bottom-0 left-0 w-full pb-0.5 text-center text-[10px] text-app-muted">Vendas</div>
        </div>
      </nav>

      <div className="flex h-12 shrink-0 items-center justify-between border-b border-app-border bg-background px-4 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
              <svg className="h-4 w-4 text-app-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
            </div>
            <input type="text" value={tableQuery} onChange={(event) => setTableQuery(event.target.value)} placeholder="Buscar número ou nome..." className="w-64 rounded-sm border border-app-line bg-app-field py-1 pl-8 pr-2 text-sm focus:border-app-icon-sky focus:outline-none focus:ring-1 focus:ring-app-icon-sky" />
          </div>
          <button className="flex items-center space-x-1 rounded p-1 text-sm font-semibold hover:bg-app-hover"><span>Juntar Pedidos</span></button>
        </div>
        <div className="flex items-center space-x-6">
          <button className="flex items-center space-x-1 rounded p-1 text-sm font-semibold hover:bg-app-hover"><span>Atualizar</span></button>
          <button className="flex items-center space-x-1 rounded p-1 text-sm font-semibold hover:bg-app-hover"><span>Iniciar Pedido Balcão (F6)</span></button>
        </div>
      </div>

      <main className="app-scrollbar-hide flex flex-1 flex-col overflow-y-auto bg-background p-6">
        {liveLoading && <p className="mb-3 text-sm">Verificando mesas online...</p>}
        {!liveLoading && liveTables !== null ?
          <div>
            {liveError && <p role="alert" className="mb-4 border border-amber-300 bg-amber-50 p-3 text-sm">{liveError}</p>}
            <h1 className="mb-4 text-sm font-bold">Mesas do restaurante · Supabase</h1>
            <div className="mb-5 flex flex-wrap gap-3">
              {liveTables.filter(t => liveOrders.some(o => o.table_id === t.id)).filter(t => !tableQuery.trim() || String(t.number).includes(tableQuery.trim())).map(t => {
                const order = liveOrders.find(o => o.table_id === t.id);
                return <button type="button" key={t.id} onClick={() => void openLiveTable(t)} className="table-box-active flex h-24 w-24 flex-col items-center justify-center text-white" style={{backgroundColor:order?.status === "closing" ? "#e5ad1d" : "#32965d"}}><span className="text-2xl font-bold">{t.number}</span><span className="text-xs">{order?.status === "closing" ? "No caixa" : "Ocupada"}</span></button>;
              })}
            </div>
            <h2 className="mb-4 text-sm font-bold">Mesas livres</h2>
            <div className="app-grid">
              {liveTables.filter(t => !liveOrders.some(o => o.table_id === t.id)).filter(t => !tableQuery.trim() || String(t.number).includes(tableQuery.trim())).map(t => <button type="button" key={t.id} onClick={() => void openLiveTable(t)} className="table-box flex h-[88px] flex-col justify-start pt-1 text-center text-app-on-dark"><span className="text-[9px]">ABRIR</span><span className="mt-2 text-2xl font-bold">{t.number}</span></button>)}
            </div>
            {!liveTables.length && !liveError && <p className="text-sm">Nenhuma mesa cadastrada. Acesse Gestão para cadastrar.</p>}
          </div> :
          <div className="mb-3 border border-amber-300 bg-amber-50 p-3 text-xs">{liveError || "Modo de demonstração local."} As mesas abaixo são da interface original e não representam comandas reais no Supabase. <a href="/gestao" className="underline">Acessar Gestão</a></div>}

        {liveTables === null && <>

        <section className="mb-6">
          <h1 className="mb-4 text-sm font-bold text-app-text">Pedidos em Andamento ({ongoingCount} de {ongoingCount})</h1>
          <div className="flex flex-wrap gap-4">
            {table01Visible && <div
              className="table-box-active relative flex h-24 w-24 cursor-pointer flex-col items-center justify-center transition-colors"
              style={{ backgroundColor: table01Blocked ? "#e5ad1d" : table01HasOrder ? "#32965d" : undefined }}
              title={`Mesa 01 - ${tableNames["01"] || "marcos"}`}
            >
              <span className="text-3xl font-bold text-white">01</span>
              <span className="mt-1 text-xs text-white">{tableNames["01"] || "marcos"}</span>
            </div>}

            {visibleClosingTables.map((table) => (
              <div
                key={table}
                className="table-box-active relative flex h-24 w-24 cursor-pointer flex-col items-center justify-center transition-colors"
                style={{ backgroundColor: "#e5ad1d" }}
                title={`Mesa ${table}${tableNames[table] ? ` - ${tableNames[table]}` : ""}`}
              >
                <span className="text-3xl font-bold text-white">{table}</span>
                {tableNames[table] && <span className="mt-1 text-xs text-white">{tableNames[table]}</span>}
              </div>
            ))}
          </div>
        </section>

        <section className="flex-1">
          <h2 className="mb-4 text-sm font-bold text-app-text">Mesas / Comandas Livres</h2>
          <div className="app-grid">
            {visibleFreeTables.map((n) => (
              <div key={n} className="table-box flex h-[88px] flex-col justify-start pt-1 text-center text-app-on-dark">
                <span className="text-[9px]">ABRIR</span>
                <span className="mt-2 text-2xl font-bold">{n}</span>
              </div>
            ))}
          </div>
        </section>
        </>}
      </main>

      {selectedLiveTable && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1f2c3b]/90 p-4">
        <section role="dialog" aria-modal="true" aria-label={"Mesa " + selectedLiveTable.number} className="flex max-h-[92vh] w-[741px] max-w-[96vw] flex-col overflow-auto border border-[#999] bg-white font-[Segoe_UI,Tahoma,sans-serif] text-xs text-[#273142] shadow-2xl">
          <div className="flex items-center justify-between border-b bg-[#e3eaf1] p-3"><strong>Mesa {selectedLiveTable.number} · {liveOrder ? "Comanda #" + liveOrder.order_number : "Livre"}</strong><button onClick={() => setSelectedLiveTable(null)} className="border bg-white px-3 py-1">Fechar ×</button></div>
          <div className="space-y-3 p-4">
            {liveNotice && <p role="status" className="border border-amber-300 bg-amber-50 p-2">{liveNotice}</p>}
            <h2 className="font-bold">Itens da comanda</h2>
            <div className="min-h-32 border"><table className="w-full text-left"><thead className="bg-[#e9eff5]"><tr><th className="p-2">Produto</th><th className="p-2">Qtd.</th><th className="p-2">Valor</th></tr></thead><tbody>{liveItems.map(item=><tr key={item.id} className="border-t"><td className="p-2">{item.product_name}</td><td className="p-2">{item.quantity}</td><td className="p-2">{new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(item.quantity*item.unit_price)}</td></tr>)}</tbody></table></div>
            <p className="text-right font-bold">Total com serviço ({liveRate}%): {new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(liveItems.reduce((n,i)=>n+i.quantity*i.unit_price,0)*(1+liveRate/100))}</p>
            {liveOrder?.status === "open" && liveProducts.length===0 && <p className="border border-amber-300 bg-amber-50 p-2">Não há produtos ativos no cadastro real. Verifique em Gestão.</p>}
            {liveOrder?.status === "open" && <div className="flex gap-2"><select aria-label="Produto" className="min-w-0 flex-1 border p-2" value={liveSelectedProduct} onChange={e=>setLiveSelectedProduct(e.target.value)}><option value="">Selecionar produto</option>{liveProducts.map(p=><option key={p.id} value={p.id}>{p.name} · {new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(p.sale_price))}</option>)}</select><input aria-label="Quantidade" type="number" min={1} max={100} className="w-16 border p-2" value={liveQty} onChange={e=>setLiveQty(Number(e.target.value))} /></div>}
            <div className="flex justify-end gap-2 border-t pt-3">{liveOrder?.status === "open" && <button type="button" onClick={() => void sendLiveOrderToCashier()} disabled={liveBusy || liveItems.length === 0} className="border bg-[#e9eff5] px-4 py-2 disabled:opacity-50">Encaminhar ao caixa</button>}<a href={"/comandas-online?mesa="+selectedLiveTable.id} className="border bg-[#e9eff5] px-4 py-2">Abrir caixa</a>{(!liveOrder || liveOrder.status === "open") && <button disabled={liveBusy || (!!liveOrder && (!liveSelectedProduct || !Number.isInteger(liveQty) || liveQty<1 || liveQty>100))} onClick={() => void saveLiveOrder()} className="bg-[#315976] px-4 py-2 font-bold text-white disabled:opacity-50">{liveBusy ? "Salvando..." : liveOrder ? "Adicionar produto" : "Abrir comanda"}</button>}</div>
          </div>
        </section>
      </div>}
      {liveTables === null && <TableOrderModal />}
      {cashOpen && <CashRegisterModal onClose={() => setCashOpen(false)}/> }
      <footer className="relative z-10 flex h-10 shrink-0 items-center justify-between border-t border-app-border bg-app-chrome px-2 text-xs">
        <div className="flex items-center space-x-2"><div className="h-4 w-8 border border-app-border bg-app-field" /><span className="text-app-text">Exibir Total da Conta e Duração</span></div>
        <div className="absolute bottom-0 left-0 flex h-5 w-full items-center bg-app-status px-2 text-[11px]"><span className="text-app-text">{liveTables === null ? "Modo demonstração local — sem usuário de caixa autorizado" : "Mesas online: dados do restaurante autenticado"} <a className="text-app-blue underline" href="/gestao">Gestão / acesso</a></span></div>
      </footer>
    </div>
  );
}
