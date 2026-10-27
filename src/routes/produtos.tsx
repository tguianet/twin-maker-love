import {createFileRoute} from "@tanstack/react-router";
import {useEffect,useMemo,useState} from "react";
import {supabase} from "../lib/supabase";

export const Route=createFileRoute("/produtos")({component:ProductsPDV});
type Product={id:string;code:string|null;name:string;sale_price:number;active:boolean;category_id:string|null};
type Category={id:string;name:string};
const field="w-full border border-[#acb3ba] bg-white px-2 py-2 text-sm";
const button="border border-[#b8b8b8] bg-white px-4 py-2 text-sm hover:bg-[#e6e6e6] disabled:opacity-40";
const money=(n:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n);
const blank={code:"",name:"",sale_price:"",category_id:"",active:true};
function ProductsPDV(){
 const [org,setOrg]=useState("");const [products,setProducts]=useState<Product[]>([]);
 const [categories,setCategories]=useState<Category[]>([]);const [view,setView]=useState<"products"|"categories">("products");
 const [query,setQuery]=useState("");const [form,setForm]=useState(blank);const [edit,setEdit]=useState<string|null>(null);
 const [categoryName,setCategoryName]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const [authenticated,setAuthenticated]=useState(false);
 const load=async(id:string)=>{
  const [p,c]=await Promise.all([
   supabase.from("products").select("id,code,name,sale_price,active,category_id").eq("organization_id",id).order("name"),
   supabase.from("product_categories").select("id,name").eq("organization_id",id).order("name")
  ]);
  if(p.error||c.error)throw new Error(p.error?.message||c.error?.message||"Erro ao carregar produtos.");
  setProducts((p.data||[]) as Product[]);setCategories((c.data||[]) as Category[]);
 };
 useEffect(()=>{let mounted=true;(async()=>{
  try{
   const {data:a,error:e}=await supabase.auth.getUser();if(e)throw e;
   if(!a.user)throw Error("Faça login na Gestão para acessar os produtos reais.");
   const {data:m,error:me}=await supabase.from("organization_members").select("organization_id").eq("user_id",a.user.id).eq("active",true).limit(1);
   if(me)throw me;if(!m?.[0])throw Error("Usuário sem restaurante vinculado.");
   if(!mounted)return;setAuthenticated(true);setOrg(m[0].organization_id);await load(m[0].organization_id);
  }catch(e){if(mounted)setError(e instanceof Error?e.message:"Não foi possível acessar os produtos.");}
 })();return()=>{mounted=false};},[]);
 const visible=useMemo(()=>products.filter(p=>(p.name+" "+(p.code||"")).toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))),[products,query]);
 const save=async(e:React.FormEvent)=>{e.preventDefault();if(!org||busy)return;setBusy(true);setError("");setNotice("");
 try{
  const price=Number(form.sale_price.replace(",","."));
  if(!form.name.trim()||!Number.isFinite(price)||price<0)throw Error("Informe nome e preço válido.");
  const payload={organization_id:org,code:form.code.trim()||null,name:form.name.trim(),sale_price:price,category_id:form.category_id||null,active:form.active};
  const result=edit?await supabase.from("products").update(payload).eq("id",edit).eq("organization_id",org):await supabase.from("products").insert(payload);
  if(result.error)throw result.error;
  setNotice(edit?"Produto atualizado.":"Produto cadastrado.");setEdit(null);setForm(blank);await load(org);
 }catch(e){setError(e instanceof Error?e.message:"Erro ao salvar produto.");}finally{setBusy(false);}};
 const addCategory=async(e:React.FormEvent)=>{e.preventDefault();if(!org||busy||!categoryName.trim())return;setBusy(true);setError("");
 try{const {error:e}=await supabase.from("product_categories").insert({organization_id:org,name:categoryName.trim().slice(0,100)});if(e)throw e;setCategoryName("");setNotice("Categoria cadastrada.");await load(org);}
 catch(e){setError(e instanceof Error?e.message:"Falha ao cadastrar categoria.");}finally{setBusy(false);}};
 const toggle=async(p:Product)=>{if(!org||busy)return;setBusy(true);setError("");try{const {error:e}=await supabase.from("products").update({active:!p.active}).eq("id",p.id).eq("organization_id",org);if(e)throw e;await load(org);}catch(e){setError(e instanceof Error?e.message:"Erro ao atualizar produto.");}finally{setBusy(false);}};
 return <main className="min-h-screen bg-[#5c5c5c] font-[Segoe_UI,Tahoma,Arial,sans-serif] text-[#303030]">
  <header className="flex flex-wrap items-center gap-4 bg-[#3b3b3b] px-4 py-2 text-xs text-white"><a href="/" className="text-gray-200 hover:underline">PRINCIPAL</a><strong className="bg-[#e2e2e2] px-4 py-2 text-[#222]">PRODUTOS</strong><a href="/gestao" className="text-gray-300 hover:underline">GESTÃO / GELADEIRA</a></header>
  <nav className="flex flex-wrap gap-2 border-b border-[#c7c7c7] bg-[#e2e2e2] p-3">
   <button className={button+(view==="products"?" font-bold":"")} onClick={()=>setView("products")}>Produtos</button>
   <button className={button+(view==="categories"?" font-bold":"")} onClick={()=>setView("categories")}>Categorias</button>
   <a href="/gestao" className={button}>Estoque / Geladeira</a>
   <button className={button+" ml-auto"} disabled={!org||busy} onClick={()=>void load(org).catch(e=>setError(e.message))}>Atualizar</button>
  </nav>
  <div className="mx-auto mt-5 w-[min(1180px,96%)] border border-[#555] bg-white shadow-xl">
   <div className="flex items-center justify-between bg-[#3e3e3e] px-3 py-2 text-xs font-semibold text-white"><span>Cadastro de {view==="products"?"Produtos":"Categorias"} — TGuia Food</span><a href="/" aria-label="Fechar" className="px-3 text-lg hover:bg-red-700">×</a></div>
   {error&&<p role="alert" className="border-b bg-red-50 p-3 text-sm text-red-700">{error}</p>}
   {notice&&<p role="status" className="border-b bg-green-50 p-3 text-sm text-green-700">{notice}</p>}
   {!authenticated?<div className="p-5"><a href="/gestao" className="text-blue-700 underline">Entrar na Gestão</a></div>:
   view==="products"?<div className="grid gap-4 p-4 lg:grid-cols-[320px_1fr]">
    <form onSubmit={save} className="space-y-3 border bg-[#f3f3f3] p-4">
     <h2 className="font-semibold">{edit?"Editar produto":"Novo produto"}</h2>
     <label className="block text-xs">Código<input className={field} value={form.code} maxLength={80} onChange={e=>setForm({...form,code:e.target.value})}/></label>
     <label className="block text-xs">Nome<input required className={field} value={form.name} maxLength={200} onChange={e=>setForm({...form,name:e.target.value})}/></label>
     <label className="block text-xs">Preço de venda<input required className={field} inputMode="decimal" value={form.sale_price} onChange={e=>setForm({...form,sale_price:e.target.value})}/></label>
     <label className="block text-xs">Categoria<select className={field} value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})}><option value="">Sem categoria</option>{categories.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
     <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/>Ativo</label>
     <div className="flex gap-2"><button disabled={busy} className={button+" bg-[#308d5e] font-semibold text-white"}>Salvar</button><button type="button" className={button} onClick={()=>{setEdit(null);setForm(blank)}}>Limpar</button></div>
    </form>
    <section className="min-w-0"><h2 className="mb-3 font-semibold">Produtos cadastrados ({products.length})</h2>
     <input className={field} placeholder="Buscar produto ou código" aria-label="Buscar produtos" value={query} onChange={e=>setQuery(e.target.value)}/>
     <div className="mt-3 max-h-[550px] overflow-auto"><table className="w-full min-w-[490px] border-collapse text-left text-xs"><thead className="sticky top-0 bg-[#eee]"><tr>{["Código","Produto","Preço","Situação","Ações"].map(x=><th key={x} className="border p-2">{x}</th>)}</tr></thead>
      <tbody>{visible.map(p=><tr key={p.id} className="border-b hover:bg-[#eef5fb]"><td className="p-2">{p.code||"—"}</td><td className="p-2">{p.name}</td><td className="p-2">{money(Number(p.sale_price))}</td><td className="p-2">{p.active?"Ativo":"Inativo"}</td><td className="whitespace-nowrap p-2"><button className="mr-2 text-blue-700 underline" onClick={()=>{setEdit(p.id);setForm({code:p.code||"",name:p.name,sale_price:String(p.sale_price),category_id:p.category_id||"",active:p.active})}}>Editar</button><button disabled={busy} className="text-blue-700 underline" onClick={()=>void toggle(p)}>{p.active?"Desativar":"Ativar"}</button></td></tr>)}</tbody></table>
      {!visible.length&&<p className="p-4 text-gray-500">Nenhum produto encontrado.</p>}</div>
    </section>
   </div>:<div className="space-y-4 p-5"><h2 className="font-semibold">Categorias cadastradas</h2><form className="flex flex-wrap gap-2" onSubmit={addCategory}><input required value={categoryName} maxLength={100} onChange={e=>setCategoryName(e.target.value)} className={field+" max-w-sm"} placeholder="Nova categoria"/><button disabled={busy} className={button}>Adicionar categoria</button></form><div className="flex flex-wrap gap-2">{categories.map(x=><span key={x.id} className="border bg-[#eee] px-3 py-2">{x.name}</span>)}</div></div>}
  </div>
 </main>;
}
