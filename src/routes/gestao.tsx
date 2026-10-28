import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/gestao")({
  head: () => ({ meta: [
    { title: "TGuia Food - Gestão do Restaurante" },
    { name: "description", content: "Gestão de produtos, categorias e mesas do restaurante." },
    { property: "og:title", content: "TGuia Food - Gestão do Restaurante" },
    { property: "og:description", content: "Gestão de produtos, categorias e mesas do restaurante." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Gestao,
});
type Org = { id: string; name: string };
type Category = { id: string; name: string };
type Product = { id: string; code: string | null; name: string; sale_price: number; active: boolean; category_id: string | null };
type RestaurantTable = { id: string; number: number; name: string | null };
const currency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const btn = "rounded-sm border border-[#b8c4d1] bg-[#e9eff5] px-3 py-2 text-sm font-semibold text-[#223a50] hover:bg-[#d7e6f3] disabled:opacity-50";
const field = "w-full rounded-sm border border-[#aebcca] bg-white p-2 text-sm text-[#202f3d]";
const empty = { code: "", name: "", sale_price: "", category_id: "", active: true };

function Gestao() {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [createAccount, setCreateAccount] = useState(false);
  const [organizations, setOrganizations] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tab, setTab] = useState<"produtos" | "categorias" | "complementos" | "observacoes" | "tipos" | "insumos" | "mesas">("produtos");
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [tableNumber, setTableNumber] = useState("");
  const [tableEnd, setTableEnd] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    import("../lib/supabase")
      .then(async ({ supabase }) => {
        if (!active) return;
        setClient(supabase);
        const { data } = await supabase.auth.getUser();
        if (active) setUserId(data.user?.id || "");
      })
      .catch(() => { if (active) setConnectionError("Não foi possível conectar à autenticação. Verifique a configuração do Supabase."); });
    return () => { active = false; };
  }, []);

  const loadOrganizations = useCallback(async () => {
    if (!client || !userId) return;
    const { data, error: failure } = await client.from("organization_members")
      .select("organization_id, organizations(id,name)").eq("user_id", userId).eq("active", true);
    if (failure) { setError(failure.message); return; }
    const found = (data || []).flatMap((row) => {
      const joined = row.organizations as unknown as Org | Org[] | null;
      return joined ? (Array.isArray(joined) ? joined : [joined]) : [];
    });
    setOrganizations(found);
    setOrgId((old) => found.some((org) => org.id === old) ? old : found[0]?.id || "");
  }, [client, userId]);

  const loadData = useCallback(async () => {
    if (!client || !orgId) return;
    const [cats, items, tableRows] = await Promise.all([
      client.from("product_categories").select("id,name").eq("organization_id", orgId).order("name"),
      client.from("products").select("id,code,name,sale_price,active,category_id").eq("organization_id", orgId).order("name"),
      client.from("restaurant_tables").select("id,number,name").eq("organization_id", orgId).order("number"),
    ]);
    if (cats.error || items.error || tableRows.error) { setError(cats.error?.message || items.error?.message || tableRows.error?.message || "Erro ao carregar dados"); return; }
    setCategories((cats.data || []) as Category[]);
    setTables((tableRows.data || []) as RestaurantTable[]);
    setProducts((items.data || []) as Product[]);
  }, [client, orgId]);

  useEffect(() => { void Promise.resolve().then(loadOrganizations); }, [loadOrganizations]);
  useEffect(() => { void Promise.resolve().then(loadData); }, [loadData]);

  async function login(event: FormEvent) {
    event.preventDefault();
    if (!client) return;
    setBusy(true); setError("");
    const result = await client.auth.signInWithPassword({ email, password });
    if (result.error) setError(result.error.message);
    else {
      setUserId(result.data.user.id);
      setPassword("");
      setNotice("Login realizado. Carregando seus estabelecimentos autorizados.");
    }
    setBusy(false);
  }
  async function signup(event: FormEvent) {
    event.preventDefault();
    if (!client || busy) return;
    if (password.length < 8) { setError("A senha precisa ter pelo menos 8 caracteres."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await client.auth.signUp({ email: email.trim(), password });
      if (result.error) throw result.error;
      setPassword("");
      setCreateAccount(false);
      setNotice("Solicitação recebida. Confirme o e-mail, se solicitado, e entre. Sua conta precisará ser vinculada ao restaurante por um administrador; o cadastro não concede acesso automaticamente.");
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao solicitar cadastro."); }
    finally { setBusy(false); }
  }
  async function logout() {
    await client?.auth.signOut();
    setUserId(""); setOrganizations([]); setOrgId(""); setProducts([]); setTables([]);
  }
  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    if (!client || !orgId || !form.name.trim()) return;
    const value = Number(form.sale_price.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) { setError("Informe um preço válido."); return; }
    const code = form.code.trim() || null;
    if (code && products.some((p) => p.code === code && p.id !== editing)) { setError("Este código já está cadastrado."); return; }
    setBusy(true); setError(""); setNotice("");
    const payload = { organization_id: orgId, code, name: form.name.trim(), sale_price: value, category_id: form.category_id || null, active: form.active };
    const result = editing
      ? await client.from("products").update(payload).eq("id", editing).eq("organization_id", orgId)
      : await client.from("products").insert(payload);
    setBusy(false);
    if (result.error) { setError(result.error.message); return; }
    setNotice(editing ? "Produto atualizado." : "Produto cadastrado.");
    setForm(empty); setEditing(null); await loadData();
  }
  async function toggleProduct(product: Product) {
    if (!client) return;
    setBusy(true); setError("");
    const result = await client.from("products").update({ active: !product.active })
      .eq("id", product.id).eq("organization_id", orgId);
    setBusy(false);
    if (result.error) setError(result.error.message);
    else await loadData();
  }
  async function addTable(event: FormEvent) {
    event.preventDefault();
    if (!client || !orgId || busy) return;
    const number = Number(tableNumber);
    if (!Number.isSafeInteger(number) || number < 1 || number > 9999) {
      setError("Informe um número de mesa inteiro de 1 a 9999."); return;
    }
    setBusy(true); setError(""); setNotice("");
    const end = tableEnd.trim() ? Number(tableEnd) : number;
    if (!Number.isSafeInteger(end) || end < number || end > 9999 || end - number > 99) {
      setBusy(false); setError("Informe um intervalo válido de até 100 mesas."); return;
    }
    const candidates = Array.from({ length: end - number + 1 }, (_, i) => number + i);
    const existing = new Set(tables.map(t => t.number));
    const toCreate = candidates.filter(n => !existing.has(n));
    if (toCreate.length === 0) {
      setBusy(false); setNotice("Todas essas mesas já estão cadastradas."); return;
    }
    const { error: failure } = await client.from("restaurant_tables").insert(toCreate.map(n => ({ organization_id: orgId, number: n })));
    setBusy(false);
    if (failure) { setError(failure.code === "23505" ? "Alguma mesa foi cadastrada simultaneamente. Atualize os dados." : failure.message); return; }
    setTableNumber(""); setTableEnd(""); setNotice(toCreate.length + " mesa(s) cadastrada(s)."); await loadData();
  }
  async function addCategory(event: FormEvent) {
    event.preventDefault();
    if (!client || !orgId || busy || !categoryName.trim()) return;
    setBusy(true); setError(""); setNotice("");
    const { error: failure } = await client.from("product_categories").insert({ organization_id: orgId, name: categoryName.trim().slice(0, 100) });
    setBusy(false);
    if (failure) { setError(failure.message); return; }
    setCategoryName(""); setNotice("Categoria cadastrada."); await loadData();
  }
  const visible = products.filter(p => [p.name, p.code || ""].some(v => v.toLowerCase().includes(query.toLowerCase())));
  return (
    <div className="min-h-screen bg-[#f3f6f9] text-[#233448]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#b9c5d0] bg-[#e3eaf1] px-5 py-3">
        <div><strong className="text-lg">TGuia Food</strong><span className="ml-3 text-sm">Gestão do Restaurante</span></div>
        <div className="flex items-center gap-3"><a href="/" className={btn}>Voltar às mesas</a>{userId && <button className={btn} onClick={logout}>Sair</button>}</div>
      </header>
      <main className="mx-auto max-w-6xl p-5">
        {connectionError && <p role="alert" className="mb-4 rounded border border-red-300 bg-red-50 p-3">{connectionError}</p>}
        {error && <p role="alert" className="mb-4 rounded border border-red-300 bg-red-50 p-3">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded border border-green-300 bg-green-50 p-3">{notice}</p>}
        {!userId ? (
          <form onSubmit={createAccount ? signup : login} className="mx-auto mt-16 max-w-md space-y-4 border border-[#c2ced9] bg-white p-6">
            <h1 className="text-xl font-semibold">{createAccount ? "Criar conta" : "Acesso à gestão"}</h1>
            <p className="text-sm text-slate-600">{createAccount ? "Cadastre seu e-mail. O acesso ao restaurante somente será liberado após vínculo administrativo." : "Entre com um usuário autorizado do seu restaurante no Supabase."}</p>
            <label className="block text-sm">E-mail<input className={field} type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
            <label className="block text-sm">Senha<input className={field} type="password" autoComplete={createAccount ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} required /></label>
            <button disabled={busy || !client} className={btn}>{createAccount ? "Solicitar cadastro" : "Entrar"}</button>
            <button type="button" onClick={() => { setCreateAccount(v => !v); setError(""); setPassword(""); }} className="ml-3 text-sm text-blue-700 underline">{createAccount ? "Já tenho conta" : "Criar primeira conta"}</button>
          </form>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-4">
              <label className="text-sm font-semibold">Restaurante
                <select className={field} value={orgId} onChange={e => setOrgId(e.target.value)}>
                  {organizations.length === 0 && <option value="">Sem estabelecimento vinculado</option>}
                  {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
              <button className={btn} onClick={() => void loadData()} disabled={!orgId}>Atualizar dados</button>
            </div>
            {organizations.length === 0 && (
              <div role="status" className="mb-5 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-semibold">Conta autenticada, mas sem restaurante vinculado.</p>
                <p className="mt-1">O administrador do TGuia Food precisa vincular seu usuário à organização antes de liberar a gestão. Nenhuma permissão é concedida automaticamente.</p>
                <p className="mt-2 break-all font-mono text-xs">ID do usuário: {userId}</p>
                <button type="button" className={btn + " mt-2"} onClick={() => void loadOrganizations()}>Verificar acesso novamente</button>
              </div>
            )}
            <nav className="mb-5 flex flex-wrap gap-2 border-b border-[#acbac8] bg-[#e2e2e2] p-2">
              <button className={btn + (tab === "produtos" ? " border-[#2278aa] bg-white text-[#1160a2]" : "")} onClick={() => setTab("produtos")}>Produtos</button>
              {([["complementos","Complementos"],["observacoes","Observações"],["categorias","Categorias"],["tipos","Tipos e Tamanhos"],["insumos","Insumos"]] as const).map(([id,label])=><button type="button" key={id} className={btn + (tab===id?" border-[#2278aa] bg-white text-[#1160a2]":"")} onClick={()=>setTab(id)}>{label}</button>)}
              <button className={btn + (tab === "mesas" ? " border-[#2278aa] bg-white text-[#1160a2]" : "")} onClick={() => setTab("mesas")}>Mesas e Categorias</button>
            </nav>
            {tab === "categorias" ? <section className="space-y-3 border border-[#c4d0da] bg-white p-4"><h2 className="text-lg font-bold">Categorias de produtos</h2><p className="text-xs text-slate-600">As categorias são compartilhadas com o cadastro real de produtos no Supabase.</p><form onSubmit={addCategory} className="flex flex-wrap gap-2"><input aria-label="Nome da categoria" maxLength={100} required className={field} value={categoryName} onChange={e=>setCategoryName(e.target.value)} placeholder="Ex.: Bebidas" /><button disabled={busy||!orgId} className={btn}>Cadastrar categoria</button></form><div className="flex flex-wrap gap-2">{categories.map(category=><span key={category.id} className="border bg-[#e9eff5] px-3 py-2">{category.name}</span>)}</div>{!categories.length&&<p>Nenhuma categoria cadastrada.</p>}</section>
            : (tab === "complementos" || tab === "observacoes" || tab === "tipos" || tab === "insumos") ? <section className="border border-[#c4d0da] bg-white p-5"><h2 className="mb-2 text-lg font-bold">{{complementos:"Complementos",observacoes:"Observações",tipos:"Tipos e Tamanhos",insumos:"Insumos"}[tab]}</h2><p className="text-sm">Área de organização de produtos, seguindo o modelo do PDV de referência.</p><p className="mt-3 border-l-4 border-amber-400 bg-amber-50 p-3 text-sm">O cadastro desta seção ainda não está disponível no banco de dados. Nenhuma alteração será gravada até a integração ser implementada e validada.</p></section>
            : tab === "mesas" ? <div className="grid gap-5 lg:grid-cols-2">
              <section className="space-y-3 border border-[#c4d0da] bg-white p-4"><h2 className="font-bold">Cadastrar mesas</h2><form onSubmit={addTable} className="flex gap-2"><input aria-label="Número da mesa" type="number" min={1} max={9999} required className={field} value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="Mesa inicial" /><input aria-label="Mesa final opcional" type="number" min={1} max={9999} className={field} value={tableEnd} onChange={e => setTableEnd(e.target.value)} placeholder="Final (opcional)" /><button disabled={busy || !orgId} className={btn}>Cadastrar</button></form><p className="text-sm">{tables.length} mesas cadastradas</p><div className="flex flex-wrap gap-2">{tables.map(t => <span key={t.id} className="rounded border bg-[#e9eff5] px-3 py-2 text-sm">Mesa {t.number}</span>)}</div></section>
              <section className="space-y-3 border border-[#c4d0da] bg-white p-4"><h2 className="font-bold">Categorias de produtos</h2><form onSubmit={addCategory} className="flex gap-2"><input aria-label="Nome da categoria" maxLength={100} required className={field} value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="Ex.: Bebidas" /><button disabled={busy || !orgId} className={btn}>Cadastrar</button></form><div className="flex flex-wrap gap-2">{categories.map(c => <span key={c.id} className="rounded border bg-[#e9eff5] px-3 py-2 text-sm">{c.name}</span>)}</div></section>
            </div> : tab === "produtos" ? <div className="grid gap-5 lg:grid-cols-[350px_1fr]">
              <form onSubmit={saveProduct} className="space-y-3 border border-[#c4d0da] bg-white p-4">
                <h2 className="font-bold">{editing ? "Editar produto" : "Novo produto"}</h2>
                <label className="block text-sm">Código<input className={field} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} maxLength={80} /></label>
                <label className="block text-sm">Nome<input className={field} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={200} required /></label>
                <label className="block text-sm">Preço de venda<input className={field} inputMode="decimal" value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value })} required /></label>
                <label className="block text-sm">Categoria<select className={field} value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}><option value="">Sem categoria</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Produto ativo</label>
                <div className="flex gap-2"><button className={btn} disabled={busy || !orgId}>Salvar produto</button><button type="button" className={btn} onClick={() => { setForm(empty); setEditing(null); }}>Limpar</button></div>
              </form>
              <section className="min-w-0 border border-[#c4d0da] bg-white p-4">
                <h2 className="mb-3 font-bold">Produtos cadastrados ({products.length})</h2>
                <input className={field} aria-label="Buscar produtos" placeholder="Buscar por nome ou código" value={query} onChange={e => setQuery(e.target.value)} />
                <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[#e7edf3]"><tr><th className="p-2">Código</th><th className="p-2">Produto</th><th className="p-2">Preço</th><th className="p-2">Situação</th><th className="p-2">Ações</th></tr></thead><tbody>{visible.map(p => <tr className="border-b" key={p.id}><td className="p-2">{p.code || "—"}</td><td className="p-2">{p.name}</td><td className="p-2">{currency(Number(p.sale_price))}</td><td className="p-2">{p.active ? "Ativo" : "Inativo"}</td><td className="whitespace-nowrap p-2"><button className={btn} onClick={() => { setEditing(p.id); setForm({ code: p.code || "", name: p.name, sale_price: String(p.sale_price), category_id: p.category_id || "", active: p.active }); }}>Editar</button> <button disabled={busy} className={btn} onClick={() => void toggleProduct(p)}>{p.active ? "Desativar" : "Ativar"}</button></td></tr>)}</tbody></table>{visible.length === 0 && <p className="p-4 text-sm">Nenhum produto encontrado.</p>}</div>
              </section>
            </div> : null}
          </>
        )}
      </main>
    </div>
  );
}
