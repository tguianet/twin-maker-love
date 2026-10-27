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
  const [showClosingOnly, setShowClosingOnly] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [tables, setTables] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState("");
  const [requestedTableId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("mesa") || "");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [customerEdits, setCustomerEdits] = useState<Record<string,string>>({});
  const [customerSaving, setCustomerSaving] = useState<string|null>(null);
  const [saving, setSaving] = useState(false);
  const [serviceRate, setServiceRate] = useState(0);
  const [products, setProducts] = useState<{ id: string; name: string; sale_price: number }[]>([]);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState<Record<string, number>>({});
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [rpcAvailable, setRpcAvailable] = useState(false);
  const [message, setMessage] = useState("");
  const [changingStatus, setChangingStatus] = useState<string | null>(null);
  const [settling, setSettling] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<Record<string,string>>({});
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null);
  const [cashOpen, setCashOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const { supabase } = await import("../lib/supabase");
        if (cancelled) return;
        setClient(supabase);
        setRpcAvailable((supabase as unknown as { supabaseUrl: string }).supabaseUrl === "https://eqelwfhiizigduybtkxh.supabase.co");
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
      const [ordersResult, tablesResult, productsResult, organizationResult, cashResult] = await Promise.all([
        client.from("orders").select("id, order_number, status, customer_name, opened_at, table_id, order_items(id, product_name, quantity, unit_price)")
          .eq("organization_id", org).in("status", ["open", "closing"]).order("opened_at", { ascending: false }).limit(200),
        client.from("restaurant_tables").select("id, number").eq("organization_id", org),
        client.from("products").select("id, name, sale_price").eq("organization_id", org).eq("active", true).order("name").limit(500),
        client.from("organizations").select("service_rate").eq("id", org).single(),
        client.from("cash_sessions").select("id").eq("organization_id",org).is("closed_at",null).limit(1),
      ]);
      if (ordersResult.error) throw ordersResult.error;
      if (tablesResult.error) throw tablesResult.error;
      if (productsResult.error) throw productsResult.error;
      if (organizationResult.error) throw organizationResult.error;
      if (cashResult.error) throw cashResult.error;
      setCashOpen(Boolean(cashResult.data?.length));
      setServiceRate(Number(organizationResult.data?.service_rate || 0));
      setOrders((ordersResult.data || []) as Order[]);
      const availableTables = Object.fromEntries((tablesResult.data || []).map(t => [t.id, t.number]));
      setTables(availableTables);
      if (requestedTableId && Object.prototype.hasOwnProperty.call(availableTables, requestedTableId)) setSelectedTableId(requestedTableId);
      setProducts((productsResult.data || []) as { id: string; name: string; sale_price: number }[]);
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao consultar comandas."); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    if (!client || !org) return;
    // Refresh explicitly on organization changes, not on an interval.
    void Promise.resolve().then(refresh);
  }, [client, org]);
  const saveCustomerName = async (order:Order, value:string) => {
    if (!client || !org || customerSaving) return;
    const name=value.trim().slice(0,120);
    if (name === (order.customer_name || "")) return;
    setCustomerSaving(order.id); setError("");
    try {
      const {data,error:failure}=await client.from("orders").update({customer_name:name||null})
       .eq("id",order.id).eq("organization_id",org).in("status",["open","closing"])
       .select("id").maybeSingle();
      if(failure)throw failure;
      if(!data)throw Error("A comanda foi alterada. Atualize a consulta.");
      setOrders(previous=>previous.map(item=>item.id===order.id?{...item,customer_name:name||null}:item));
      setMessage("Nome do cliente salvo na comanda.");
    }catch(e){setError(e instanceof Error?e.message:"Falha ao salvar nome.");}
    finally{setCustomerSaving(null);}
  };
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
      setMessage("Comanda #" + data.order_number + " aberta no Supabase.");
      setSelectedTableId(""); setNewCustomerName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir a comanda.");
    } finally { setSaving(false); }
  };
  const changeOrderStatus = async (orderId: string, current: string) => {
    if (!client || !org || changingStatus || !["open", "closing"].includes(current)) return;
    const next = current === "open" ? "closing" : "open";
    setChangingStatus(orderId); setError(""); setMessage("");
    try {
      const { data, error: failure } = await client.from("orders")
        .update({ status: next })
        .eq("id", orderId).eq("organization_id", org).eq("status", current)
        .select("id").maybeSingle();
      if (failure) throw failure;
      if (!data) throw new Error("Comanda alterada por outro usuário. Atualize os dados.");
      setMessage(next === "closing"
        ? "Comanda encaminhada ao caixa. Nenhum pagamento foi registrado."
        : "Comanda reaberta para lançamento de produtos.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao mudar o status.");
    } finally { setChangingStatus(null); }
  };
  const settleOrder = async (order: Order) => {
    if (!client || settling || order.status !== "closing") return;
    const { data: openCash, error: cashError } = await client.from("cash_sessions")
      .select("id").eq("organization_id", org).is("closed_at", null).limit(1);
    if (cashError) { setError("Não foi possível verificar o caixa: " + cashError.message); return; }
    if (!openCash?.length) { setError("Abra o caixa na tela principal antes de confirmar o pagamento."); return; }
    const method = payMethod[order.id] || "cash";
    const subtotal = order.order_items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0);
    const total = Math.round(subtotal * (1 + serviceRate / 100) * 100) / 100;
    if (total <= 0) { setError("Não é possível quitar uma comanda vazia."); return; }
    if (!window.confirm("Confirma que recebeu " + money(total) + " e deseja fechar a comanda #" + order.order_number + "? Esta ação registra um recebimento manual.")) return;
    setSettling(order.id); setError(""); setMessage("");
    try {
      const { error: failure } = await client.rpc("close_order_manual", { p_order_id: order.id, p_method: method });
      if (failure) throw failure;
      setPaymentOrderId(null);
      setMessage("Comanda #" + order.order_number + " quitada manualmente e fechada.");
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao registrar o pagamento."); }
    finally { setSettling(null); }
  };
  const addItem = async (orderId: string) => {
    if (!client || addingTo || !org || !rpcAvailable) return;
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
  return <div className="min-h-screen bg-background font-sans text-app-text">
    <header className="flex min-h-9 flex-wrap items-center justify-between border-b border-app-border bg-app-chrome px-3 text-xs">
      <nav className="flex flex-wrap items-center gap-1">
        <a href="/" className="px-3 py-2 font-semibold text-app-blue hover:bg-app-chrome-hover">PRINCIPAL</a>
        <span className="border-b-2 border-app-blue bg-background px-3 py-2 font-semibold text-app-blue">CAIXA / COMANDAS</span>
        <a href="/gestao" className="px-3 py-2 text-app-muted hover:bg-app-chrome-hover">PRODUTOS / GESTÃO</a>
        <a href="/historico-online" className="px-3 py-2 text-app-muted hover:bg-app-chrome-hover">HISTÓRICO DO CAIXA</a>
      </nav>
      <span className="px-2 font-semibold">TGuia Food</span>
    </header>
    <div className="flex min-h-20 flex-wrap items-center gap-4 border-b border-app-border bg-app-ribbon px-5 py-3">
      <div className="border-r border-app-border pr-5"><div className="text-sm font-bold">Caixa / Comandas</div><div className="text-xs text-app-muted">Controle de pedidos</div></div>
      <div className="flex flex-wrap gap-2 text-xs">
        <a href="/" className="ribbon-button rounded-sm border border-app-border bg-white px-4 py-3 font-semibold">Mesas / Comandas (F3)</a>
        <a href="/historico-online" className="ribbon-button rounded-sm border border-app-border bg-white px-4 py-3 font-semibold">Histórico do Caixa</a>
        <a href="/gestao" className="ribbon-button rounded-sm border border-app-border bg-white px-4 py-3 font-semibold">Produtos / Estoque</a>
      </div>
    </div>
    <main className="mx-auto max-w-[1500px] p-4 lg:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-app-border pb-3">
        <div><h1 className="text-lg font-bold">Comandas em andamento</h1><p className="text-xs text-app-muted">Mesas e movimentações do restaurante</p></div>
        <span className="border border-app-border bg-app-chrome px-3 py-2 text-xs font-semibold">{orders.length} comandas em andamento</span>
      </div>
      {error && <p role="alert" className="mb-3 border border-red-300 bg-red-50 p-3 text-sm">{error}</p>}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select aria-label="Organização" className="border bg-white p-2" value={org} onChange={e => { setOrg(e.target.value); setOrders([]); setTables({}); setSelectedTableId(""); setMessage(""); }}>
          <option value="">Selecione a organização</option>
          {memberships.map(m => <option key={m.organization_id} value={m.organization_id}>{m.organizations?.name || m.organization_id}</option>)}
        </select>
        <button disabled={!org || loading} onClick={() => void refresh()} className="border bg-white px-4 py-2 font-semibold disabled:opacity-50">{loading ? "Consultando..." : "Atualizar consulta"}</button>
      </div>
      {!rpcAvailable && !!org && <p className="mb-3 border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Lançamento de produtos disponível apenas quando conectado ao Supabase exclusivo TGuia Food. A consulta continua disponível.</p>}
      {message && <p role="status" className="mb-3 border border-green-200 bg-green-50 p-3 text-sm">{message}</p>}
      {!!org && <section className="mb-5 rounded-sm border border-app-border bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-bold">Abrir comanda</h2>
        <p className="mb-3 text-xs text-app-muted">Selecione uma mesa livre. Mesas ocupadas já possuem comanda em andamento.</p>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Mesa para nova comanda" className="min-w-[180px] flex-1 border p-2" value={selectedTableId} onChange={e => setSelectedTableId(e.target.value)}>
            <option value="">Selecione uma mesa</option>
            {Object.entries(tables).filter(([id]) => !orders.some(o => o.table_id === id)).sort((a,b) => a[1]-b[1]).map(([id,number]) => <option key={id} value={id}>Mesa {number}</option>)}
          </select>
          <input aria-label="Nome opcional do cliente" maxLength={120} className="min-w-[180px] flex-1 border p-2" placeholder="Nome do cliente (opcional)" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} />
          <button type="button" disabled={saving || loading || !selectedTableId} onClick={() => void createOrder()} className="bg-app-blue px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? "Gravando..." : "Abrir comanda"}</button>
        </div>
      </section>}
      {authReady && !!org && orders.length === 0 && !loading && !error && <p className="border border-app-border bg-white p-4 text-sm">Nenhuma comanda em andamento. Selecione uma mesa livre acima para iniciar o atendimento.</p>}
      <div className="mb-4 flex flex-wrap gap-3 border bg-white p-3 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={showClosingOnly} onChange={e => setShowClosingOnly(e.target.checked)} /> Somente aguardando caixa</label><input aria-label="Buscar comanda" className="min-w-[200px] flex-1 border p-2" placeholder="Buscar número, mesa ou cliente" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} /><span className="self-center">{orders.filter(o => o.status === "closing").length} aguardando caixa</span></div>
      <div className="grid gap-3 xl:grid-cols-2">{orders.filter(order => (!showClosingOnly || order.status === "closing") && (!requestedTableId || order.table_id === requestedTableId) && (!orderSearch.trim() || [String(order.order_number), order.customer_name || "", order.table_id ? String(tables[order.table_id] || "") : ""].some(value => value.toLocaleLowerCase("pt-BR").includes(orderSearch.trim().toLocaleLowerCase("pt-BR"))))).map(order => {
        const subtotal = order.order_items.reduce((n, item) => n + item.quantity * item.unit_price, 0);
        const service = Math.round(subtotal * serviceRate) / 100;
        const total = Math.round((subtotal + service) * 100) / 100;
        return <section key={order.id} className="rounded-sm border border-app-border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap justify-between gap-3"><strong>Pedido #{order.order_number} {order.table_id ? "· Mesa " + (tables[order.table_id] || "?") : ""}</strong><span>{order.status === "closing" ? "Em fechamento" : "Aberto"} · {money(total)}</span></div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600"><label htmlFor={"cliente-"+order.id}>Cliente:</label><input id={"cliente-"+order.id} aria-label={"Nome do cliente da comanda "+order.order_number} maxLength={120} className="min-w-[200px] flex-1 border border-app-border bg-white px-2 py-1" placeholder="Nome do cliente" value={customerEdits[order.id]??order.customer_name??""} onChange={e=>setCustomerEdits(prev=>({...prev,[order.id]:e.target.value}))} onBlur={e=>void saveCustomerName(order,e.target.value)} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}} /><span className="text-xs">{customerSaving===order.id?"Salvando...":"Salva ao sair do campo"}</span><span className="text-xs">{new Date(order.opened_at).toLocaleString("pt-BR")}</span></div>
          <ul className="mt-2 text-sm">{order.order_items.map(item => <li key={item.id}>{item.quantity}× {item.product_name} — {money(item.unit_price)}</li>)}</ul>
          <div className="mt-3 rounded-sm border border-app-border bg-app-chrome p-3 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="flex justify-between"><span>Serviço ({serviceRate}%)</span><span>{money(service)}</span></div><div className="flex justify-between border-t pt-2 font-bold"><span>Total a receber</span><span>{money(total)}</span></div><p className="mt-2 text-xs text-slate-600">Resumo para conferência. Não registra pagamento ou baixa financeira.</p></div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={changingStatus !== null || addingTo !== null} onClick={() => void changeOrderStatus(order.id, order.status)}
              className="border border-app-border bg-app-ribbon px-3 py-2 text-sm font-semibold disabled:opacity-50">
              {changingStatus === order.id ? "Atualizando..." : order.status === "open" ? "Encaminhar ao caixa" : "Reabrir comanda"}
            </button>
            {order.status === "closing" && <button type="button" disabled={settling !== null || changingStatus !== null} onClick={() => setPaymentOrderId(order.id)} className="bg-app-blue px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Pagamento (F5)</button>}
          </div>
          {order.status === "open" && <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
            <select aria-label={"Produto do pedido " + order.order_number} className="min-w-[220px] flex-1 border p-2 text-sm" value={selection[order.id] || ""} onChange={e => setSelection(prev => ({ ...prev, [order.id]: e.target.value }))}>
              <option value="">Selecione um produto</option>
              {products.map(product => <option key={product.id} value={product.id}>{product.name} — {money(product.sale_price)}</option>)}
            </select>
            <input aria-label={"Quantidade do pedido " + order.order_number} className="w-24 border p-2 text-sm" type="number" min={1} max={100} step={1} value={quantity[order.id] ?? 1} onChange={e => setQuantity(prev => ({ ...prev, [order.id]: Number(e.target.value) }))} />
            <button type="button" disabled={!rpcAvailable || !selection[order.id] || addingTo !== null} onClick={() => void addItem(order.id)} className="bg-app-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{addingTo === order.id ? "Gravando..." : "Adicionar produto"}</button>
          </div>}
        </section>;
      })}</div>
    </main>
    {paymentOrderId && (() => {
      const order = orders.find(o=>o.id===paymentOrderId && o.status==="closing");
      if(!order)return null;
      const subtotal=order.order_items.reduce((n,i)=>n+Number(i.quantity)*Number(i.unit_price),0);
      const service=Math.round(subtotal*serviceRate)/100;
      const total=Math.round((subtotal+service)*100)/100;
      const method=payMethod[order.id]||"cash";
      const options=[{id:"cash",key:"A",label:"Dinheiro"},{id:"pix",key:"P",label:"Pix"},{id:"credit",key:"C",label:"Crédito"},{id:"debit",key:"B",label:"Débito"}];
      return <div className="fixed inset-0 z-[250] flex items-center justify-center bg-[#595959]/85 p-3">
        <section role="dialog" aria-modal="true" aria-label={"Pagamento da comanda "+order.order_number} className="flex max-h-[95vh] w-[960px] max-w-[96vw] flex-col overflow-hidden rounded-t-sm border border-[#303335] bg-white font-[Segoe_UI,Tahoma,Geneva,Verdana,sans-serif] text-[12px] shadow-2xl">
          <header className="flex items-center justify-between bg-[#3a3d40] px-3 py-1.5 text-white"><h2 className="text-[13px] font-semibold">Pagamento - Comanda {order.table_id?String(tables[order.table_id]||"").padStart(2,"0"):"—"}, Pedido {order.order_number}</h2><button type="button" aria-label="Fechar pagamento" onClick={()=>setPaymentOrderId(null)} className="px-2 hover:bg-red-700">✕</button></header>
          <div className="flex items-center justify-between border-b border-gray-200 bg-[#f8f9fa] px-4 py-2"><span className="text-gray-700">Conferir e rachar a conta <span className="ml-2 text-gray-400">(divisão de pagamentos ainda não habilitada)</span></span><span className={cashOpen?"font-semibold text-[#1e7e34]":"font-semibold text-red-700"}>{cashOpen?"ⓘ Caixa aberto":"Caixa fechado"}</span></div>
          <div className="flex min-h-[380px] flex-1 overflow-auto">
            <div className="flex w-9 shrink-0 items-center justify-center border-r border-gray-300 bg-[#f4f5f7] py-4"><span className="text-[11px] text-gray-600" style={{writingMode:"vertical-rl",transform:"rotate(180deg)"}}>Conferir Itens e rachar a conta</span></div>
            <section className="flex w-48 shrink-0 flex-col border-r border-gray-300 bg-[#fdfdfd] p-2.5"><h3 className="mb-2 font-semibold">Adicionar Pagamento</h3><div className="flex flex-col gap-1.5">
              {options.map(option=><button key={option.id} type="button" aria-pressed={method===option.id} onClick={()=>setPayMethod(prev=>({...prev,[order.id]:option.id}))} className={"flex items-center gap-2.5 rounded border px-2.5 py-2 text-left font-semibold shadow-sm "+(method===option.id?"border-[#1b62a6] bg-[#f0f6fc] text-[#1b62a6]":"border-gray-300 bg-white text-gray-800 hover:bg-gray-50")}><span className="flex h-6 w-6 items-center justify-center rounded border border-current">{option.key}</span>{option.key} - {option.label}</button>)}
              {["V. Refeição","Fiado","Outros"].map(label=><button key={label} type="button" disabled title="Requer suporte financeiro específico no banco" className="flex items-center gap-2.5 rounded border border-gray-300 bg-gray-100 px-2.5 py-2 text-left text-gray-400"><span className="flex h-6 w-6 items-center justify-center">·</span>{label} (indisponível)</button>)}
            </div></section>
            <section className="flex min-w-0 flex-1 flex-col bg-white p-4"><div className="mb-auto overflow-hidden rounded-t-sm border border-[#72a4d2]"><h3 className="border-b border-dashed border-[#72a4d2] bg-[#f0f6fc] px-3 py-1.5 font-bold text-[#1b62a6]">▾ A Pagar / Resumo dos Totais</h3><div className="space-y-2 px-8 py-3">
              <div className="flex justify-between"><span>Total dos itens</span><strong>{money(subtotal)}</strong></div><div className="flex justify-between border-t border-gray-100 pt-2"><span>(+) Serviço ({serviceRate}%)</span><strong>{money(service)}</strong></div><div className="flex justify-between border-t border-gray-100 pt-2"><span>Total a Pagar</span><strong>{money(total)}</strong></div>
            </div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 px-2 pt-3"><div className="flex items-baseline gap-3">Total Pago <strong className="text-2xl text-[#1a66b2]">{money(0)}</strong></div><div className="flex items-baseline gap-3">Falta pagar <strong className="text-2xl">{money(total)}</strong></div></div><p className="mt-3 text-[11px] text-gray-500">Recebimento integral manual. Selecione a forma efetivamente recebida e confirme para registrar no Supabase.</p></section>
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-300 bg-[#f4f5f7] px-4 py-2.5"><div className="flex gap-2"><button disabled title="Descontos ainda não suportados no fechamento financeiro" className="rounded border bg-gray-100 px-3 py-1.5 text-gray-400">Taxas e Descontos</button><button type="button" onClick={()=>window.print()} className="rounded border border-gray-300 bg-white px-3 py-1.5 shadow-sm">▤ Imprimir Cupom</button></div><div className="flex gap-2"><button type="button" onClick={()=>setPaymentOrderId(null)} className="rounded border border-gray-300 bg-white px-3.5 py-1.5">‹ Voltar</button><button type="button" disabled={!cashOpen||settling!==null||total<=0} onClick={()=>void settleOrder(order)} className="rounded bg-[#1b62a6] px-5 py-2 font-medium text-white disabled:opacity-50">{settling===order.id?"Registrando...":"Confirmar pagamento recebido"}</button></div></footer>
        </section>
      </div>;
    })()}
  </div>;
}
