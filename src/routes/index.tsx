import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CashRegisterModal } from "../components/CashRegisterModal";
import { CashHistoryModal } from "../components/CashHistoryModal";
import { PaymentModal, type PaymentMethod } from "../components/PaymentModal";
import { Button } from "../components/ui/button";

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
  const [embedded,setEmbedded]=useState(false);
  useEffect(()=>{setEmbedded(new URLSearchParams(window.location.search).get("embedded")==="1");},[]);
  const [tableStates, setTableStates] = useState<Record<string, boolean>>(() => readTableStates());
  const [tableNames, setTableNames] = useState<Record<string, string>>(() => readTableNames());
  const [ordersWithItems, setOrdersWithItems] = useState<Set<string>>(() => readOrdersWithItems());
  const [tableQuery, setTableQuery] = useState("");
  const [cashOpen,setCashOpen] = useState(false);
  const [cashHistoryOpen,setCashHistoryOpen] = useState(false);
  const [liveTables, setLiveTables] = useState<{id:string;number:number}[] | null>(null);
  const [liveOrders, setLiveOrders] = useState<{table_id:string|null;status:string;customer_name:string|null}[]>([]);
  const [liveError, setLiveError] = useState("");
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveOrg, setLiveOrg] = useState("");
  const [supabase,setSupabase] = useState<SupabaseClient|null>(null);
  const [selectedLiveTable, setSelectedLiveTable] = useState<{id:string;number:number}|null>(null);
  const [tableOpeningChoice,setTableOpeningChoice] = useState(false);
  const [registeredInfoOpen,setRegisteredInfoOpen] = useState(false);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveCustomerName,setLiveCustomerName] = useState("");
  const [liveCustomerSaved,setLiveCustomerSaved] = useState("");
  const [liveCustomerSaving,setLiveCustomerSaving] = useState(false);
  const [liveLoadFailed, setLiveLoadFailed] = useState(false);
  const [liveNotice, setLiveNotice] = useState("");
  const [liveNoticeSequence,setLiveNoticeSequence] = useState(0);
  useEffect(() => {
    if (!liveNotice || !selectedLiveTable) return;
    const timeout = window.setTimeout(() => setLiveNotice(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [liveNotice,liveNoticeSequence,selectedLiveTable]);
  const [liveProducts, setLiveProducts] = useState<{id:string;name:string;sale_price:number;category_id:string|null}[]>([]);
  const [liveCategories, setLiveCategories] = useState<{id:string;name:string}[]>([]);
  const [liveCategory, setLiveCategory] = useState("all");
  const [liveBatch, setLiveBatch] = useState<Record<string,number>>({});
  const [liveProductPickerOpen, setLiveProductPickerOpen] = useState(false);
  const [liveProductQuery, setLiveProductQuery] = useState("");
  const [liveOrder, setLiveOrder] = useState<{id:string;status:string;order_number:number}|null>(null);
  const [liveItems, setLiveItems] = useState<{id:string;product_name:string;quantity:number;unit_price:number}[]>([]);
  const [liveRate, setLiveRate] = useState(0);
  const [livePaymentOpen, setLivePaymentOpen] = useState(false);
  const [liveCashAvailable, setLiveCashAvailable] = useState<boolean | null>(null);
  const [livePaymentError, setLivePaymentError] = useState("");
  const openLivePayment = async () => {
    if (!liveOrder || !supabase || liveBusy || liveLoadFailed) return;
    setLivePaymentError(""); setLiveCashAvailable(null); setLivePaymentOpen(true);
    const { data, error } = await supabase.from("cash_sessions").select("id").eq("organization_id", liveOrg).is("closed_at", null).limit(1);
    setLiveCashAvailable(!error && Boolean(data?.length));
    if (error) setLivePaymentError("Não foi possível verificar o caixa: " + error.message);
  };
  const confirmLivePayment = async (method: PaymentMethod) => {
    if (!supabase || !liveOrder || !selectedLiveTable || liveBusy) return;
    setLiveBusy(true); setLivePaymentError("");
    try {
      const { data: cash, error: cashError } = await supabase.from("cash_sessions").select("id").eq("organization_id", liveOrg).is("closed_at", null).limit(1);
      if (cashError) throw cashError;
      if (!cash?.length) throw Error("Abra o caixa antes de confirmar o pagamento.");
      if (liveOrder.status === "open") {
        const { data, error } = await supabase.from("orders").update({ status: "closing", closing_at: new Date().toISOString() }).eq("id", liveOrder.id).eq("organization_id", liveOrg).eq("status", "open").select("id").maybeSingle();
        if (error) throw error;
        if (!data) throw Error("Comanda alterada em outro terminal. Consulte novamente.");
        setLiveOrder(current => current ? { ...current, status: "closing" } : null);
      }
      const { error } = await supabase.rpc("close_order_manual", { p_order_id: liveOrder.id, p_method: method });
      if (error) throw error;
      // Payment and order closure are committed atomically by close_order_manual.
      // Remove the settled order locally before closing both dialogs, so the table
      // becomes available immediately rather than reopening an empty order window.
      const paidTableId = selectedLiveTable.id;
      setLiveOrders(previous => previous.filter(order => order.table_id !== paidTableId));
      setLivePaymentOpen(false);
      setSelectedLiveTable(null); setTableOpeningChoice(false); setRegisteredInfoOpen(false);
      setLiveOrder(null);
      setLiveItems([]);
      // Reconcile with the database; never undo a successful payment if refresh fails.
      const { data: currentOrders, error: refreshError } = await supabase.from("orders")
        .select("table_id,status,customer_name").eq("organization_id", liveOrg)
        .in("status", ["open", "closing"]);
      if (!refreshError) setLiveOrders(currentOrders || []);
      else setLiveError("Pagamento confirmado, mas não foi possível atualizar a grade de mesas. Atualize a página.");
    } catch (error) { setLivePaymentError(error instanceof Error ? error.message : "Falha ao registrar pagamento."); }
    finally { setLiveBusy(false); }
  };
  useEffect(() => {
    let active = true;
    let refreshLive: (() => Promise<void>) | null = null;
    void import("../lib/supabase").then(async ({ supabase: browserClient }) => {
      if (active) setSupabase(browserClient);
      const supabase = browserClient;
      const refresh = async () => {
        const { data: auth } = await supabase.auth.getUser();
        if (!active) return;
        if (!auth.user) { setLiveError("Faça login na Gestão para acessar as comandas reais."); setLiveTables(null); setLiveLoading(false); return; }
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
    setSelectedLiveTable(table); setTableOpeningChoice(false); setRegisteredInfoOpen(false); setLiveProductPickerOpen(false); setLiveBusy(true); setLiveNotice(""); setLiveLoadFailed(false);
    setLiveOrder(null); setLiveItems([]); setLiveCustomerName(""); setLiveCustomerSaved("");
    try {
      const [orderResult,productResult,orgResult,categoriesResult] = await Promise.all([
        supabase.from("orders").select("id,status,order_number,customer_name,order_items(id,product_name,quantity,unit_price)").eq("organization_id",liveOrg).eq("table_id",table.id).in("status",["open","closing"]).maybeSingle(),
        supabase.from("products").select("id,name,sale_price,category_id").eq("organization_id",liveOrg).eq("active",true).order("name"),
        supabase.from("organizations").select("service_rate").eq("id",liveOrg).single(),
        supabase.from("product_categories").select("id,name").eq("organization_id",liveOrg).order("name"),
      ]);
      if (orderResult.error || productResult.error || orgResult.error || categoriesResult.error) throw orderResult.error || productResult.error || orgResult.error || categoriesResult.error;
      setLiveOrder(orderResult.data ? {id:orderResult.data.id,status:orderResult.data.status,order_number:orderResult.data.order_number} : null);
      setTableOpeningChoice(!orderResult.data);
      setLiveItems(orderResult.data?.order_items || []);
      setLiveCustomerName(orderResult.data?.customer_name || "");
      setLiveCustomerSaved(orderResult.data?.customer_name || "");
      setLiveProducts(productResult.data || []);
      setLiveCategories(categoriesResult.data || []);
      setLiveRate(Number(orgResult.data?.service_rate || 0));
      const {data: currentOrders, error: refreshError} = await supabase.from("orders")
        .select("table_id,status,customer_name").eq("organization_id",liveOrg).in("status",["open","closing"]);
      if (refreshError) throw refreshError;
      setLiveOrders(currentOrders || []);
    } catch(e) { setLiveLoadFailed(true); setLiveNotice(e instanceof Error ? e.message : "Erro ao consultar mesa."); }
    finally { setLiveBusy(false); }
  };
  const saveLiveCustomer = async () => {
    if (!supabase || !liveOrg || !liveOrder || liveCustomerSaving || liveLoadFailed) return;
    const name=liveCustomerName.trim().slice(0,120);
    if (name===liveCustomerSaved) return;
    setLiveCustomerSaving(true);
    try {
      const {data,error}=await supabase.from("orders").update({customer_name:name||null})
        .eq("id",liveOrder.id).eq("organization_id",liveOrg).in("status",["open","closing"])
        .select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw Error("Comanda alterada. Atualize e tente novamente.");
      setLiveCustomerSaved(name);
      setLiveOrders(prev=>prev.map(order=>order.table_id===selectedLiveTable?.id?{...order,customer_name:name||null}:order));
      setLiveNotice("Nome salvo na comanda.");
    } catch(e) { setLiveNotice(e instanceof Error?e.message:"Falha ao salvar o nome."); }
    finally { setLiveCustomerSaving(false); }
  };
  // Persist customer changes automatically after typing stops; skip new/blocked orders.
  useEffect(() => {
    if (!liveOrder || !selectedLiveTable || liveLoadFailed || liveCustomerSaving || liveBusy) return;
    if (liveCustomerName.trim().slice(0,120) === liveCustomerSaved) return;
    const timeout = window.setTimeout(() => { void saveLiveCustomer(); }, 650);
    return () => window.clearTimeout(timeout);
  }, [liveCustomerName, liveCustomerSaved, liveCustomerSaving, liveBusy, liveOrder, selectedLiveTable, liveLoadFailed]);

  // Flush a pending customer-name edit before closing so it is never lost.
  const closeLiveTable = async () => {
    if (liveOrder && !liveLoadFailed && liveCustomerName.trim().slice(0,120) !== liveCustomerSaved) await saveLiveCustomer();
    setSelectedLiveTable(null);
  };
  useEffect(() => {
    if (!selectedLiveTable) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (livePaymentOpen) return;
      if (event.key === "F5" && liveOrder) { event.preventDefault(); void openLivePayment(); }
      if (event.key === "F3" && (!liveOrder || liveOrder.status === "open")) {
        event.preventDefault();
        setLiveProductPickerOpen(true);
      }
      if (event.key === "Escape" && liveProductPickerOpen) {
        event.preventDefault();
        setLiveProductPickerOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedLiveTable, liveOrder, liveProductPickerOpen, livePaymentOpen]);

  const createLiveEmptyOrder = async () => {
    if (!supabase || !liveOrg || !selectedLiveTable || liveBusy || liveLoadFailed || liveOrder) return;
    const table = selectedLiveTable;
    setLiveBusy(true);
    setLiveNotice("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw Error("Faça login na Gestão.");
      const { data: existing, error: lookupError } = await supabase.from("orders")
        .select("id,status").eq("organization_id", liveOrg).eq("table_id", table.id)
        .in("status", ["open","closing"]).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing?.status === "closing") throw Error("Mesa encaminhada ao caixa. Atualize os dados.");
      if (!existing) {
        const { error: insertError } = await supabase.from("orders").insert({
          organization_id: liveOrg, table_id: table.id, order_type: "table",
          status: "open", customer_name: liveCustomerName.trim().slice(0,120) || null,
          created_by: auth.user.id,
        });
        if (insertError) throw insertError;
      }
      await openLiveTable(table);
      setTableOpeningChoice(false);
      setLiveNotice(existing ? "Comanda já estava aberta." : "Comanda de passagem aberta. A mesa continuará ocupada ao sair da janela.");
      setLiveNoticeSequence(n => n + 1);
    } catch (error) {
      setLiveNotice(error instanceof Error ? error.message : "Não foi possível abrir a comanda.");
    } finally { setLiveBusy(false); }
  };
  const addLiveBatch = async () => {
    if (!supabase || !liveOrg || !selectedLiveTable || liveBusy || liveLoadFailed || liveOrder?.status === "closing") return;
    const entries = Object.entries(liveBatch).filter(([id,qty])=>liveProducts.some(p=>p.id===id)&&Number.isInteger(qty)&&qty>0&&qty<=100);
    if (!entries.length) { setLiveNotice("Selecione a quantidade de pelo menos um produto."); return; }
    setLiveBusy(true);
    setLiveNotice("");
    let orderId = liveOrder?.id;
    let completed = 0;
    try {
      if (!orderId) {
        const {data:auth} = await supabase.auth.getUser();
        if (!auth.user) throw Error("Faça login na Gestão.");
        const {data:existing,error:lookupError} = await supabase.from("orders").select("id,status").eq("organization_id",liveOrg).eq("table_id",selectedLiveTable.id).in("status",["open","closing"]).maybeSingle();
        if (lookupError) throw lookupError;
        if (existing?.status==="closing") throw Error("Esta mesa está em fechamento. Atualize a comanda.");
        if (existing) orderId=existing.id;
        else {
          const {data:created,error:createError} = await supabase.from("orders").insert({organization_id:liveOrg,table_id:selectedLiveTable.id,order_type:"table",status:"open",customer_name:liveCustomerName.trim().slice(0,120)||null,created_by:auth.user.id}).select("id").single();
          if (createError) throw createError;
          orderId=created?.id;
        }
      }
      if (!orderId) throw Error("Não foi possível abrir a comanda.");
      for (const [productId,quantity] of entries) {
        const {error} = await supabase.rpc("add_order_product",{p_order_id:orderId,p_product_id:productId,p_quantity:quantity});
        if (error) throw error;
        completed++;
        setLiveBatch(prev=>{const next={...prev};delete next[productId];return next;});
      }
      setLiveProductPickerOpen(false);
      setLiveNotice(`${completed} produto(s) lançado(s) na mesa com sucesso.`);
      setLiveNoticeSequence(n=>n+1);
    } catch(error) {
      setLiveNotice(`Foram lançados ${completed} de ${entries.length} produtos. ${error instanceof Error?error.message:"Falha ao lançar produtos."}`);
    } finally {
      await openLiveTable(selectedLiveTable).catch(()=>{});
      setLiveBusy(false);
    }
  };
  const sendLiveOrderToCashier = async () => {
    if (!liveOrder || !selectedLiveTable || !liveOrg || !supabase || liveBusy || liveLoadFailed || liveOrder.status !== "open") return;
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
    <div className={"relative mx-auto flex select-none flex-col bg-background text-app-text "+(embedded?"h-screen w-full":"h-[1080px] w-[1920px]")}>
      <header className={(embedded?"hidden ":"")+"flex h-8 items-center justify-between border-b border-app-border bg-app-chrome px-2 text-xs"}>
        <div className="flex space-x-1">
          <button className="translate-y-[1px] border-b-background border-l border-r border-t border-app-border bg-background px-3 py-1 font-semibold text-app-blue">PRINCIPAL</button>
          <a href="/produtos" className="px-3 py-1 font-semibold text-app-blue hover:bg-app-chrome-hover">PRODUTOS</a>
          {["FINANCEIRO", "CONFIGURAÇÕES", "APPS"].map((t) => (
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

      <nav className={(embedded?"hidden ":"")+"flex h-[88px] items-stretch border-b border-app-border bg-app-ribbon text-center text-xs"}>
        <div className="relative flex min-w-[130px] items-stretch border-r border-app-border px-1 pb-1 pt-1">
          <div className="flex w-full justify-center space-x-1">
            <RibbonButton onClick={() => setCashOpen(true)} width="w-20" svg={icon("M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10", "text-app-icon-blue")}>Abrir / Fechar<br />Meu Caixa</RibbonButton>
            <RibbonButton onClick={()=>setCashHistoryOpen(true)} width="w-20" svg={icon("M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", "text-app-icon-navy")}>Histórico<br />do Caixa</RibbonButton>
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

      <div className={(embedded?"hidden ":"")+"flex h-12 shrink-0 items-center justify-between border-b border-app-border bg-background px-4 shadow-sm"}>
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
          <div data-tguia-live-tables="true">
            {liveError && <p role="alert" className="mb-4 border border-amber-300 bg-amber-50 p-3 text-sm">{liveError}</p>}
            <h1 className="mb-4 text-sm font-bold">Mesas do restaurante · Supabase</h1>
            <div className="mb-5 flex flex-wrap gap-3">
              {liveTables.filter(t => liveOrders.some(o => o.table_id === t.id)).filter(t => !tableQuery.trim() || String(t.number).includes(tableQuery.trim())).map(t => {
                const order = liveOrders.find(o => o.table_id === t.id);
                return <button type="button" key={t.id} onClick={() => void openLiveTable(t)} className="table-box-active flex h-24 w-24 flex-col items-center justify-center text-white" style={{backgroundColor:order?.status === "closing" ? "#e5ad1d" : "#32965d"}}><span className="text-2xl font-bold">{t.number}</span><span className="text-xs">{order?.status === "closing" ? "No caixa" : "Ocupada"}</span>{order?.customer_name&&<span title={order.customer_name} className="w-[90px] truncate px-1 text-[11px] font-semibold">{order.customer_name}</span>}</button>;
              })}
            </div>
            <h2 className="mb-4 text-sm font-bold">Mesas livres</h2>
            <div className="app-grid">
              {liveTables.filter(t => !liveOrders.some(o => o.table_id === t.id)).filter(t => !tableQuery.trim() || String(t.number).includes(tableQuery.trim())).map(t => <button type="button" key={t.id} onClick={() => void openLiveTable(t)} className="table-box flex h-[88px] flex-col justify-start pt-1 text-center text-app-on-dark"><span className="text-[9px]">ABRIR</span><span className="mt-2 text-2xl font-bold">{t.number}</span></button>)}
            </div>
            {!liveTables.length && !liveError && <p className="text-sm">Nenhuma mesa cadastrada. Acesse Gestão para cadastrar.</p>}
          </div> :
          <div className="mb-3 border border-amber-300 bg-amber-50 p-3 text-xs">{liveError || "Modo de demonstração local."} A operação real exige conexão com o restaurante; nenhuma comanda local será exibida quando houver erro de conexão. <a href="/gestao" className="underline">Acessar Gestão</a></div>}

        {!liveLoading && !liveError && liveTables === null && <>

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

      {selectedLiveTable && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1f2c3b]/95 px-4 py-6">
        <section role="dialog" aria-modal="true" aria-label={"Mesa/Comanda "+selectedLiveTable.number} className="relative flex h-[633px] max-h-[92vh] w-[741px] max-w-[96vw] flex-col overflow-hidden border border-[#999] bg-white font-[Segoe_UI,Tahoma,Geneva,Verdana,sans-serif] text-[12px] text-[#273142] shadow-2xl">
          {tableOpeningChoice && !liveOrder && !liveBusy && !liveLoadFailed && <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1f2c3b]/85 p-3">
            <div role="dialog" aria-modal="true" aria-label="Como abrir mesa" className="w-full max-w-[420px] border border-[#777] bg-white p-5 text-[#253442] shadow-2xl">
              <div className="mb-3 flex items-center justify-between"><strong className="text-lg">Mesa {selectedLiveTable.number} — Livre</strong><button type="button" aria-label="Voltar" className="px-2 text-lg" onClick={()=>void closeLiveTable()}>×</button></div>
              <p className="mb-4 text-sm">Como deseja abrir esta mesa?</p>
              <button type="button" onClick={()=>setRegisteredInfoOpen(v=>!v)} className="mb-2 w-full border border-[#aaa] bg-[#eaf2fc] px-4 py-3 text-left font-semibold">Cliente cadastrado</button>
              {registeredInfoOpen && <p role="status" className="mb-3 border-l-4 border-amber-500 bg-amber-50 p-3 text-xs">A identificação segura por senha do cliente ainda depende do cadastro central de clientes. Nenhuma senha será solicitada ou validada pelo aparelho do garçom até essa integração estar pronta. Para clientes de passagem, use a opção abaixo.</p>}
              <button type="button" disabled={liveBusy} onClick={()=>{setLiveCustomerName("");void createLiveEmptyOrder();}} className="w-full bg-[#32935f] px-4 py-3 text-left font-bold text-white disabled:opacity-50">Abrir sem cadastro ou senha</button>
              <p className="mt-3 text-xs text-gray-500">Abre uma comanda real, vinculada apenas a esta mesa. O pagamento será feito normalmente no caixa.</p>
            </div>
          </div>}
          <div className="flex h-[30px] shrink-0 items-center justify-between border-b border-[#a0a0a0] bg-gradient-to-b from-[#e6e6e6] to-[#d4d4d4] px-2">
            <strong>Mesa/Comanda: {selectedLiveTable.number} {liveOrder?"(#"+liveOrder.order_number+")":""}</strong>
            <button onClick={() => void closeLiveTable()} aria-label="Fechar comanda" className="h-6 w-7 border border-[#aaa] bg-[#e1e1e1] hover:bg-red-200">×</button>
          </div>
          <div className="flex min-h-[69px] shrink-0 items-center gap-4 border-b border-[#d3d3d3] px-4">
            <span className="text-[27px] font-bold text-[#2f9b61]">{String(selectedLiveTable.number).padStart(2,"0")}</span>
            <div className="flex-1"><div className="flex items-center gap-2"><b>Pedido {liveOrder?"#"+liveOrder.order_number:"novo"}</b><span className={"px-2 py-1 text-white "+(liveOrder?.status==="closing"?"bg-[#a47b22]":"bg-[#32935f]")}>{liveOrder?.status==="closing"?"Aguardando caixa":liveOrder?"Em Aberto":"Livre"}</span></div><p className="mt-1 text-[11px] text-gray-500">Atendimento conectado ao Supabase</p></div>
            <button type="button" disabled={liveBusy||liveLoadFailed||liveOrder?.status==="closing"} onClick={()=>{setLiveProductQuery("");setLiveProductPickerOpen(true);}} className="font-bold text-[#087cf0] hover:underline disabled:opacity-40">Produtos (F3)</button>
          </div>
          {liveNotice && <p role="status" className="shrink-0 border-b border-[#d1e6d5] bg-[#edf8ee] px-3 py-2 font-semibold text-[#256b38]">{liveNotice}</p>}
          <div className="flex min-h-0 flex-1">
            <aside className="flex w-[221px] shrink-0 flex-col gap-3 border-r border-[#d6d6d6] bg-[#ededed] p-3">
              <label className="font-semibold">Nome do cliente
                <input aria-label="Nome do cliente da mesa" maxLength={120} value={liveCustomerName} onChange={e=>setLiveCustomerName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}} placeholder="Digite o nome" className="mt-1 w-full border border-[#b7c2cc] bg-white px-2 py-2 font-normal"/>
              </label>
              <span role="status" className="text-[11px] text-gray-500">{liveCustomerSaving?"Salvando nome...":liveOrder?(liveCustomerName.trim()===liveCustomerSaved?"Nome salvo automaticamente":"Salvamento automático ativo"):"Digite o nome e clique em Abrir comanda"}</span>
              <strong>Informações do Pedido</strong>
              <span>{liveOrder?"Comanda #"+liveOrder.order_number:"Mesa sem comanda aberta"}</span>
              <div className="mt-auto text-[#1b78b0]">TGuia Food · Atendimento</div>
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex h-9 shrink-0 items-center justify-between border-b border-[#ddd] px-2"><strong>Itens do Pedido ({liveItems.reduce((sum,item)=>sum+item.quantity,0)})</strong><span className="text-[11px] text-gray-500">Valores do cadastro real</span></div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {liveItems.length===0 && <div className="p-4 text-gray-400">Nenhum item lançado.</div>}
                {liveItems.map(item=><div key={item.id} className="grid h-9 grid-cols-[28px_1fr_76px] items-center border-b border-gray-100 px-2"><span className="bg-[#e3e3e3] text-center">{item.quantity}</span><span className="truncate pl-2">{item.product_name}</span><strong className="text-right">{new Intl.NumberFormat("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(item.quantity*item.unit_price)}</strong></div>)}
              </div>
              <div className="shrink-0 border-t border-[#ddd] text-right font-bold">
                <div className="flex justify-between border-b px-4 py-2"><span>SUBTOTAL:</span><span>{new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(liveItems.reduce((n,i)=>n+i.quantity*i.unit_price,0))}</span></div>
                <div className="flex justify-between border-b px-4 py-2"><span>(+) SERVIÇO ({liveRate}%):</span><span>{new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(liveItems.reduce((n,i)=>n+i.quantity*i.unit_price,0)*liveRate/100)}</span></div>
                <div className="flex justify-between px-4 py-2"><span>TOTAL:</span><span>{new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(liveItems.reduce((n,i)=>n+i.quantity*i.unit_price,0)*(1+liveRate/100))}</span></div>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#ccc] bg-[#f7f7f7] p-2">
            <button onClick={() => void closeLiveTable()} className="px-3 py-2 font-semibold text-[#1a79bb]">‹ Voltar (ESC)</button>
            <div className="flex flex-wrap gap-2">
              {!liveOrder&&<button type="button" disabled={liveBusy||liveLoadFailed} onClick={()=>setTableOpeningChoice(true)} className="bg-[#32935f] px-4 py-2 font-bold text-white disabled:opacity-40">Abrir comanda</button>}
              {liveOrder?.status==="open"&&<button type="button" onClick={()=>void sendLiveOrderToCashier()} disabled={liveBusy||liveLoadFailed||liveItems.length===0} className="border border-[#aaa] bg-white px-3 py-2 disabled:opacity-40">Encaminhar ao caixa</button>}
              {liveOrder&&<Button variant="pdv" size="sm" disabled={liveBusy || liveLoadFailed || liveItems.length === 0} onClick={() => void openLivePayment()}>Pagamento (F5)</Button>}
            </div>
          </div>
        </section>
      </div>}

      {selectedLiveTable && liveProductPickerOpen && <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/55 p-3">
        <section role="dialog" aria-modal="true" aria-label="Localizar produto do restaurante" className="flex h-[760px] max-h-[95vh] w-[1024px] max-w-[98vw] flex-col overflow-hidden border border-[#777] bg-white text-[#273142] shadow-xl">
          <div className="flex h-9 shrink-0 items-center justify-between border-b bg-gradient-to-b from-[#ededed] to-[#d6d6d6] px-3"><strong>Localizar Produto · Mesa {selectedLiveTable.number}</strong><button type="button" onClick={()=>setLiveProductPickerOpen(false)} aria-label="Fechar produtos" className="px-3 text-xl">×</button></div>
          <div className="flex min-h-0 flex-1">
            <aside className="grid w-[300px] max-w-[36%] shrink-0 auto-rows-[58px] grid-cols-2 content-start gap-2 overflow-y-auto bg-[#2b2b2b] p-2">
              {[{id:"all",name:"Todas"},...liveCategories].map((c,i)=><button type="button" key={c.id} onClick={()=>setLiveCategory(c.id)} className={`px-2 text-center text-xs font-semibold ${liveCategory===c.id?"ring-2 ring-white":""} ${i%5===0?"bg-[#2587af] text-white":i%5===1?"bg-[#408a76] text-white":i%5===2?"bg-[#e8bc45] text-black":i%5===3?"bg-[#6c78a6] text-white":"bg-[#e87948] text-white"}`}>{c.name}</button>)}
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="border-b bg-[#f5f5f5] p-3"><input autoFocus aria-label="Buscar produto" value={liveProductQuery} onChange={e=>setLiveProductQuery(e.target.value)} placeholder="Pesquisar produto..." className="w-full border border-[#ccc] p-2 text-sm"/></div>
              <div className="grid grid-cols-[1fr_90px_155px] border-b bg-[#f2f2f2] px-3 py-2 text-xs font-bold"><span>Produto</span><span>Preço</span><span className="text-center">Quantidade</span></div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {liveProducts.filter(p=>(liveCategory==="all"||p.category_id===liveCategory)&&p.name.toLocaleLowerCase("pt-BR").includes(liveProductQuery.trim().toLocaleLowerCase("pt-BR"))).map(p=><div key={p.id} className="grid min-h-[55px] grid-cols-[1fr_90px_155px] items-center gap-1 border-b px-3 text-sm hover:bg-[#edf5fd]">
                  <span className="min-w-0 truncate" title={p.name}>{p.name}</span><span>{new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(p.sale_price))}</span>
                  <div className="flex items-center justify-center gap-1"><button type="button" aria-label={`Diminuir ${p.name}`} disabled={liveBusy} onClick={()=>setLiveBatch(prev=>({...prev,[p.id]:Math.max(0,(prev[p.id]||0)-1)}))} className="h-9 w-9 border bg-[#e8e8e8] text-xl">−</button><input aria-label={`Quantidade ${p.name}`} type="number" min={0} max={100} disabled={liveBusy} value={liveBatch[p.id]||0} onChange={e=>setLiveBatch(prev=>({...prev,[p.id]:Math.max(0,Math.min(100,Math.trunc(Number(e.target.value)||0)))}))} className="h-9 w-[52px] border text-center"/><button type="button" aria-label={`Aumentar ${p.name}`} disabled={liveBusy} onClick={()=>setLiveBatch(prev=>({...prev,[p.id]:Math.min(100,(prev[p.id]||0)+1)}))} className="h-9 w-9 border bg-[#cce7fb] text-xl">+</button></div>
                </div>)}
                {!liveProducts.length&&<p className="p-4 text-sm">Nenhum produto ativo cadastrado neste restaurante.</p>}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-[#f4f4f4] p-3"><span className="text-sm font-semibold">{Object.values(liveBatch).reduce((n,q)=>n+q,0)} unidade(s) selecionada(s)</span><button type="button" disabled={liveBusy||Object.values(liveBatch).every(q=>q<=0)} onClick={()=>void addLiveBatch()} className="bg-[#3d3d3d] px-5 py-3 font-bold text-white disabled:opacity-40">{liveBusy?"Lançando...":"Adicionar selecionados à mesa"}</button></div>
            </div>
          </div>
        </section>
      </div>}
      {livePaymentOpen && selectedLiveTable && liveOrder && <PaymentModal key={liveOrder.id} table={String(selectedLiveTable.number).padStart(2, "0")} orderNumber={liveOrder.order_number} subtotal={liveItems.reduce((n, i) => n + i.quantity * i.unit_price, 0)} service={Math.round(liveItems.reduce((n, i) => n + i.quantity * i.unit_price, 0) * liveRate) / 100} cashOpen={liveCashAvailable} busy={liveBusy} error={livePaymentError} onClose={() => setLivePaymentOpen(false)} onConfirm={method => void confirmLivePayment(method)} />}
      {cashOpen && <CashRegisterModal onClose={() => setCashOpen(false)}/> }
      {cashHistoryOpen && <CashHistoryModal onClose={() => setCashHistoryOpen(false)}/> }
      <footer className={(embedded?"hidden ":"")+"relative z-10 flex h-10 shrink-0 items-center justify-between border-t border-app-border bg-app-chrome px-2 text-xs"}>
        <div className="flex items-center space-x-2"><div className="h-4 w-8 border border-app-border bg-app-field" /><span className="text-app-text">Exibir Total da Conta e Duração</span></div>
        <div className="absolute bottom-0 left-0 flex h-5 w-full items-center bg-app-status px-2 text-[11px]"><span className="text-app-text">{liveTables === null ? "Modo demonstração local — sem usuário de caixa autorizado" : "Mesas online: dados do restaurante autenticado"} <a className="text-app-blue underline" href="/gestao">Gestão / acesso</a></span></div>
      </footer>
    </div>
  );
}
