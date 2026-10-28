import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

const field = "w-28 rounded-sm border border-[#aebcca] bg-white p-2 text-sm tracking-[0.3em] text-[#202f3d]";
const btn = "rounded-sm border border-[#b8c4d1] bg-[#e9eff5] px-3 py-2 text-sm font-semibold text-[#223a50] hover:bg-[#d7e6f3] disabled:opacity-50";

/** PIN pessoal usado para autorizar ações sensíveis (ex.: cancelar item lançado por outra pessoa). */
export function StaffPinPanel({ client, orgId }: { client: SupabaseClient; orgId: string }) {
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    setHasPin(null);
    void client.rpc("has_my_pin", { p_organization_id: orgId }).then(({ data, error }) => {
      if (active) setHasPin(error ? null : Boolean(data));
    });
    return () => { active = false; };
  }, [client, orgId]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!/^\d{4,6}$/.test(pin)) { setMessage({ ok: false, text: "O PIN deve ter de 4 a 6 números." }); return; }
    if (pin !== confirm) { setMessage({ ok: false, text: "A confirmação não confere." }); return; }
    setBusy(true);
    const { error } = await client.rpc("set_my_pin", { p_organization_id: orgId, p_pin: pin });
    setBusy(false);
    if (error) { setMessage({ ok: false, text: error.message }); return; }
    setPin(""); setConfirm(""); setHasPin(true);
    setMessage({ ok: true, text: "PIN salvo. Use-o para autorizar cancelamentos da equipe." });
  }

  return (
    <section className="mb-5 border border-[#c4d0da] bg-white p-4">
      <h2 className="text-base font-bold">Meu PIN de autorização</h2>
      <p className="mt-1 text-xs text-slate-600">
        Gerentes e administradores digitam este PIN para liberar cancelamentos feitos pela equipe.
        Cada pessoa precisa de um PIN próprio — não é permitido repetir o PIN de outro usuário.
        {hasPin === true && " Você já tem um PIN cadastrado; salvar substitui o atual."}
        {hasPin === false && " Você ainda não cadastrou um PIN."}
      </p>
      <form onSubmit={save} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm">Novo PIN<br />
          <input className={field} type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label className="text-sm">Confirmar<br />
          <input className={field} type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={confirm} onChange={e => setConfirm(e.target.value.replace(/\D/g, ""))} />
        </label>
        <button className={btn} disabled={busy || !pin}>{busy ? "Salvando..." : "Salvar PIN"}</button>
      </form>
      {message && <p role={message.ok ? "status" : "alert"} className={"mt-2 text-sm " + (message.ok ? "text-green-700" : "text-red-700")}>{message.text}</p>}
    </section>
  );
}
