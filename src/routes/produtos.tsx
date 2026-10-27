import { AppTopTabs } from "../components/AppTopTabs";
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
 const [productStatus,setProductStatus]=useState<"all"|"active"|"inactive">("all");
 const [productCategory,setProductCategory]=useState("all");
 const [query,setQuery]=useState("");const [form,setForm]=useState(blank);const [edit,setEdit]=useState<string|null>(null);
 const [selectedProductId,setSelectedProductId]=useState<string|null>(null);
 const selectProduct=(p:Product)=>{setSelectedProductId(p.id);setEdit(p.id);setForm({code:p.code||"",name:p.name,sale_price:String(p.sale_price),category_id:p.category_id||"",active:p.active});};
 const duplicateProduct=(p:Product)=>{setSelectedProductId(null);setEdit(null);setForm({code:"",name:p.name+" (cópia)",sale_price:String(p.sale_price),category_id:p.category_id||"",active:p.active});setNotice("Cópia preparada. Revise e clique em Cadastrar produto para salvar.");};
 const [categorySearch,setCategorySearch]=useState("");
 const [selectedCategoryId,setSelectedCategoryId]=useState<string|null>(null);
 const [categoryName,setCategoryName]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const [authenticated,setAuthenticated]=useState(false);
 const [stack,setStack]=useState<string[]>([]);
 useEffect(()=>{const handler=(event:KeyboardEvent)=>{if(event.key!=="Escape"||!stack.length)return;const active=event.target;if(active instanceof HTMLElement&&(active.matches("input,textarea,select,[contenteditable=true]")||active.closest("[role=dialog]")))return;event.preventDefault();const next=stack.slice(0,-1);setStack(next);setView((next[next.length-1]||null) as typeof view);};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler);},[stack]);
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
 const visible=useMemo(()=>products.filter(p=>(p.name+" "+(p.code||"")).toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))&&(productStatus==="all"||(productStatus==="active"?p.active:!p.active))&&(productCategory==="all"||p.category_id===productCategory)),[products,query,productStatus,productCategory]);
 const save=async(e:React.FormEvent)=>{e.preventDefault();if(!org||busy)return;setBusy(true);setError("");setNotice("");
 try{
  const price=Number(form.sale_price.replace(",","."));
  if(!form.name.trim()||!Number.isFinite(price)||price<0)throw Error("Informe nome e preço válido.");
  const normalizedName=form.name.trim().toLocaleLowerCase("pt-BR");
  const normalizedCode=form.code.trim().toLocaleLowerCase("pt-BR");
  if(products.some(p=>p.id!==edit&&p.name.trim().toLocaleLowerCase("pt-BR")===normalizedName))throw Error("Já existe um produto com este nome. Selecione-o na tabela para editar.");
  if(normalizedCode&&products.some(p=>p.id!==edit&&(p.code||"").trim().toLocaleLowerCase("pt-BR")===normalizedCode))throw Error("Este código já está cadastrado em outro produto.");
  const payload={organization_id:org,code:form.code.trim()||null,name:form.name.trim(),sale_price:price,category_id:form.category_id||null,active:form.active};
  const result=edit?await supabase.from("products").update(payload).eq("id",edit).eq("organization_id",org):await supabase.from("products").insert(payload);
  if(result.error)throw result.error;
  setNotice(edit?"Produto atualizado com sucesso.":"Produto cadastrado com sucesso.");setEdit(null);setSelectedProductId(null);setForm(blank);await load(org);
 }catch(e){setError(e instanceof Error?e.message:"Erro ao salvar produto.");}finally{setBusy(false);}};
 const addCategory=async(e:React.FormEvent)=>{e.preventDefault();if(!org||busy||!categoryName.trim())return;setBusy(true);setError("");setNotice("");
 try{const name=categoryName.trim().slice(0,100);if(categories.some(cat=>cat.id!==selectedCategoryId&&cat.name.trim().toLocaleLowerCase("pt-BR")===name.toLocaleLowerCase("pt-BR")))throw Error("Já existe uma categoria com este nome. Selecione-a na lista para editar.");const result=selectedCategoryId?await supabase.from("product_categories").update({name}).eq("id",selectedCategoryId).eq("organization_id",org):await supabase.from("product_categories").insert({organization_id:org,name});if(result.error)throw result.error;setCategoryName("");setSelectedCategoryId(null);setNotice(selectedCategoryId?"Categoria atualizada.":"Categoria cadastrada.");await load(org);}
 catch(e){setError(e instanceof Error?e.message:"Falha ao cadastrar categoria.");}finally{setBusy(false);}};
 const toggle=async(p:Product)=>{if(!org||busy)return;setBusy(true);setError("");try{const {error:e}=await supabase.from("products").update({active:!p.active}).eq("id",p.id).eq("organization_id",org);if(e)throw e;await load(org);}catch(e){setError(e instanceof Error?e.message:"Erro ao atualizar produto.");}finally{setBusy(false);}};
 const commands=[{id:"products",icon:"🍔",name:"Produtos",group:"Produtos"},{id:"complementos",icon:"🥓",name:"Complementos",group:"Organização de Produtos"},{id:"observacoes",icon:"📝",name:"Observações",group:"Organização de Produtos"},{id:"categories",icon:"🏷️",name:"Categorias",group:"Organização de Produtos"},{id:"tipos",icon:"🅣",name:"Tipos e Tamanhos",group:"Organização de Produtos"},{id:"perguntas",icon:"❔",name:"Perguntas",group:"Organização de Produtos"},{id:"insumos",icon:"🍅",name:"Insumos",group:"Insumos"},{id:"lote",icon:"🛒",name:"Alterar em Lote",group:"Estoque"},{id:"nfe",icon:"📄",name:"Alterar com NFe",group:"Estoque"}] as const;
 const groups=["Produtos","Organização de Produtos","Insumos","Estoque"] as const;
 const labels:Record<string,string>={products:"Produtos",categories:"Categorias",complementos:"Complementos",observacoes:"Observações",tipos:"Tipos e Tamanhos",perguntas:"Perguntas",insumos:"Insumos",lote:"Alterar em Lote",nfe:"Alterar com NFe"};
 return <main className="flex min-h-screen flex-col bg-[#f0f0f0] font-[Segoe_UI,Tahoma,Arial,sans-serif] text-[#303030]">
  <AppTopTabs active="produtos" />
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
  <div className="relative min-h-[calc(100vh-140px)] flex-1 overflow-hidden bg-[#ededed]">
   <iframe title="Mesas do restaurante ao fundo" src="/?embedded=1" tabIndex={-1} className="absolute inset-0 h-full w-full border-0" />
   {stack.length>0&&<div className="absolute inset-0 bg-[#14202e]/50" aria-hidden="true"/>}
   <div className="relative flex flex-col items-center gap-3 p-4 pointer-events-none">
   {stack.map((panel,i)=><section key={panel} style={{position:"absolute",top:maximized.includes(panel)?"8px":`${Math.min(26+i*28,120)}px`,left:maximized.includes(panel)?"1%":`calc(50% - min(530px, 46vw) + ${Math.min(i*12,48)}px)`,zIndex:20+i,width:maximized.includes(panel)?"98%":"min(1060px,92vw)",height:minimized.includes(panel)?"34px":maximized.includes(panel)?"calc(100vh - 165px)":"min(690px,calc(100vh - 190px))"}} className={"pointer-events-auto flex flex-col overflow-hidden border bg-[#f7f7f7] text-[12px] shadow-[0_16px_45px_rgba(0,0,0,0.4)] "+(i===stack.length-1?"border-[#4c8bbb] ring-1 ring-[#4c8bbb]":"border-[#777]")}>
    <div onClick={()=>{setStack(current=>[...current.filter(x=>x!==panel),panel]);setView(panel as typeof view);}} className="flex h-8 shrink-0 cursor-default items-center justify-between border-b border-[#292929] bg-[#3e3e3e] px-3 text-xs font-semibold text-white"><span>{labels[panel]} — TGuia Food</span><div className="flex items-center"><button type="button" aria-label={"Minimizar "+labels[panel]} onClick={event=>{event.stopPropagation();setMinimized(previous=>previous.includes(panel)?previous.filter(x=>x!==panel):[...previous,panel]);}} className="flex h-8 w-10 items-center justify-center hover:bg-[#555]">−</button><button type="button" aria-label={"Maximizar ou restaurar "+labels[panel]} onClick={event=>{event.stopPropagation();setMaximized(previous=>previous.includes(panel)?previous.filter(x=>x!==panel):[...previous,panel]);setMinimized(previous=>previous.filter(x=>x!==panel));}} className="flex h-8 w-10 items-center justify-center hover:bg-[#555]">□</button><button type="button" onClick={event=>{event.stopPropagation();const next=stack.filter(x=>x!==panel);setStack(next);setView((next[next.length-1]||null) as typeof view);setMinimized(current=>current.filter(x=>x!==panel));setMaximized(current=>current.filter(x=>x!==panel));}} aria-label="Fechar janela" className="flex h-8 w-10 items-center justify-center text-lg hover:bg-[#e81123]">×</button></div></div>
   {!minimized.includes(panel)&&<>{error&&<p role="alert" className="border-b bg-red-50 p-3 text-sm text-red-700">{error}</p>}
   {notice&&<p role="status" className="border-b bg-green-50 p-3 text-sm text-green-700">{notice}</p>}
   {!authenticated?<div className="p-5"><p role="status" className="mb-2">Conecte seu usuário de restaurante para consultar dados reais.</p><a href="/gestao" className="text-blue-700 underline">Entrar na Gestão</a></div>:
   panel==="products"?<div className="grid min-h-0 flex-1 gap-3 overflow-auto bg-white p-3 lg:grid-cols-[295px_1fr]">
    <form onSubmit={save} className="space-y-3 border border-[#bcbcbc] bg-[#f0f0f0] p-3">
     <div className="flex items-center justify-between border-b border-[#c7c7c7] pb-2"><h2 className="font-semibold">{edit?"Editar produto":"Novo produto"}</h2><span className={"px-2 py-1 text-[10px] font-semibold "+(edit?"bg-[#fff0ca] text-[#805500]":"bg-[#dff3e5] text-[#237047]")}>{edit?"EM EDIÇÃO":"NOVO CADASTRO"}</span></div>
     <label className="block text-xs">Código<input className={field} value={form.code} maxLength={80} onChange={e=>setForm({...form,code:e.target.value})}/></label>
     <label className="block text-xs">Nome<input required className={field} value={form.name} maxLength={200} onChange={e=>setForm({...form,name:e.target.value})}/></label>
     <label className="block text-xs">Preço de venda<input required className={field} inputMode="decimal" value={form.sale_price} onChange={e=>setForm({...form,sale_price:e.target.value})}/></label>
     <label className="block text-xs">Categoria<select className={field} value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})}><option value="">Sem categoria</option>{categories.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
     <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/>Ativo</label>
     <div className="flex flex-wrap gap-2 border-t border-[#c7c7c7] pt-3"><button disabled={busy||!org} className={button+" bg-[#308d5e] font-semibold text-white"}>{busy?"Salvando...":edit?"Salvar alterações":"Cadastrar produto"}</button><button type="button" className={button} onClick={()=>{setEdit(null);setSelectedProductId(null);setForm(blank);}}>Novo / Limpar</button></div><p className="text-[11px] text-[#666]">{edit?"Altere os campos e confirme em Salvar alterações.":"O produto será cadastrado no mesmo catálogo utilizado pelas mesas e pela geladeira."}</p>
    </form>
    <section className="min-w-0"><div className="mb-2 flex items-center justify-between gap-2"><h2 className="font-semibold">Produtos cadastrados ({products.length})</h2><button type="button" className={button+" !px-2 !py-1"} disabled={!org||busy} onClick={()=>void load(org).catch(e=>setError(e.message))}>⟳ Atualizar</button></div>
     <div className="grid gap-2 md:grid-cols-[minmax(160px,1fr)_150px_160px]"><input className={field} placeholder="Buscar nome ou código" aria-label="Buscar produtos" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Filtrar situação" className={field} value={productStatus} onChange={e=>setProductStatus(e.target.value as typeof productStatus)}><option value="all">Todas situações</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select><select aria-label="Filtrar categoria" className={field} value={productCategory} onChange={e=>setProductCategory(e.target.value)}><option value="all">Todas categorias</option>{categories.map(cat=><option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></div>
     <div className="mt-3 max-h-[480px] overflow-auto border border-[#c9c9c9]"><table className="w-full min-w-[490px] border-collapse text-left text-xs"><thead className="sticky top-0 z-10 bg-[#e4e4e4] text-[#444]"><tr><th className="w-[80px] border border-[#c9c9c9] p-2 text-left font-semibold">Código</th><th className="border border-[#c9c9c9] p-2 text-left font-semibold">Produto</th><th className="w-[100px] border border-[#c9c9c9] p-2 text-right font-semibold">Preço</th><th className="w-[85px] border border-[#c9c9c9] p-2 text-center font-semibold">Situação</th><th className="w-[145px] border border-[#c9c9c9] p-2 text-center font-semibold">Ações</th></tr></thead>
      <tbody>{visible.map(p=><tr key={p.id} onClick={()=>selectProduct(p)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selectProduct(p);}}} tabIndex={0} aria-selected={selectedProductId===p.id} className={"cursor-pointer border-b border-[#dedede] hover:bg-[#eef5fb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 "+(selectedProductId===p.id?"bg-[#dcecff]":"even:bg-[#f7f7f7]")}><td className="p-2">{p.code||"—"}</td><td className="p-2">{p.name}</td><td className="p-2 text-right tabular-nums">{money(Number(p.sale_price))}</td><td className="p-2 text-center"><span className={p.active?"text-[#278d53]":"text-[#999]"}>{p.active?"● Ativo":"○ Inativo"}</span></td><td className="whitespace-nowrap p-2 text-center"><button className="mr-2 text-blue-700 underline" onClick={event=>{event.stopPropagation();selectProduct(p);}}>Editar</button><button type="button" className="mr-2 text-blue-700 underline" onClick={event=>{event.stopPropagation();duplicateProduct(p);}}>Duplicar</button><button disabled={busy} className="text-blue-700 underline" onClick={event=>{event.stopPropagation();void toggle(p);}}>{p.active?"Desativar":"Ativar"}</button></td></tr>)}</tbody></table>
      {!visible.length&&<p className="p-4 text-gray-500">Nenhum produto encontrado para os filtros selecionados.</p>}</div><div className="mt-2 flex flex-wrap justify-between gap-2 border-t border-[#ddd] pt-2 text-[11px] text-[#666]"><span>Exibindo {visible.length} de {products.length} produtos</span><span>{products.filter(p=>p.active).length} ativos · {products.filter(p=>!p.active).length} inativos</span></div>
    </section>
   </div>:panel==="categories"?<div className="flex min-h-0 flex-1 flex-col bg-white"><div className="flex flex-wrap items-center gap-2 border-b border-[#c9c9c9] bg-[#efefef] px-3 py-2"><strong className="mr-auto text-xs">Organização de Produtos / Categorias</strong><input aria-label="Pesquisar categorias" placeholder="Pesquisar categoria..." value={categorySearch} onChange={e=>setCategorySearch(e.target.value)} className={field+" max-w-[220px] !py-1"}/><button type="button" className={button} disabled={!org||busy} onClick={()=>void load(org).catch(e=>setError(e.message))}>⟳ Atualizar</button></div><form className="flex flex-wrap items-end gap-3 border-b p-4" onSubmit={addCategory}><label className="min-w-[220px] flex-1 text-xs">Nome da categoria<input required value={categoryName} maxLength={100} onChange={e=>setCategoryName(e.target.value)} className={field+" mt-1"} placeholder="Digite a categoria"/></label><button disabled={busy||!org} className={button+" bg-[#278d53] font-semibold text-white"}>{selectedCategoryId?"Salvar alterações":"+ Cadastrar categoria"}</button>{selectedCategoryId&&<button type="button" className={button} onClick={()=>{setSelectedCategoryId(null);setCategoryName("");}}>Cancelar edição</button>}</form><div className="min-h-0 flex-1 overflow-auto p-3"><table className="w-full border-collapse text-left text-xs"><thead className="sticky top-0 bg-[#e6e6e6]"><tr><th className="w-20 border border-[#cfcfcf] p-2">Nº</th><th className="border border-[#cfcfcf] p-2">Categoria</th><th className="w-28 border border-[#cfcfcf] p-2 text-right">Produtos</th><th className="w-36 border border-[#cfcfcf] p-2 text-center">Ações</th></tr></thead><tbody>{categories.filter(x=>x.name.toLocaleLowerCase("pt-BR").includes(categorySearch.toLocaleLowerCase("pt-BR"))).map((x,i)=><tr key={x.id} tabIndex={0} aria-selected={selectedCategoryId===x.id} onClick={()=>{setSelectedCategoryId(x.id);setCategoryName(x.name);}} onKeyDown={e=>{if(e.key==="Enter"){setSelectedCategoryId(x.id);setCategoryName(x.name);}}} className={"cursor-pointer hover:bg-[#e5f1ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 "+(selectedCategoryId===x.id?"bg-[#dcecff]":"even:bg-[#f4f4f4]")}><td className="border-b px-2 py-2">{String(i+1).padStart(2,"0")}</td><td className="border-b px-2 py-2">{x.name}</td><td className="border-b px-2 py-2 text-right">{products.filter(p=>p.category_id===x.id).length}</td><td className="border-b px-2 py-2 text-center"><button type="button" className="rounded border border-[#aeb5bb] bg-white px-2 py-1 text-[#245d87] hover:bg-[#e6f2ff]" onClick={event=>{event.stopPropagation();setProductCategory(x.id);setQuery("");setProductStatus("all");openPanel("products");}}>Ver produtos</button></td></tr>)}</tbody></table>{categories.filter(x=>x.name.toLocaleLowerCase("pt-BR").includes(categorySearch.toLocaleLowerCase("pt-BR"))).length===0&&<p className="p-4 text-gray-500">Nenhuma categoria encontrada.</p>}</div><div className="border-t bg-[#f1f1f1] px-3 py-2 text-xs text-[#666]">{categories.filter(x=>x.name.toLocaleLowerCase("pt-BR").includes(categorySearch.toLocaleLowerCase("pt-BR"))).length} de {categories.length} categoria(s) • Cadastro central do restaurante</div></div>:<div className="p-6"><h2 className="mb-2 text-base font-semibold">{labels[panel]}</h2><p className="text-sm">Esta função ainda não está integrada ao cadastro real. Nenhuma informação será gravada até a implementação do módulo.</p></div>}
   </>}
   </section>)}
   </div>
  </div>
 </main>;
}
