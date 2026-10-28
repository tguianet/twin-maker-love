import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

const REASONS = ["Cliente desistiu", "Lançado errado", "Produto em falta", "Demora no preparo", "Item com problema"];
const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const field = "w-full border border-[#b5b5b5] bg-white px-2 py-1.5 text-sm";

type Item = { id: string; product_name: string; quantity: number; unit_price: number };

/**
 * Cancela um item da comanda pelo servidor (cancel_order_item). O item nunca é apagado:
 * fica registrado com motivo, quem cancelou e quem autorizou. Pedidos da equipe exigem o
 * PIN de um gerente/administrador diferente de quem está cancelando.
 */
export function CancelItemModal({ client, item, onClose, onCancelled }: {
  client: SupabaseClient;
  item: Item;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const [reason, setReason] = useState(REASONS[0]!);
  const [detail, setDetail] = useState("");
  const [pin, setPin] = useState("");
  const [needsPin, setNeedsPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) { event.preventDefault(); event.stopImmediatePropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [busy, onClose]);
  useEffect(() => { if (needsPin) pinRef.current?.focus(); }, [needsPin]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const fullReason = [reason, detail.trim()].filter(Boolean).join(" — ").slice(0, 300);
    setBusy(true); setError("");
    try {
      const { data, error: rpcError } = await client.rpc("cancel_order_item", {
        p_item_id: item.id, p_reason: fullReason, p_supervisor_pin: pin || null,
      });
      if (rpcError) throw rpcError;
      const result = (data || {}) as { ok?: boolean; error?: string; needs_pin?: boolean };
      if (!result.ok) {
        if (result.needs_pin) setNeedsPin(true);
        setPin("");
        setError(result.error || "Cancelamento não autorizado.");
        return;
      }
      onCancelled();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Falha ao cancelar o item.");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/50 p-4" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form role="dialog" aria-modal="true" aria-label="Cancelar item" onSubmit={submit} className="w-[420px] max-w-full space-y-3 border border-[#2b2b2b] bg-white p-5 text-[13px] shadow-2xl">
        <h3 className="text-base font-bold text-[#b91c1c]">Cancelar item</h3>
        <p className="border-b pb-2"><b>{item.quantity}×</b> {item.product_name} <span className="float-right font-semibold">{fmt(item.quantity * item.unit_price)}</span></p>
        <label className="block">Motivo
          <select className={field} value={reason} onChange={e => setReason(e.target.value)}>
            {REASONS.map(r => <option key={r}>{r}</option>)}
          </select>
        </label>
        <label className="block">Detalhe (opcional)
          <input className={field} maxLength={200} value={detail} onChange={e => setDetail(e.target.value)} placeholder="Ex.: cliente trocou por outro chope" />
        </label>
        <label className="block">PIN do supervisor {needsPin ? <span className="text-[#b91c1c]">(obrigatório)</span> : <span className="text-gray-500">(garçom e caixa precisam)</span>}
          <input ref={pinRef} className={field + " tracking-[0.4em]"} type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} />
        </label>
        <p className="text-[11px] text-gray-500">O item não é apagado: fica no histórico com o motivo, quem cancelou e quem autorizou.</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" disabled={busy} onClick={onClose} className="border border-[#b8b8b8] bg-[#f4f4f4] px-3 py-2 hover:bg-[#e8e8e8] disabled:opacity-40">Voltar</button>
          <button disabled={busy} className="bg-[#b91c1c] px-4 py-2 font-semibold text-white disabled:opacity-40">{busy ? "Cancelando..." : "Cancelar item"}</button>
        </div>
      </form>
    </div>
  );
}
