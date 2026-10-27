import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Session = { id:string; opened_at:string; closed_at:string|null; opening_balance:number; opening_note:string|null; closing_note:string|null; opened_by:string };
type CashMove = { id:string; session_id:string; created_at:string; description:string; direction:string; amount:number; method:string };
type Receipt = { id:string; cash_session_id:string|null; created_at:string; amount:number; method:string; orders:{order_number:number; customer_name:string|null}|null };
const currency = (amount:number) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(amount);
const dateTime = (value:string|null) => value ? new Date(value).toLocaleString("pt-BR") : "—";

export function CashHistoryModal({onClose}:{onClose:()=>void}) {
  const [org,setOrg] = useState("");
  const [sessions,setSessions] = useState<Session[]>([]);
  const [moves,setMoves] = useState<CashMove[]>([]);
  const [receipts,setReceipts] = useState<Receipt[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [mode,setMode] = useState<"recent"|"period">("recent");
  const [limit,setLimit] = useState(30);
  const [from,setFrom] = useState("");
  const [to,setTo] = useState("");
  const [operator,setOperator] = useState("all");
  const [selected,setSelected] = useState<string|null>(null);
  const [columns,setColumns] = useState(false);

  const refresh = async (organization:string) => {
    setLoading(true);setError("");
    try {
      const {data:shifts,error:shiftError} = await supabase.from("cash_sessions")
        .select("id,opened_at,closed_at,opening_balance,opening_note,closing_note,opened_by")
        .eq("organization_id",organization).order("opened_at",{ascending:false}).limit(500);
      if(shiftError)throw shiftError;
      const list=(shifts||[]) as Session[];
      const ids=list.map(s=>s.id);
      let movements:CashMove[]=[];
      let payments:Receipt[]=[];
      if(ids.length){
        const [m,p]=await Promise.all([
          supabase.from("cash_movements").select("id,session_id,created_at,description,direction,amount,method").in("session_id",ids),
          supabase.from("order_payments").select("id,cash_session_id,created_at,amount,method,orders(order_number,customer_name)").in("cash_session_id",ids)
        ]);
        if(m.error)throw m.error;
        if(p.error)throw p.error;
        movements=(m.data||[]) as CashMove[];
        payments=(p.data||[]).map(row=>({...row,orders:Array.isArray(row.orders)?row.orders[0]||null:row.orders||null})) as Receipt[];
      }
      setSessions(list);setMoves(movements);setReceipts(payments);
    }catch(e){setError(e instanceof Error?e.message:"Falha na consulta do histórico.");}
    finally{setLoading(false);}
  };
  useEffect(()=>{let active=true;void(async()=>{
    try{
      const {data:auth,error:authError}=await supabase.auth.getUser();
      if(authError)throw authError;
      if(!auth.user)throw Error("Faça login na Gestão para consultar o histórico.");
      const {data,error:memberError}=await supabase.from("organization_members")
        .select("organization_id").eq("user_id",auth.user.id).eq("active",true).limit(1);
      if(memberError)throw memberError;
      const organization=data?.[0]?.organization_id;
      if(!organization)throw Error("Usuário sem restaurante vinculado.");
      if(active){setOrg(organization);await refresh(organization);}
    }catch(e){if(active){setError(e instanceof Error?e.message:"Falha ao carregar histórico.");setLoading(false);}}
  })();return()=>{active=false;};},[]);

  const visible=useMemo(()=>{
    let list=sessions.filter(s=>operator==="all"||s.opened_by===operator);
    if(mode==="period") {
      if(from)list=list.filter(s=>s.opened_at.slice(0,10)>=from);
      if(to)list=list.filter(s=>s.opened_at.slice(0,10)<=to);
    }else list=list.slice(0,Math.max(1,limit));
    return list;
  },[sessions,mode,limit,from,to,operator]);
  const sums=(id:string)=>{
    const linked=moves.filter(m=>m.session_id===id);
    const inTotal=linked.filter(m=>m.direction==="in").reduce((n,m)=>n+Number(m.amount),0);
    const outTotal=linked.filter(m=>m.direction==="out").reduce((n,m)=>n+Number(m.amount),0);
    const received=receipts.filter(p=>p.cash_session_id===id).reduce((n,p)=>n+Number(p.amount),0);
    const shift=sessions.find(s=>s.id===id);
    return {received,inTotal,outTotal,total:Number(shift?.opening_balance||0)+inTotal-outTotal+received};
  };
  const active=selected?sessions.find(s=>s.id===selected):null;
  return <div className="fixed inset-0 z-[240] flex items-center justify-center bg-[#192838]/85 p-2 sm:p-4">
    <section role="dialog" aria-modal="true" aria-label="Histórico de Abertura e Fechamento de Caixa" className="flex h-[650px] max-h-[96vh] w-full max-w-[1240px] flex-col overflow-hidden border border-[#555] bg-[#f0f0f0] font-[Segoe_UI,Tahoma,Arial,sans-serif] text-[12px] text-[#333] shadow-2xl">
      <header className="flex h-8 shrink-0 items-center justify-between bg-[#3e3e3e] px-3 text-white"><strong>Histórico de Abertura e Fechamento de Caixa</strong><button type="button" onClick={onClose} aria-label="Fechar histórico" className="px-3 py-1 text-lg hover:bg-[#b91c1c]">×</button></header>
      <div className="flex shrink-0 justify-end gap-2 border-b border-[#d0d0d0] p-2">
        <button type="button" onClick={()=>window.print()} className="border border-[#b8b8b8] bg-white px-4 py-2">▤ Imprimir</button>
        <button type="button" onClick={()=>setColumns(v=>!v)} className="border border-[#b8b8b8] bg-white px-4 py-2">▦ {columns?"Menos colunas":"Mais colunas"}</button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2 md:flex-row">
        <aside className="w-full shrink-0 border border-[#c5c5c5] bg-white md:w-[232px]">
          <div className="border-b bg-[#fafafa] px-3 py-2 text-[#777]">Opções de Pesquisa</div>
          <div className="flex flex-col gap-3 p-3">
            <label className="flex items-center gap-2"><input type="radio" checked={mode==="recent"} onChange={()=>setMode("recent")}/> Exibir os mais recentes</label>
            <label className="flex items-center gap-2"><input type="radio" checked={mode==="period"} onChange={()=>setMode("period")}/> Filtrar por período</label>
            {mode==="recent"?<label>Últimos<input aria-label="Últimos caixas" type="number" min="1" max="500" value={limit} onChange={e=>setLimit(Number(e.target.value)||1)} className="mt-1 block w-full border p-1.5 text-right"/></label>:<>
              <label>De<input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="mt-1 block w-full border p-1"/></label>
              <label>Até<input type="date" value={to} onChange={e=>setTo(e.target.value)} className="mt-1 block w-full border p-1"/></label>
            </>}
            <label>Usuário<select value={operator} onChange={e=>setOperator(e.target.value)} className="mt-1 block w-full border bg-white p-1.5"><option value="all">Todos os usuários</option>{[...new Set(sessions.map(s=>s.opened_by))].map(id=><option key={id} value={id}>{id.slice(0,8)}</option>)}</select></label>
            <button type="button" disabled={loading||!org} onClick={()=>void refresh(org)} className="border border-[#aaa] bg-[#f8f8f8] px-3 py-2 disabled:opacity-50">⌕ {loading?"Pesquisando...":"Pesquisar"}</button>
          </div>
        </aside>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col border border-[#c5c5c5] bg-white">
          <div className="border-b bg-[#f7f7f7] px-3 py-2">Histórico <span className="ml-2 text-[#777]">({visible.length} caixas)</span></div>
          {error&&<p role="alert" className="border-b bg-red-50 p-2 text-red-700">{error}</p>}
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[1000px] border-collapse text-left text-[11px]">
              <thead className="sticky top-0 bg-[#f4f4f4]"><tr>{["Id","Aberto em","Fechado em","Saldo inicial","Saldo final calculado","Usuário","Status do caixa","Observação",...(columns?["Recebimentos","Entradas","Saídas"]:[]),"Detalhes"].map(h=><th key={h} className="whitespace-nowrap border-b border-r p-2 font-normal">{h}</th>)}</tr></thead>
              <tbody>{visible.map((s,index)=>{const b=sums(s.id);return <tr key={s.id} className={selected===s.id?"bg-[#dcecff]":index%2===0?"bg-[#f4f4f4]":"bg-white"}>
                <td className="border-b p-2" title={s.id}>{s.id.slice(0,8)}</td><td className="whitespace-nowrap border-b p-2">{dateTime(s.opened_at)}</td><td className="whitespace-nowrap border-b p-2">{dateTime(s.closed_at)}</td><td className="border-b p-2 text-right">{currency(Number(s.opening_balance))}</td><td className="border-b p-2 text-right">{currency(b.total)}</td><td className="border-b p-2" title={s.opened_by}>{s.opened_by.slice(0,8)}</td><td className="border-b p-2">{s.closed_at?"🚩 Fechado":"🟢 Aberto"}</td><td className="max-w-[200px] truncate border-b p-2" title={s.opening_note||""}>{s.opening_note||"—"}</td>
                {columns&&<><td className="border-b p-2 text-right">{currency(b.received)}</td><td className="border-b p-2 text-right">{currency(b.inTotal)}</td><td className="border-b p-2 text-right">{currency(b.outTotal)}</td></>}
                <td className="border-b p-2"><button type="button" aria-label="Detalhes do caixa" onClick={()=>setSelected(s.id)} className="font-bold text-sky-600">ⓘ</button></td>
              </tr>;})}</tbody>
            </table>
            {!loading&&!visible.length&&<p className="p-4 text-gray-500">Nenhum caixa encontrado.</p>}
          </div>
        </main>
      </div>
      {active&&<div className="absolute inset-0 z-10 flex items-center justify-center bg-[#162332]/85 p-2">
        <section role="dialog" aria-modal="true" aria-label="Histórico detalhado do caixa" className="flex h-[645px] max-h-[96vh] w-full max-w-[1192px] flex-col overflow-hidden border border-[#555] bg-[#ededed] shadow-2xl">
          <header className="flex h-[30px] shrink-0 items-center justify-between bg-[#343434] px-3 text-white"><strong>Histórico - Caixa {active.id.slice(0,8)} · {active.closed_at?"Fechado":"Aberto"}</strong><button type="button" onClick={()=>setSelected(null)} aria-label="Fechar histórico detalhado" className="px-3 text-lg hover:bg-red-600">×</button></header>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 lg:flex-row lg:overflow-hidden">
            <aside className="flex w-full shrink-0 flex-col justify-between lg:w-[215px]">
              <div className="space-y-4">
                <div className={`py-2.5 text-center text-[15px] font-bold text-white ${active.closed_at?"bg-[#dc3541]":"bg-[#31935b]"}`}>{active.closed_at?"Caixa Fechado":"Caixa Aberto"}</div>
                <label className="block text-[#777]">Saldo inicial (dinheiro):<input readOnly value={currency(Number(active.opening_balance))} className="mt-1 block w-36 border border-[#aaa] bg-[#e5e5e5] px-2 py-1 text-right"/></label>
                <div><div className="mb-1 text-[#777]">Observação:</div><div className="min-h-[100px] border border-[#aaa] bg-white p-2">{active.opening_note||"Sem observação"}</div></div>
              </div>
              <div className="space-y-4 pb-8 pt-4"><div><b>Data / Hora de abertura:</b><p>{dateTime(active.opened_at)}</p></div><div><b>Data / Hora de fechamento:</b><p>{dateTime(active.closed_at)}</p></div></div>
            </aside>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="mb-3 flex items-baseline justify-between gap-2"><strong className="text-lg">Caixa {active.id.slice(0,8)}</strong><span className={active.closed_at?"text-red-600":"text-green-700"}>ID do Caixa: [{active.closed_at?"Fechado":"Aberto"}]</span></div>
              <div className="flex min-h-[270px] flex-1 flex-col border border-[#aaa] bg-white">
                <div className="border-b bg-[#ddd] px-3 py-2 font-semibold">Movimentação</div>
                <div className="min-h-0 flex-1 overflow-auto">
                  <table className="w-full min-w-[530px] border-collapse text-left text-[11px]">
                    <thead className="sticky top-0 bg-[#f1f1f1]"><tr>{["Data / Hora","Descrição","Entrada","Saída","Forma Pagto."].map(col=><th key={col} className="border-b border-r px-2 py-2 font-normal">{col}</th>)}</tr></thead>
                    <tbody>
                      <tr><td className="border-b px-2 py-2">{dateTime(active.opened_at)}</td><td className="border-b px-2 py-2">SALDO INICIAL</td><td className="border-b px-2 py-2 text-right text-blue-600">{currency(Number(active.opening_balance))}</td><td className="border-b px-2 py-2"></td><td className="border-b px-2 py-2">Dinheiro</td></tr>
                      {[...moves.filter(m=>m.session_id===active.id).map(m=>({id:m.id,at:m.created_at,description:m.description,amount:Number(m.amount),direction:m.direction,method:m.method})),...receipts.filter(p=>p.cash_session_id===active.id).map(p=>({id:p.id,at:p.created_at,description:`Pedido nº ${p.orders?.order_number??"—"}${p.orders?.customer_name?" · "+p.orders.customer_name:""}`,amount:Number(p.amount),direction:"in",method:p.method}))].sort((a,b)=>a.at.localeCompare(b.at)).map(row=><tr key={row.id} className="hover:bg-[#f3f8fc]"><td className="whitespace-nowrap border-b px-2 py-2">{dateTime(row.at)}</td><td className="border-b px-2 py-2">{row.description}</td><td className="border-b px-2 py-2 text-right text-blue-600">{row.direction==="in"?currency(row.amount):""}</td><td className="border-b px-2 py-2 text-right">{row.direction==="out"?currency(row.amount):""}</td><td className="border-b px-2 py-2">{({cash:"Dinheiro",pix:"Pix",credit:"Crédito",debit:"Débito",other:"Outros"} as Record<string,string>)[row.method]||row.method}</td></tr>)}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-5 border-t p-2 font-bold"><span>Entradas: {currency(sums(active.id).received+sums(active.id).inTotal)}</span><span>Saídas: {currency(sums(active.id).outTotal)}</span></div>
                <button type="button" onClick={()=>window.print()} className="self-start border-t px-4 py-2">▤ Imprimir</button>
              </div>
            </div>
            <aside className="flex min-h-[270px] w-full shrink-0 flex-col lg:w-[290px] lg:pt-9">
              <div className="flex min-h-0 flex-1 flex-col border border-[#aaa] bg-white">
                <div className="border-b bg-[#ddd] px-3 py-2 font-semibold">Resumo</div>
                <div className="flex-1 space-y-4 overflow-auto p-3 text-[11px]">
                  <div className="flex justify-between"><span>(+) SALDO INICIAL:</span><b>{currency(Number(active.opening_balance))}</b></div>
                  <div>(+) ENTRADAS NO CAIXA</div>
                  <div className="pl-2 text-[#777]">PEDIDOS</div>
                  {["cash","pix","credit","debit","other"].map(method=>{const n=receipts.filter(p=>p.cash_session_id===active.id&&p.method===method).reduce((s,p)=>s+Number(p.amount),0);return n>0?<div key={method} className="flex justify-between gap-2 pl-2"><span>{({cash:"Dinheiro",pix:"Pix",credit:"Cartão de Crédito",debit:"Cartão de Débito",other:"Outros"} as Record<string,string>)[method]}</span><strong className="text-blue-600">{currency(n)}</strong></div>:null;})}
                  <div className="flex justify-between pl-2"><span>Outras entradas:</span><b className="text-blue-600">{currency(sums(active.id).inTotal)}</b></div>
                  <div className="flex justify-between border-t pt-2"><span>TOTAL - ENTRADAS</span><b className="text-blue-600">{currency(sums(active.id).received+sums(active.id).inTotal)}</b></div>
                  <div>(-) SAÍDAS DO CAIXA</div><div className="flex justify-between pl-2"><span>Saídas registradas:</span><b>{currency(sums(active.id).outTotal)}</b></div>
                  <div className="flex justify-between border-t pt-2 font-bold"><span>(=) SALDO FINAL CALCULADO</span><span>{currency(sums(active.id).total)}</span></div>
                  <p className="text-[10px] text-gray-500">Resumo calculado com os recebimentos e movimentos associados a este turno; não representa conferência física informada.</p>
                </div>
                <button type="button" onClick={()=>window.print()} className="border-t px-4 py-2 text-left">▤ Imprimir</button>
              </div>
            </aside>
          </div>
        </section>
      </div>}
    </section>
  </div>;
}
