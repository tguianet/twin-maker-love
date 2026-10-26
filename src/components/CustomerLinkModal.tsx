import { useEffect, useState, type FormEvent } from "react";

export type LocalCustomer = { id: string; name: string; phone: string };
const CUSTOMERS_KEY = "tguia-food-customers-local-v1";
const LINKS_KEY = "tguia-food-table-customers-local-v1";

function readMap<T>(key: string): Record<string, T> {
  if (typeof window === "undefined") return {};
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, T> : {};
  } catch { return {}; }
}
export function linkedCustomer(table: string): LocalCustomer | null {
  const id = readMap<string>(LINKS_KEY)[table];
  return id ? readMap<LocalCustomer>(CUSTOMERS_KEY)[id] || null : null;
}
export function CustomerLinkModal({ table, onClose, onSaved }: {
  table: string; onClose: () => void; onSaved: (customer: LocalCustomer | null) => void;
}) {
  const [customers, setCustomers] = useState<LocalCustomer[]>([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setCustomers(Object.values(readMap<LocalCustomer>(CUSTOMERS_KEY)).filter(x => x && typeof x.name === "string"));
  }, []);
  const associate = (customer: LocalCustomer | null) => {
    try {
      const links = readMap<string>(LINKS_KEY);
      if (customer) links[table] = customer.id;
      else delete links[table];
      localStorage.setItem(LINKS_KEY, JSON.stringify(links));
      onSaved(customer);
      onClose();
    } catch { setError("Falha ao salvar vínculo. Verifique o espaço do navegador."); }
  };
  const create = (e: FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanName.length < 2) { setError("Digite pelo menos 2 caracteres no nome."); return; }
    if (cleanPhone && (cleanPhone.length < 10 || cleanPhone.length > 13)) { setError("Confira o telefone com DDD."); return; }
    const duplicate = customers.find(c => cleanPhone && c.phone === cleanPhone);
    if (duplicate) { setError("Telefone já cadastrado: " + duplicate.name); return; }
    const customer = { id: crypto.randomUUID(), name: cleanName, phone: cleanPhone };
    try {
      const map = readMap<LocalCustomer>(CUSTOMERS_KEY);
      map[customer.id] = customer;
      localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(map));
      setCustomers(Object.values(map));
      associate(customer);
    } catch { setError("Não foi possível gravar o cadastro no navegador."); }
  };
  const found = customers.filter(c => (c.name + " " + c.phone).toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  return <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/55 p-4">
    <div role="dialog" aria-modal="true" aria-label="Vincular cliente" className="w-[580px] max-w-full border border-[#aaa] bg-white p-5 text-[#273142] shadow-xl">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Vincular cliente — Mesa {table}</h2><button aria-label="Fechar" onClick={onClose} className="border px-2">×</button></div>
      <p className="mb-3 rounded bg-amber-50 p-2 text-xs text-amber-900">Cadastro local deste navegador. Não sincroniza com outros caixas ou com o Supabase.</p>
      {error && <p role="alert" className="mb-2 text-sm text-red-700">{error}</p>}
      <label className="mb-3 block text-sm">Buscar cliente<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome ou telefone" className="mt-1 w-full border p-2"/></label>
      <div className="max-h-40 overflow-y-auto border">
        {found.map(c => <button key={c.id} type="button" onClick={() => associate(c)} className="flex w-full justify-between border-b px-3 py-2 text-left hover:bg-blue-50"><span>{c.name}</span><span className="text-slate-600">{c.phone}</span></button>)}
        {found.length === 0 && <p className="p-3 text-sm text-slate-500">Nenhum cliente encontrado.</p>}
      </div>
      <form onSubmit={create} className="mt-4 space-y-2 border-t pt-3">
        <h3 className="font-semibold">Cadastrar novo cliente</h3>
        <input aria-label="Nome do cliente" required maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" className="w-full border p-2"/>
        <input aria-label="Telefone do cliente" inputMode="tel" maxLength={20} value={phone} onChange={e => setPhone(e.target.value)} placeholder="Telefone com DDD (opcional)" className="w-full border p-2"/>
        <div className="flex justify-between gap-2"><button type="button" onClick={() => associate(null)} className="border px-3 py-2">Desvincular</button><button type="submit" className="bg-[#444] px-3 py-2 font-semibold text-white">Cadastrar e vincular</button></div>
      </form>
    </div>
  </div>;
}
