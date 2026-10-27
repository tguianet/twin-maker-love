type TopTabsProps={active:"principal"|"produtos";embedded?:boolean};
const otherTabs=["MARKETING","FINANCEIRO","RELATÓRIOS","APPS","CONFIGURAÇÕES"];
export function AppTopTabs({active,embedded=false}:TopTabsProps){
 return <header className={(embedded?"hidden ":"")+"shrink-0 bg-[#383838] text-white"}>
  <nav aria-label="Menu principal" className="flex h-9 items-end gap-0 overflow-x-auto px-2 text-[11px]">
   <a href="/" aria-current={active==="principal"?"page":undefined} className={"shrink-0 px-3 py-3 "+(active==="principal"?"rounded-t-sm bg-[#e6e6e6] font-semibold text-[#333]":"hover:bg-[#505050]")}>PRINCIPAL</a>
   <a href="/produtos" aria-current={active==="produtos"?"page":undefined} className={"shrink-0 px-3 py-3 "+(active==="produtos"?"rounded-t-sm bg-[#e6e6e6] font-semibold text-[#333]":"hover:bg-[#505050]")}>PRODUTOS</a>
   {otherTabs.map(label=><span key={label} className="shrink-0 px-3 py-3 text-[#d0d0d0]">{label}</span>)}
   <span className="shrink-0 px-3 py-3 text-[#ccc]">⌕ Pesquisar</span>
  </nav>
 </header>;
}
