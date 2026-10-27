import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Session = { id:string; opened_at:string; closed_at:string|null; opening_balance:number; opening_note:string|null; closing_note:string|null; opened_by:string };
type CashMove = { session_id:string; direction:string; amount:number; method:string };
type Receipt = { cash_session_id:string|null; amount:number; method:string };
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
          supabase.from("cash_movements").select("session_id,direction,amount,method").in("session_id",ids),
          supabase.from("order_payments").select("cash_session_id,amount,method").in("cash_session_id",ids)
        ]);
        if(m.error)throw m.error;
        if(p.error)throw p.error;
        movements=(m.data||[]) as CashMove[];
        payments=(p.data||[]) as Receipt[];
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
      {active&&<div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4"><section role="dialog" aria-modal="true" aria-label="Detalhes do caixa" className="w-full max-w-md border bg-white p-5 shadow-xl">
        <div className="mb-3 flex justify-between"><strong>Detalhes do caixa {active.id.slice(0,8)}</strong><button onClick={()=>setSelected(null)} aria-label="Fechar detalhes">×</button></div>
        <p>Abertura: {dateTime(active.opened_at)}</p><p>Fechamento: {dateTime(active.closed_at)}</p><p>Saldo inicial: {currency(Number(active.opening_balance))}</p><p>Recebimentos: {currency(sums(active.id).received)}</p><p>Saldo final calculado: {currency(sums(active.id).total)}</p><p className="mt-2">Observação: {active.opening_note||"—"}</p><p>Observação de fechamento: {active.closing_note||"—"}</p>
        <button onClick={()=>setSelected(null)} className="mt-4 border px-4 py-2">Voltar</button>
      </section></div>}
    </section>
  </div>;
}
