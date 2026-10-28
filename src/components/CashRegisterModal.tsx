import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Session = { id:string; opened_at:string; opening_balance:number; opening_note:string|null; closed_at:string|null; counted_cash?:number|null; expected_cash?:number|null; cash_difference?:number|null; closing_note?:string|null };
type CloseResult = { ok?:boolean; error?:string; needs_note?:boolean; counted?:number; expected?:number; difference?:number };
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
 const [closeOpen,setCloseOpen]=useState(false);const [counted,setCounted]=useState("");const [closeNote,setCloseNote]=useState("");const [noteRequired,setNoteRequired]=useState(false);const [closeError,setCloseError]=useState("");
 const load=async (organization:string) => {
  const {data:sessions,error:se}=await supabase.from("cash_sessions").select("id,opened_at,opening_balance,opening_note,closed_at,counted_cash,expected_cash,cash_difference,closing_note").eq("organization_id",organization).order("opened_at",{ascending:false}).limit(30);
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
 const startClose=()=>{setCounted("");setCloseNote("");setNoteRequired(false);setCloseError("");setCloseOpen(true);};
 // Blind close: the operator reports the counted cash without seeing the expected balance.
 // The server computes the expected value, stores both and only then reveals the difference.
 const close=async()=>{
  if(!session||busy)return;
  const value=Number(counted.replace(/\./g,"").replace(",","."));
  if(!counted.trim()||!Number.isFinite(value)||value<0){setCloseError("Informe quanto há em dinheiro na gaveta.");return;}
  if(noteRequired&&!closeNote.trim()){setCloseError("Informe a justificativa da diferença.");return;}
  setBusy(true);setCloseError("");setError("");setNotice("");
  try{
   const {data,error:e}=await supabase.rpc("close_cash_session",{p_session_id:session.id,p_counted_cash:value,p_note:closeNote.trim()||null});
   if(e)throw e;
   const result=(data||{}) as CloseResult;
   if(!result.ok){if(result.needs_note)setNoteRequired(true);setCloseError(result.error||"Caixa não fechado.");return;}
   setCloseOpen(false);
   const diff=Number(result.difference||0);
   setNotice("Caixa fechado. Contado "+fmt(Number(result.counted||0))+" · esperado "+fmt(Number(result.expected||0))+" · "+(Math.abs(diff)<0.005?"sem diferença.":(diff<0?"FALTA de ":"SOBRA de ")+fmt(Math.abs(diff))+"."));
   if(org)await load(org);
  }catch(e){setCloseError(e instanceof Error?e.message:"Falha ao fechar o caixa.");}
  finally{setBusy(false);}
 };
 const historicalView=showClosed && !!pastSession;
 const displayedSession=historicalView?pastSession:session;
 const cashIn=rows.filter(x=>x.direction==="in").reduce((a,x)=>a+Number(x.amount),0);
 const cashOut=rows.filter(x=>x.direction==="out").reduce((a,x)=>a+Number(x.amount),0);
 const orderReceiptsTotal=orderReceipts.reduce((sum,r)=>sum+r.amount,0);
 const orderCash=orderReceipts.filter(r=>r.method==="cash").reduce((sum,r)=>sum+r.amount,0);
 const cashBalance=Number(displayedSession?.opening_balance||0)+rows.filter(x=>x.method==="cash").reduce((a,x)=>a+(x.direction==="in"?1:-1)*Number(x.amount),0);
 return <div className="fixed inset-0 z-[220] flex items-center justify-center bg-[#595959]/95 p-2 text-[#2d2d2d] sm:p-4">
  <section role="dialog" aria-modal="true" aria-label="Controle de caixa" className="flex h-[690px] max-h-[96vh] w-full max-w-[1260px] flex-col overflow-hidden border border-[#2b2b2b] bg-[#f0f0f0] font-[Segoe_UI,Tahoma,Geneva,Verdana,sans-serif] text-[13px] shadow-2xl">
   <header className="flex h-8 shrink-0 items-center justify-between bg-[#424242] px-3 text-neutral-100">
    <span className="text-[12px]">Caixa de {operator||"TGuia Food"} {displayedSession?"- Id: "+displayedSession.id.slice(0,8):""}</span>
    <div className="flex items-center gap-4">
     <button type="button" aria-label="Minimizar" title="Minimizar" onClick={onClose} className="px-1 hover:text-white">−</button>
     <button type="button" aria-label="Fechar janela" onClick={onClose} className="px-2 text-lg hover:bg-[#c42b1c]">×</button>
    </div>
   </header>
   <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto bg-[#fcfcfc] p-4 lg:flex-row lg:p-6">
    <aside className="flex w-full shrink-0 flex-col justify-between pt-1 lg:w-[200px]">
     <div className="flex flex-col gap-4">
      <div className={"rounded py-2.5 text-center text-[15px] font-semibold tracking-wide text-white shadow-sm "+(historicalView?"bg-[#777]":session?"bg-[#388e3c]":"bg-[#777]")}>{historicalView?"Turno encerrado":session?"Caixa Aberto":"Caixa Fechado"}</div>
      <label className="flex flex-col gap-1 pt-1 text-[12px] text-neutral-700">Saldo inicial (dinheiro):
       <input aria-label="Saldo inicial em dinheiro" className="h-[28px] w-full rounded-none border border-[#b8b8b8] bg-white px-2 text-right shadow-inner" disabled={!!displayedSession||busy} value={displayedSession?fmt(Number(displayedSession.opening_balance)):balance} onChange={e=>setBalance(e.target.value)}/>
      </label>
      <label className="flex flex-col gap-1 pt-1 text-[12px] text-neutral-700">Observação:
       <textarea className="w-full resize-none rounded-none border border-[#b8b8b8] bg-white p-2 text-[12px] shadow-inner" rows={6} disabled={!!displayedSession||busy} value={displayedSession?displayedSession.opening_note||"":note} onChange={e=>setNote(e.target.value)}/>
      </label>
      {!session&&!showClosed&&<button type="button" disabled={!org||busy} onClick={open} className="bg-[#388e3c] px-3 py-2 font-semibold text-white disabled:opacity-40">Abrir Caixa</button>}
     </div>
     <div className="pb-1 pt-8 text-[12px] text-neutral-700"><b>Data / Hora de abertura:</b><p className="mt-1">{displayedSession?new Date(displayedSession.opened_at).toLocaleString("pt-BR"):"Não aberto"}</p></div>
    </aside>
    <main className="flex min-h-[420px] min-w-0 flex-1 flex-col">
     <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h1 className="text-[20px] font-bold tracking-tight text-[#3a3a3a]">Caixa de {operator||"TGuia Food"}</h1>
      <span className="text-[15px] font-medium text-[#388e3c]">{displayedSession?"Id do Caixa: #"+displayedSession.id.slice(0,8):"Sem turno aberto"}</span>
     </div>
     <div className="flex min-h-0 flex-1 flex-col justify-between border border-[#bfbfbf] bg-white">
      <div className="flex min-h-0 flex-1 flex-col">
       <div className="border-b border-[#dadada] bg-[#ebebeb] px-2.5 py-1 text-[12px] font-bold">Movimentação</div>
       <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e5e5] px-2.5 py-1.5 text-[12px]">
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showClosed} onChange={e=>setShowClosed(e.target.checked)}/> Consultar último turno fechado</label>
        <button type="button" className="text-[#2473a7] underline disabled:opacity-40" disabled={!org||busy} onClick={refresh}>Atualizar</button>
       </div>
       <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-[12px]">
         <thead className="sticky top-0 bg-[#f0f0f0] text-[#333]"><tr>{["Data / Hora","Descrição","Entrada","Saída","Forma Pagto."].map(t=><th key={t} className="border-b border-r border-[#e0e0e0] px-2.5 py-1 font-normal">{t}</th>)}</tr></thead>
         <tbody>
          {displayedSession&&<tr className="border-b border-[#f0f0f0]"><td className="whitespace-nowrap px-2.5 py-1">{new Date(displayedSession.opened_at).toLocaleString("pt-BR")}</td><td className="px-2.5 py-1">SALDO INICIAL</td><td className="px-2.5 py-1 text-right font-medium text-[#1976d2]">{fmt(Number(displayedSession.opening_balance))}</td><td/><td className="px-2.5 py-1">Dinheiro</td></tr>}
          {rows.map(r=><tr key={r.id} className="border-b border-[#f0f0f0] hover:bg-blue-50/20"><td className="whitespace-nowrap px-2.5 py-1">{new Date(r.created_at).toLocaleString("pt-BR")}</td><td className="px-2.5 py-1">{r.description}</td><td className="px-2.5 py-1 text-right text-[#1976d2]">{r.direction==="in"?fmt(Number(r.amount)):""}</td><td className="px-2.5 py-1 text-right">{r.direction==="out"?fmt(Number(r.amount)):""}</td><td className="px-2.5 py-1">{methods[r.method]||r.method}</td></tr>)}
          {orderReceipts.map(r=><tr key={r.id} className="border-b border-[#f0f0f0] bg-[#f9fcf9]"><td className="whitespace-nowrap px-2.5 py-1">{new Date(r.created_at).toLocaleString("pt-BR")}</td><td className="px-2.5 py-1">RECEBIMENTO DE COMANDA</td><td className="px-2.5 py-1 text-right font-medium text-[#1976d2]">{fmt(r.amount)}</td><td/><td className="px-2.5 py-1">{methods[r.method]||r.method}</td></tr>)}
          {!displayedSession&&<tr><td colSpan={5} className="px-3 py-5 text-center text-neutral-500">Nenhum turno para consultar.</td></tr>}
         </tbody>
        </table>
       </div>
      </div>
      <div className="flex justify-end gap-8 border-t border-[#d0d0d0] px-5 py-1 text-[12px] font-bold"><span>Entradas: {fmt(cashIn+orderReceiptsTotal)}</span><span>Saídas: {fmt(cashOut)}</span></div>
      <div className="flex items-center justify-between gap-2 border-t border-[#bfbfbf] bg-[#f9f9f9] px-3 py-2 text-[12px]">
       <span className="cursor-not-allowed text-[#b0b0b0]" title="Lançamentos financeiros registrados são imutáveis">▤ Excluir Lançamento</span>
       <div className="flex gap-4"><button type="button" onClick={()=>window.print()} className="hover:text-black">▤ Imprimir</button><button type="button" disabled={!session||busy||showClosed} onClick={()=>setAddOpen(true)} className="font-medium hover:text-black disabled:opacity-40">＋ Novo Lançamento</button></div>
      </div>
     </div>
    </main>
    <aside className="flex min-h-[400px] w-full shrink-0 flex-col justify-between border border-[#bfbfbf] bg-white lg:mt-[38px] lg:w-[285px]">
     <div>
      <h2 className="border-b border-[#dadada] bg-[#ebebeb] px-3 py-1 text-[12px] font-bold">Resumo</h2>
      <div className="space-y-4 p-3 text-[12px]">
       <div className="flex justify-between font-bold"><span>(+) SALDO INICIAL:</span><span>{fmt(Number(displayedSession?.opening_balance||0))}</span></div>
       <div><b>(+) ENTRADAS NO CAIXA</b>{cashIn===0&&orderReceiptsTotal===0?<p className="mt-1 text-[11px] text-[#8e8e8e]">Não há registros de entrada</p>:<><div className="mt-2 flex justify-between"><span>Lançamentos</span><b>{fmt(cashIn)}</b></div><div className="mt-1 flex justify-between"><span>Comandas recebidas</span><b>{fmt(orderReceiptsTotal)}</b></div><div className="mt-1 flex justify-between font-bold"><span>Total entradas</span><span>{fmt(cashIn+orderReceiptsTotal)}</span></div></>}</div>
       <div className="pt-4"><b>(-) SAÍDAS DO CAIXA</b>{cashOut===0?<p className="mt-1 text-[11px] text-[#8e8e8e]">Não há registros de saída</p>:<p className="mt-2 text-right font-bold">{fmt(cashOut)}</p>}</div>
       {historicalView||!displayedSession?<div className="space-y-2 pt-6"><b>(=) SALDO FINAL</b><div className="flex justify-between"><span>Somente Dinheiro:</span><b>{fmt(cashBalance+orderCash)}</b></div><div className="flex justify-between"><b>TUDO:</b><b>{fmt(Number(displayedSession?.opening_balance||0)+cashIn-cashOut+orderReceiptsTotal)}</b></div>
        {displayedSession?.expected_cash!=null&&<div className="mt-2 space-y-1 border-t pt-2"><b>CONFERÊNCIA DO DINHEIRO</b><div className="flex justify-between"><span>Contado na gaveta:</span><b>{fmt(Number(displayedSession.counted_cash))}</b></div><div className="flex justify-between"><span>Esperado pelo sistema:</span><b>{fmt(Number(displayedSession.expected_cash))}</b></div><div className={"flex justify-between font-bold "+(Math.abs(Number(displayedSession.cash_difference))<0.005?"text-[#388e3c]":"text-[#b91c1c]")}><span>{Number(displayedSession.cash_difference)<0?"Falta:":Number(displayedSession.cash_difference)>0?"Sobra:":"Diferença:"}</span><span>{fmt(Math.abs(Number(displayedSession.cash_difference)))}</span></div>{displayedSession.closing_note&&<p className="text-[11px] text-neutral-600">Justificativa: {displayedSession.closing_note}</p>}</div>}
       </div>:<div className="space-y-2 pt-6"><b>(=) SALDO FINAL</b><p className="text-[11px] text-neutral-600">Conferência às cegas: o saldo esperado só aparece depois que o dinheiro da gaveta for contado e o caixa for fechado.</p></div>}
       <p className="border-t pt-2 text-[10px] text-neutral-500">Pagamentos de comandas entram pelo registro real do Supabase. Evite lançá-los novamente como entrada manual.</p>
      </div>
     </div>
     <div className="flex items-center justify-between gap-2 border-t border-[#bfbfbf] bg-[#f9f9f9] p-2 text-[12px]"><button type="button" onClick={()=>window.print()} className="px-2 hover:text-black">▤ Imprimir</button><button type="button" disabled={!session||busy||showClosed} onClick={startClose} className="rounded-sm border border-[#b5b5b5] bg-white px-3 py-1.5 font-medium shadow-sm hover:border-neutral-500 disabled:opacity-40">✓ Fechar Caixa</button></div>
    </aside>
   </div>
   {(error||notice)&&<p role={error?"alert":"status"} className={"border-t px-4 py-2 text-xs "+(error?"text-red-700":"text-green-700")}>{error||notice}</p>}
   {closeOpen&&<div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-4"><form onSubmit={e=>{e.preventDefault();void close();}} className="w-[400px] max-w-full space-y-3 border bg-white p-5 shadow-xl"><h3 className="text-base font-bold">Fechar caixa</h3><p className="text-xs text-neutral-600">Conte o dinheiro da gaveta e informe o total. O valor esperado pelo sistema só é mostrado depois do fechamento.</p><label className="block text-xs">Dinheiro contado na gaveta (R$)<input autoFocus inputMode="decimal" className={field+" text-right text-base"} placeholder="0,00" value={counted} onChange={e=>setCounted(e.target.value)}/></label>{noteRequired&&<label className="block text-xs text-[#b91c1c]">Justificativa da diferença (obrigatória)<textarea className={field} rows={3} maxLength={300} value={closeNote} onChange={e=>setCloseNote(e.target.value)}/></label>}{closeError&&<p role="alert" className="text-xs text-red-700">{closeError}</p>}<div className="flex justify-end gap-2"><button type="button" className={button} disabled={busy} onClick={()=>setCloseOpen(false)}>Voltar</button><button disabled={busy} className={button+" font-semibold"}>{busy?"Fechando...":"Confirmar fechamento"}</button></div></form></div>}
   {addOpen&&<div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-4"><form onSubmit={e=>{e.preventDefault();void add();}} className="w-[380px] max-w-full space-y-3 border bg-white p-5 shadow-xl"><h3 className="text-base font-bold">Novo lançamento</h3><select aria-label="Tipo de lançamento" className={field} value={direction} onChange={e=>setDirection(e.target.value as "in"|"out")}><option value="in">Entrada</option><option value="out">Saída</option></select><input className={field} placeholder="Descrição" required maxLength={250} value={description} onChange={e=>setDescription(e.target.value)}/><input className={field} placeholder="Valor em R$" required value={amount} onChange={e=>setAmount(e.target.value)}/><select aria-label="Forma de pagamento" className={field} value={method} onChange={e=>setMethod(e.target.value)}>{Object.entries(methods).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select><div className="flex justify-end gap-2"><button type="button" className={button} onClick={()=>setAddOpen(false)}>Cancelar</button><button disabled={busy} className={button}>Salvar</button></div></form></div>}
  </section>
 </div>;
}
