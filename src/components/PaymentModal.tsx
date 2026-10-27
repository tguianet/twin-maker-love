import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Banknote, CreditCard, Diamond, X, ChevronLeft, ChevronDown, Info, Printer, Percent, Eraser, Check, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { isFullPayment, type PaymentMethod } from "../lib/payment-rules";

export type { PaymentMethod } from "../lib/payment-rules";
const methods = [
  { id: "cash" as const, label: "Dinheiro", key: "A", icon: Banknote },
  { id: "pix" as const, label: "Pix", key: "P", icon: Diamond },
  { id: "credit" as const, label: "Crédito", key: "C", icon: CreditCard },
  { id: "debit" as const, label: "Débito", key: "B", icon: CreditCard },
];
const money = (n: number) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function Window({ title, children, onClose, width = "w-[950px]", busy = false }: { title: string; children: ReactNode; onClose: () => void; width?: string; busy?: boolean }) {
  return <Dialog.Root open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[250] bg-pdv-overlay" />
      <Dialog.Content aria-describedby={undefined} onPointerDownOutside={e => e.preventDefault()} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} className={`fixed left-1/2 top-1/2 z-[251] flex max-h-[94vh] max-w-[96vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden border border-app-table bg-app-field font-[Segoe_UI,Tahoma,Geneva,Verdana,sans-serif] text-xs text-app-text shadow-2xl ${width}`}>
        <header className="flex shrink-0 items-center justify-between bg-pdv-title px-3 py-1 text-app-on-dark">
          <Dialog.Title className="text-[13px] font-medium">{title}</Dialog.Title>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm text-app-on-dark hover:bg-app-close hover:text-app-on-dark" aria-label={`Fechar ${title}`} disabled={busy} onClick={onClose}><X /></Button>
        </header>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

export function PaymentModal({ table, orderNumber, subtotal, service, cashOpen, busy, error, local = false, onClose, onConfirm }: {
  table: string; orderNumber: string | number; subtotal: number; service: number;
  cashOpen: boolean | null; busy: boolean; error?: string; local?: boolean;
  onClose: () => void; onConfirm: (method: PaymentMethod) => void;
}) {
  const total = Math.round((subtotal + service) * 100) / 100;
  const [entry, setEntry] = useState<PaymentMethod | null>(null);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState("0,00");
  const [brand, setBrand] = useState("");
  const [entryError, setEntryError] = useState("");
  const [showItems, setShowItems] = useState(false);
  const selected = methods.find(m => m.id === entry);
  const paid = payment ? total : 0;
  const remaining = Math.max(0, total - paid);
  const addPayment = () => {
    const value = Number(amount.replace(/\./g, "").replace(",", "."));
    if (!isFullPayment(value, total)) {
      setEntryError("Informe o valor integral da conta. Pagamentos parciais não estão disponíveis."); return;
    }
    if ((entry === "credit" || entry === "debit") && !brand) { setEntryError("Selecione a bandeira."); return; }
    setPayment(entry); setEntry(null); setEntryError("");
  };
  return <Window title={`Pagamento - Comanda ${table}, Pedido ${orderNumber}`} onClose={onClose} busy={busy}>
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-app-border bg-app-hover px-4 py-2">
      <label className="flex items-center gap-3"><input type="checkbox" checked={showItems} onChange={e => setShowItems(e.target.checked)} />Conferir a conta</label>
      <span className={`flex items-center gap-1 font-medium ${local ? "text-app-muted" : cashOpen ? "text-app-table-active" : "text-destructive"}`}><Info className="h-4 w-4" />{local ? "Demonstração local" : cashOpen === null ? "Consultando caixa…" : cashOpen ? "Caixa aberto" : "Caixa fechado"}</span>
    </div>
    <div className="flex min-h-0 flex-1 gap-2 overflow-auto bg-app-hover p-2">
      <Button variant="pdv" className="h-auto w-9 shrink-0 px-1" onClick={() => setShowItems(v => !v)}><span className="[writing-mode:vertical-rl] rotate-180">Conferir a conta</span></Button>
      <section className="w-44 shrink-0"><h3 className="px-1 py-1 font-semibold">Adicionar Pagamento</h3><div className="flex flex-col gap-1.5">{methods.map(m => <Button key={m.id} variant="pdv" disabled={busy || payment !== null || total <= 0} className="h-10 justify-start px-2.5 text-xs" onClick={() => { setEntry(m.id); setAmount("0,00"); setBrand(""); setEntryError(""); }}><m.icon className="text-app-muted" />{m.key} - {m.label}</Button>)}</div></section>
      <section className="flex min-h-[420px] min-w-[300px] flex-1 flex-col overflow-hidden border border-app-border bg-app-field">
        <div className="m-1 border border-dotted border-app-blue"><h3 className="flex items-center gap-1 border-b border-app-border bg-app-blue/5 px-3 py-2 font-bold text-app-blue"><ChevronDown className="h-4 w-4" />A Pagar / Resumo dos Totais</h3>
          {[['Total dos itens', subtotal], ['(+) Serviço', service], ['Total a Pagar', total]].map(([label, value]) => <div key={String(label)} className="flex justify-between gap-4 border-b border-app-border px-6 py-2"><span>{label}</span><strong className="text-sm">{money(Number(value))}</strong></div>)}
        </div>
        {showItems && <div className="border-b border-app-border px-4 py-3 text-app-muted">Comanda {table} · Pedido {orderNumber} · Total R$ {money(total)}</div>}
        {payment && <div className="mx-3 mt-3 flex items-center justify-between border-b border-app-border py-2"><span className="flex items-center gap-2"><Check className="h-4 w-4 text-app-table-active" />{methods.find(m => m.id === payment)?.label}</span><strong>{money(total)}</strong><Button variant="ghost" size="icon" aria-label="Remover pagamento" disabled={busy} onClick={() => setPayment(null)}><Trash2 /></Button></div>}
        <div className="flex-1" />
        {local && <p className="px-4 py-2 text-app-muted">Registro local de demonstração. Nenhum pagamento real será processado.</p>}
        {error && <p role="alert" className="px-4 py-2 text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-app-border bg-app-hover px-5 py-3"><span className="flex items-center gap-3">Total Pago <strong className="text-2xl text-app-blue">{money(paid)}</strong></span><span className="flex items-center gap-3">Falta pagar <strong className="text-2xl">{money(remaining)}</strong></span></div>
      </section>
    </div>
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-app-border bg-app-ribbon px-3 py-2.5"><div className="flex gap-2"><Button variant="pdv" size="sm" disabled title="Não disponível no fechamento atual"><Percent />Taxas e Descontos</Button><Button variant="pdv" size="sm" onClick={() => window.print()}><Printer />Imprimir Cupom</Button></div><div className="flex gap-2"><Button variant="ghost" size="sm" disabled={busy} onClick={onClose}><ChevronLeft />Voltar</Button><Button variant="pdvPrimary" size="sm" disabled={busy || !payment || (!local && !cashOpen) || total <= 0} onClick={() => { if (payment) onConfirm(payment); }}>{busy ? "Registrando…" : local ? "Registrar fechamento local" : "Confirmar pagamento recebido"}</Button></div></footer>
    {entry && <Window title={`Pagamento - ${entry === "credit" || entry === "debit" ? "Selecione a Bandeira" : selected?.label}`} width="w-[694px]" onClose={() => setEntry(null)}>
      <div className="grid min-h-0 grid-cols-2 overflow-auto bg-app-chrome p-5 text-app-text">
        <section className="flex flex-col gap-2 border-r border-app-border pr-5">
          <input aria-label="Valor do pagamento" inputMode="decimal" value={amount} onChange={e => { setAmount(e.target.value); setEntryError(""); }} className="h-[38px] w-full border border-app-border bg-app-field text-center text-[22px] font-bold text-app-blue outline-none focus:border-app-blue" />
          <p className="text-center">Auto preencher:</p>
          <Button variant="pdv" size="sm" onClick={() => setAmount(money(total))}>[C] {money(total)} (Faltando)</Button>
          <div className="grid grid-cols-2 gap-2">{[2,5,10,20,50,100].map(n => <Button key={n} variant="pdv" size="sm" onClick={() => setAmount(money(n))}>{money(n)}</Button>)}</div>
          <Button variant="ghost" size="sm" onClick={() => setAmount("0,00")}><Eraser />Limpar</Button>
          <label className="mt-auto">Observação:<input disabled title="O fechamento atual não registra observações de pagamento" className="mt-1 h-8 w-full border border-app-border bg-app-field px-2 disabled:opacity-50" /></label>
        </section>
        <section className="flex flex-col gap-2 pl-5">
          <h3 className="mb-1 text-center text-[13px]">{entry === "credit" || entry === "debit" ? "Selecione a Bandeira" : selected?.label}</h3>
          {entry === "credit" || entry === "debit" ? <>
            {['Visa','Master','Amex','Outra'].map(b => <Button key={b} variant="pdv" size="sm" aria-pressed={brand === b} className={`justify-start ${brand === b ? "border-app-blue bg-app-blue/10" : "border-transparent shadow-none bg-transparent"}`} onClick={() => setBrand(b)}><CreditCard className="text-app-blue" />{b}{brand === b && <Check />}</Button>)}
            <hr className="border-app-border" />
            <label>POS<select disabled title="POS não configurado" className="mt-1 h-8 w-full border border-app-border bg-app-field"><option>—</option></select></label>
            <label>Nº Aut.:<input disabled title="Autorização não registrada pelo fechamento atual" className="mt-1 h-8 w-full border border-app-border bg-app-field" /></label>
          </> : <div className="flex flex-1 items-center justify-center"><Banknote className="h-16 w-16 text-app-muted" /></div>}
        </section>
      </div>
      {entryError && <p role="alert" className="bg-app-chrome px-5 pb-3 text-destructive">{entryError}</p>}
      <footer className="flex justify-end gap-2 border-t border-app-border bg-app-chrome px-5 py-3"><Button variant="pdv" size="sm" onClick={() => setEntry(null)}><ChevronLeft />Voltar</Button><Button variant="pdvPrimary" size="sm" onClick={addPayment}><Check />Adicionar pagamento</Button></footer>
    </Window>}
  </Window>;
}