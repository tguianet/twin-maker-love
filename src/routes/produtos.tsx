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
 const [categories,setCategories]=useState<Category[]>([]);const [view,setView]=useState<"products"|"categories"|"complementos"|"observacoes"|"tipos"|"perguntas"|"insumos"|"lote"|"nfe"|null>(null);
 const [query,setQuery]=useState("");const [form,setForm]=useState(blank);const [edit,setEdit]=useState<string|null>(null);
 const [categoryName,setCategoryName]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const [authenticated,setAuthenticated]=useState(false);
 const [stack,setStack]=useState<string[]>([]);
 const [maximized,setMaximized]=useState<string[]>([]);
 const [minimized,setMinimized]=useState<string[]>([]);
 const openPanel=(id:string)=>{setView(id as typeof view);setStack(previous=>[...previous.filter(x=>x!==id),id]);setMinimized(previous=>previous.filter(x=>x!==id));setError("");setNotice("");};
 const closePanel=()=>{setStack(previous=>{const next=previous.slice(0,-1);setView((next[next.length-1]||null) as typeof view);return next;});};
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
 const commands=[{id:"products",icon:"🍔",name:"Produtos",group:"Produtos"},{id:"complementos",icon:"🥓",name:"Complementos",group:"Organização de Produtos"},{id:"observacoes",icon:"📝",name:"Observações",group:"Organização de Produtos"},{id:"categories",icon:"🏷️",name:"Categorias",group:"Organização de Produtos"},{id:"tipos",icon:"🅣",name:"Tipos e Tamanhos",group:"Organização de Produtos"},{id:"perguntas",icon:"❔",name:"Perguntas",group:"Organização de Produtos"},{id:"insumos",icon:"🍅",name:"Insumos",group:"Insumos"},{id:"lote",icon:"🛒",name:"Alterar em Lote",group:"Estoque"},{id:"nfe",icon:"📄",name:"Alterar com NFe",group:"Estoque"}] as const;
 const groups=["Produtos","Organização de Produtos","Insumos","Estoque"] as const;
 const labels:Record<string,string>={products:"Produtos",categories:"Categorias",complementos:"Complementos",observacoes:"Observações",tipos:"Tipos e Tamanhos",perguntas:"Perguntas",insumos:"Insumos",lote:"Alterar em Lote",nfe:"Alterar com NFe"};
 return <main className="flex min-h-screen flex-col bg-[#f0f0f0] font-[Segoe_UI,Tahoma,Arial,sans-serif] text-[#303030]">
  <header className="shrink-0 bg-[#383838] text-white">
   <div className="flex h-9 items-end gap-0 overflow-x-auto px-2 text-[11px]">
    <a href="/" className="shrink-0 px-3 py-3 hover:bg-[#505050]">PRINCIPAL</a>
    <span className="shrink-0 rounded-t-sm bg-[#e6e6e6] px-4 py-3 font-semibold text-[#333]">PRODUTOS</span>
    {["MARKETING","FINANCEIRO","RELATÓRIOS","APPS","CONFIGURAÇÕES"].map(label=><span key={label} className="shrink-0 px-3 py-3 text-[#d0d0d0]">{label}</span>)}
    <span className="shrink-0 px-3 py-3 text-[#ccc]">⌕ Pesquisar</span>
   </div>
   <div className="flex h-[104px] gap-0 overflow-x-auto border-b border-[#bcbcbc] bg-[#e6e6e6] text-[#333] shadow-inner">
    {groups.map(group=><section key={group} className="flex shrink-0 flex-col justify-between border-r border-[#c9c9c9] px-2.5 pb-1 pt-1.5">
     <div className="flex flex-1 items-center">
      {commands.filter(cmd=>cmd.group===group).map(cmd=><button key={cmd.id} type="button" onClick={()=>openPanel(cmd.id)} aria-pressed={view===cmd.id} className={"flex h-[68px] w-[76px] flex-col items-center justify-center gap-1 rounded-sm px-1 transition-colors hover:bg-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 "+(view===cmd.id?"bg-white/70":"")}>
       <span aria-hidden="true" className="text-[28px] leading-none">{cmd.icon}</span><span className="text-center text-[11px] leading-tight">{cmd.name}</span>
      </button>)}
     </div>
     <span className="text-center text-[10px] text-[#858585]">{group}</span>
    </section>)}
   </div>
  </header>
  <div className="relative min-h-[calc(100vh-140px)] flex-1 overflow-hidden bg-[#ededed]">
   <iframe title="Mesas do restaurante ao fundo" src="/" tabIndex={-1} className="absolute inset-0 h-full w-full border-0" />
   {stack.length>0&&<div className="absolute inset-0 bg-[#14202e]/50" aria-hidden="true"/>}
   <div className="relative flex flex-col items-center gap-3 p-4 pointer-events-none">
   {stack.map((panel,i)=><section key={panel} style={{position:"absolute",top:maximized.includes(panel)?"8px":`${Math.min(26+i*28,120)}px`,left:maximized.includes(panel)?"1%":`calc(50% - min(530px, 46vw) + ${Math.min(i*12,48)}px)`,zIndex:20+i,width:maximized.includes(panel)?"98%":"min(1060px,92vw)",height:minimized.includes(panel)?"34px":maximized.includes(panel)?"calc(100vh - 165px)":"min(690px,calc(100vh - 190px))"}} className="pointer-events-auto flex flex-col overflow-hidden border border-[#777] bg-[#f7f7f7] text-[12px] shadow-[0_16px_45px_rgba(0,0,0,0.4)]">
    <div onClick={()=>{setStack(current=>[...current.filter(x=>x!==panel),panel]);setView(panel as typeof view);}} className="flex h-8 shrink-0 cursor-default items-center justify-between border-b border-[#292929] bg-[#3e3e3e] px-3 text-xs font-semibold text-white"><span>{labels[panel]} — TGuia Food</span><div className="flex items-center"><button type="button" aria-label={"Minimizar "+labels[panel]} onClick={event=>{event.stopPropagation();setMinimized(previous=>previous.includes(panel)?previous.filter(x=>x!==panel):[...previous,panel]);}} className="flex h-8 w-10 items-center justify-center hover:bg-[#555]">−</button><button type="button" aria-label={"Maximizar ou restaurar "+labels[panel]} onClick={event=>{event.stopPropagation();setMaximized(previous=>previous.includes(panel)?previous.filter(x=>x!==panel):[...previous,panel]);setMinimized(previous=>previous.filter(x=>x!==panel));}} className="flex h-8 w-10 items-center justify-center hover:bg-[#555]">□</button><button type="button" onClick={()=>{setStack(current=>current.filter(x=>x!==panel));if(view===panel)setView((stack.filter(x=>x!==panel).at(-1)||null) as typeof view);}} aria-label="Fechar janela" className="flex h-8 w-10 items-center justify-center text-lg hover:bg-[#e81123]">×</button></div></div>
   {!minimized.includes(panel)&&<>{error&&<p role="alert" className="border-b bg-red-50 p-3 text-sm text-red-700">{error}</p>}
   {notice&&<p role="status" className="border-b bg-green-50 p-3 text-sm text-green-700">{notice}</p>}
   {!authenticated?<div className="p-5"><p role="status" className="mb-2">Conecte seu usuário de restaurante para consultar dados reais.</p><a href="/gestao" className="text-blue-700 underline">Entrar na Gestão</a></div>:
   panel==="products"?<div className="grid min-h-0 flex-1 gap-3 overflow-auto bg-white p-3 lg:grid-cols-[295px_1fr]">
    <form onSubmit={save} className="space-y-3 border border-[#bcbcbc] bg-[#f0f0f0] p-3">
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
     <div className="mt-3 max-h-[480px] overflow-auto border border-[#c9c9c9]"><table className="w-full min-w-[490px] border-collapse text-left text-xs"><thead className="sticky top-0 bg-[#eee]"><tr>{["Código","Produto","Preço","Situação","Ações"].map(x=><th key={x} className="border p-2">{x}</th>)}</tr></thead>
      <tbody>{visible.map(p=><tr key={p.id} className="border-b hover:bg-[#eef5fb]"><td className="p-2">{p.code||"—"}</td><td className="p-2">{p.name}</td><td className="p-2">{money(Number(p.sale_price))}</td><td className="p-2">{p.active?"Ativo":"Inativo"}</td><td className="whitespace-nowrap p-2"><button className="mr-2 text-blue-700 underline" onClick={()=>{setEdit(p.id);setForm({code:p.code||"",name:p.name,sale_price:String(p.sale_price),category_id:p.category_id||"",active:p.active})}}>Editar</button><button disabled={busy} className="text-blue-700 underline" onClick={()=>void toggle(p)}>{p.active?"Desativar":"Ativar"}</button></td></tr>)}</tbody></table>
      {!visible.length&&<p className="p-4 text-gray-500">Nenhum produto encontrado.</p>}</div>
    </section>
   </div>:panel==="categories"?<div className="flex min-h-0 flex-1 flex-col bg-white"><div className="flex flex-wrap items-center gap-2 border-b border-[#c9c9c9] bg-[#efefef] px-3 py-2"><strong className="mr-auto text-xs">Organização de Produtos / Categorias</strong><button type="button" className={button} disabled={!org||busy} onClick={()=>void load(org).catch(e=>setError(e.message))}>⟳ Atualizar</button></div><form className="flex flex-wrap items-end gap-3 border-b p-4" onSubmit={addCategory}><label className="min-w-[220px] flex-1 text-xs">Nome da categoria<input required value={categoryName} maxLength={100} onChange={e=>setCategoryName(e.target.value)} className={field+" mt-1"} placeholder="Digite a categoria"/></label><button disabled={busy||!org} className={button+" bg-[#278d53] font-semibold text-white"}>+ Cadastrar categoria</button></form><div className="min-h-0 flex-1 overflow-auto p-3"><table className="w-full border-collapse text-left text-xs"><thead className="sticky top-0 bg-[#e6e6e6]"><tr><th className="w-20 border border-[#cfcfcf] p-2">Nº</th><th className="border border-[#cfcfcf] p-2">Categoria</th><th className="w-28 border border-[#cfcfcf] p-2 text-right">Produtos</th></tr></thead><tbody>{categories.map((x,i)=><tr key={x.id} className="even:bg-[#f4f4f4] hover:bg-[#e5f1ff]"><td className="border-b px-2 py-2">{String(i+1).padStart(2,"0")}</td><td className="border-b px-2 py-2">{x.name}</td><td className="border-b px-2 py-2 text-right">{products.filter(p=>p.category_id===x.id).length}</td></tr>)}</tbody></table>{categories.length===0&&<p className="p-4 text-gray-500">Nenhuma categoria cadastrada.</p>}</div><div className="border-t bg-[#f1f1f1] px-3 py-2 text-xs text-[#666]">{categories.length} categoria(s) • Cadastro central do restaurante</div></div>:<div className="p-6"><h2 className="mb-2 text-base font-semibold">{labels[panel]}</h2><p className="text-sm">Esta função ainda não está integrada ao cadastro real. Nenhuma informação será gravada até a implementação do módulo.</p></div>}
   </>}
   </section>)}
   </div>
  </div>
 </main>;
}
