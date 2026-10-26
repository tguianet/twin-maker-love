import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Session = { id:string; opened_at:string; opening_balance:number; opening_note:string|null; closed_at:string|null };
type Movement = { id:string; created_at:string; description:string; direction:"in"|"out"; method:string; amount:number };
const fmt = (n:number) => new Intl.NumberFormat("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
const field="w-full border border-[#b5b5b5] bg-white px-2 py-1.5 text-xs";
const button="border border-[#b8b8b8] bg-[#f4f4f4] px-3 py-2 text-xs hover:bg-[#e8e8e8] disabled:opacity-40";
const methods:Record<string,string>={cash:"Dinheiro",pix:"Pix",debit:"Débito",credit:"Crédito",other:"Outros"};
export function CashRegisterModal({onClose}:{onClose:()=>void}) {
 const [org,setOrg]=useState("");const [operator,setOperator]=useState("");
 const [session,setSession]=useState<Session|null>(null);
 const [rows,setRows]=useState<Movement[]>([]);
 const [orderReceipts,setOrderReceipts]=useState<{id:string;created_at:string;method:string;amount:number}[]>([]);
 const [balance,setBalance]=useState("0,00");const [note,setNote]=useState("");
 const [description,setDescription]=useState("");const [amount,setAmount]=useState("");
 const [direction,setDirection]=useState<"in"|"out">("in");const [method,setMethod]=useState("cash");
 const [addOpen,setAddOpen]=useState(false);const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const [showClosed,setShowClosed]=useState(false);
 const [pastSession,setPastSession]=useState<Session|null>(null);
 const load=async (organization:string) => {
  const {data:sessions,error:se}=await supabase.from("cash_sessions").select("id,opened_at,opening_balance,opening_note,closed_at").eq("organization_id",organization).order("opened_at",{ascending:false}).limit(30);
  if(se)throw se;
  const active=(sessions||[]).find(x=>!x.closed_at)||null;
  setSession(active as Session|null);
  setPastSession(((sessions||[]).find(x=>!!x.closed_at)||null) as Session|null);
  const shown=showClosed ? ((sessions||[]).find(x=>!!x.closed_at)||null) : active;
  if(shown){
   const {data,error:me}=await supabase.from("cash_movements").select("id,created_at,description,direction,method,amount").eq("session_id",shown.id).order("created_at",{ascending:true});
   if(me)throw me;setRows((data||[]) as Movement[]);
  } else {setRows([]);}
  if(shown){
   const {data:receipts,error:receiptsError}=await supabase.from("order_payments")
    .select("id,created_at,method,amount,orders!inner(organization_id)")
    .eq("orders.organization_id",organization)
    .eq("cash_session_id",shown.id).order("created_at",{ascending:true});
   if(receiptsError)throw receiptsError;
   setOrderReceipts((receipts||[]).map(p=>({id:p.id,created_at:p.created_at,method:p.method,amount:Number(p.amount)})));
  } else setOrderReceipts([]);
 };
 useEffect(()=>{let mounted=true;void (async()=>{try{
  const {data:auth,error:e}=await supabase.auth.getUser();if(e)throw e;
  if(!auth.user)throw Error("Entre na Gestão para acessar o caixa.");
  const {data,error:m}=await supabase.from("organization_members").select("organization_id").eq("user_id",auth.user.id).eq("active",true).limit(1);if(m)throw m;
  if(!data?.length)throw Error("Usuário sem restaurante vinculado.");
  if(!mounted)return;setOrg(data[0]!.organization_id);setOperator(auth.user.email||"Operador");
  await load(data[0]!.organization_id);
 }catch(e){if(mounted)setError(e instanceof Error?e.message:"Falha ao abrir caixa.");}})();return()=>{mounted=false;};},[]);
  const run=async(action:()=>Promise<void>)=>{setBusy(true);setError("");setNotice("");try{await action();if(org)await load(org);}catch(e){setError(e instanceof Error?e.message:"Operação não concluída.");}finally{setBusy(false);}};
  const refresh=()=>run(async()=>{setNotice("Dados atualizados.");});
  useEffect(()=>{ if(!org)return; const update=async()=>{try{await load(org);}catch(e){setError(e instanceof Error?e.message:"Falha ao consultar turno.");}}; void update(); },[showClosed,org]);
 const open=()=>run(async()=>{
  const value=Number(balance.replace(/\./g,"").replace(",","."));
  if(!Number.isFinite(value)||value<0)throw Error("Saldo inicial inválido.");
  const {data:auth}=await supabase.auth.getUser();if(!auth.user)throw Error("Sessão expirada.");
  const {error:e}=await supabase.from("cash_sessions").insert({organization_id:org,opened_by:auth.user.id,opening_balance:value,opening_note:note.trim()||null});
  if(e)throw e;setNotice("Caixa aberto.");
 });
 const add=()=>run(async()=>{
  if(!session)throw Error("Abra o caixa.");
  const value=Number(amount.replace(/\./g,"").replace(",","."));
  if(!Number.isFinite(value)||value<=0||!description.trim())throw Error("Informe descrição e valor válido.");
  const {data:auth}=await supabase.auth.getUser();if(!auth.user)throw Error("Sessão expirada.");
  const {error:e}=await supabase.from("cash_movements").insert({session_id:session.id,organization_id:org,created_by:auth.user.id,description:description.trim(),direction,method,amount:value});
  if(e)throw e;setDescription("");setAmount("");setAddOpen(false);setNotice("Movimentação registrada.");
 });
 const close=()=>run(async()=>{
  if(!session)return;
  if(!window.confirm("Confirma o fechamento deste caixa? Não será possível adicionar novos lançamentos a este turno."))return;
  const {data:auth}=await supabase.auth.getUser();if(!auth.user)throw Error("Sessão expirada.");
  const {data, error:e}=await supabase.from("cash_sessions").update({closed_at:new Date().toISOString(),closed_by:auth.user.id}).eq("id",session.id).is("closed_at",null).select("id").maybeSingle();
  if(e)throw e;if(!data)throw Error("Este caixa já foi fechado em outro terminal. Atualize os dados.");setNotice("Caixa fechado.");
 });
 const historicalView=showClosed && !!pastSession;
 const displayedSession=historicalView?pastSession:session;
 const cashIn=rows.filter(x=>x.direction==="in").reduce((a,x)=>a+Number(x.amount),0);
 const cashOut=rows.filter(x=>x.direction==="out").reduce((a,x)=>a+Number(x.amount),0);
 const orderReceiptsTotal=orderReceipts.reduce((sum,r)=>sum+r.amount,0);
 const orderCash=orderReceipts.filter(r=>r.method==="cash").reduce((sum,r)=>sum+r.amount,0);
 const orderDigital=orderReceiptsTotal-orderCash;
 const cashBalance=Number(displayedSession?.opening_balance||0)+rows.filter(x=>x.method==="cash").reduce((a,x)=>a+(x.direction==="in"?1:-1)*Number(x.amount),0);
 return <div className="fixed inset-0 z-[220] flex items-center justify-center bg-[#696969]/95 p-3 text-[#343434]">
  <section role="dialog" aria-modal="true" aria-label="Controle de caixa" className="flex h-[655px] max-h-[94vh] w-[1205px] max-w-[98vw] flex-col overflow-hidden bg-[#f4f4f4] font-[Segoe_UI,Tahoma,sans-serif] text-xs shadow-2xl">
   <header className="flex h-[31px] shrink-0 items-center justify-between bg-[#444] px-3 text-[#ddd]"><span>Caixa · {operator||"TGuia Food"} {session?"· "+session.id.slice(0,8):""}</span><button onClick={onClose} aria-label="Fechar janela" className="px-2 text-lg text-white">×</button></header>
   <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto p-4 md:grid-cols-[236px_minmax(340px,1fr)_310px]">
    <aside className="flex flex-col border-r border-[#ccc] pr-4">
      <div className={"p-3 text-center font-bold text-white "+(session?"bg-[#38925c]":"bg-[#777]")}>{historicalView?"Turno encerrado":session?"Caixa Aberto":"Caixa Fechado"}</div>
      <label className="mt-6 text-[11px]">Saldo inicial (dinheiro):<input className={field+" mt-2 text-right"} disabled={!!displayedSession||busy} value={displayedSession?fmt(Number(displayedSession.opening_balance)):balance} onChange={e=>setBalance(e.target.value)}/></label>
      <label className="mt-4 text-[11px]">Observação:<textarea className={field+" mt-2 h-28 resize-none"} disabled={!!displayedSession||busy} value={displayedSession?displayedSession.opening_note||"":note} onChange={e=>setNote(e.target.value)}/></label>
      <div className="mt-auto pb-8"><b>Data / Hora de abertura:</b><p className="mt-2">{displayedSession?new Date(displayedSession.opened_at).toLocaleString("pt-BR"):"Não aberto"}</p></div>
      {!session&&!showClosed&&<button disabled={!org||busy} onClick={open} className="bg-[#38925c] px-3 py-3 font-bold text-white disabled:opacity-40">Abrir Caixa</button>}
    </aside>
    <div className="flex min-h-[370px] flex-col border border-[#b9b9b9] bg-white">
      <h2 className="bg-[#dedede] px-3 py-2 font-bold">Movimentação</h2>
      <label className="border-b px-3 py-2"><input type="checkbox" checked={showClosed} onChange={e=>setShowClosed(e.target.checked)}/> Consultar último turno fechado</label>
      <div className="min-h-0 flex-1 overflow-auto">
       <table className="w-full border-collapse text-left"><thead className="sticky top-0 bg-[#eaeaea]"><tr>{["Data / Hora","Descrição","Entrada","Saída","Forma Pagto."].map(t=><th key={t} className="border border-[#ccc] px-2 py-2 font-normal">{t}</th>)}</tr></thead>
       <tbody>{displayedSession&&<tr className="border-b"><td className="p-2">{new Date(displayedSession.opened_at).toLocaleString("pt-BR")}</td><td className="p-2">SALDO INICIAL</td><td className="p-2 text-right text-blue-600">{fmt(Number(displayedSession.opening_balance))}</td><td/><td className="p-2">Dinheiro</td></tr>}
       {rows.map(r=><tr key={r.id} className="border-b"><td className="whitespace-nowrap p-2">{new Date(r.created_at).toLocaleString("pt-BR")}</td><td className="p-2">{r.description}</td><td className="p-2 text-right">{r.direction==="in"?fmt(Number(r.amount)):""}</td><td className="p-2 text-right">{r.direction==="out"?fmt(Number(r.amount)):""}</td><td className="p-2">{methods[r.method]||r.method}</td></tr>)}</tbody></table>
      </div>
      <div className="border-t border-[#ccc] bg-[#f8f8f8] px-3 py-2"><div className="flex justify-between font-semibold"><span>Recebimentos de comandas (consulta)</span><span>{fmt(orderReceiptsTotal)}</span></div><p className="mt-1 text-[10px] text-[#777]">Registros separados do livro-caixa. Não somados aos lançamentos manuais para evitar duplicidade.</p>{orderReceipts.map(p=><div key={p.id} className="mt-1 flex justify-between border-t border-[#e5e5e5] py-1"><span>{new Date(p.created_at).toLocaleString("pt-BR")} · {methods[p.method]||p.method}</span><strong>{fmt(p.amount)}</strong></div>)}</div>
      <div className="flex justify-end gap-12 border-t px-4 py-2 font-bold"><span>{fmt(cashIn)}</span><span>{fmt(cashOut)}</span></div>
      <div className="flex justify-end gap-3 border-t bg-[#f5f5f5] p-2"><button className={button} disabled={!org||busy} onClick={refresh}>↻ Atualizar</button><button className={button} onClick={()=>window.print()}>▤ Imprimir</button><button className={button} disabled={!session||busy||showClosed} onClick={()=>setAddOpen(true)}>＋ Novo Lançamento</button></div>
    </div>
    <aside className="flex min-h-[370px] flex-col border border-[#b9b9b9] bg-white">
      <h2 className="bg-[#dedede] px-3 py-2 font-bold">Resumo</h2>
      <div className="space-y-5 p-3"><div className="flex justify-between"><span>(+) SALDO INICIAL:</span><b>{fmt(Number(displayedSession?.opening_balance||0))}</b></div>
      <div><div className="mb-2"> (+) ENTRADAS NO CAIXA</div><b className="block text-right">{fmt(cashIn)}</b></div>
      <div><div className="mb-2">(-) SAÍDAS DO CAIXA</div><b className="block text-right">{fmt(cashOut)}</b></div>
      <div className="border-t pt-3"><b>RECEBIMENTOS DE COMANDAS</b><div className="mt-2 flex justify-between"><span>Dinheiro:</span><b>{fmt(orderCash)}</b></div><div className="mt-2 flex justify-between"><span>Pix / Cartões:</span><b>{fmt(orderDigital)}</b></div><div className="mt-2 flex justify-between font-bold"><span>Total registrado:</span><span>{fmt(orderReceiptsTotal)}</span></div><p className="mt-2 text-[10px] text-[#777]">Consulta separada das movimentações manuais. Não incluído no saldo final abaixo.</p></div><div className="border-t pt-4"><b>(=) SALDO FINAL</b><div className="mt-4 flex justify-between"><span>Somente Dinheiro:</span><b>{fmt(cashBalance)}</b></div><div className="mt-4 flex justify-between"><span>TUDO:</span><b>{fmt(Number(displayedSession?.opening_balance||0)+cashIn-cashOut)}</b></div></div></div>
      <div className="mt-auto flex justify-end gap-2 border-t p-2"><button onClick={()=>window.print()} className={button}>▤ Imprimir</button><button onClick={close} disabled={!session||busy||showClosed} className={button}>✓ Fechar Caixa</button></div>
    </aside>
   </div>
   {(error||notice)&&<p role={error?"alert":"status"} className={"border-t px-4 py-2 "+(error?"text-red-700":"text-green-700")}>{error||notice}</p>}
   {addOpen&&<div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50"><form onSubmit={e=>{e.preventDefault();void add();}} className="w-[380px] space-y-3 border bg-white p-5 shadow-xl"><h3 className="text-base font-bold">Novo lançamento</h3><select className={field} value={direction} onChange={e=>setDirection(e.target.value as "in"|"out")}><option value="in">Entrada</option><option value="out">Saída</option></select><input className={field} placeholder="Descrição" required maxLength={250} value={description} onChange={e=>setDescription(e.target.value)}/><input className={field} placeholder="Valor em R$" required value={amount} onChange={e=>setAmount(e.target.value)}/><select className={field} value={method} onChange={e=>setMethod(e.target.value)}>{Object.entries(methods).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select><div className="flex justify-end gap-2"><button type="button" className={button} onClick={()=>setAddOpen(false)}>Cancelar</button><button disabled={busy} className={button}>Salvar</button></div></form></div>}
  </section>
 </div>;
}
