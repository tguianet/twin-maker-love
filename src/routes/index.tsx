import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TGuia Food - Sistema de Mesas e Comandas" },
      {
        name: "description",
        content:
          "Sistema TGuia Food: controle de caixa, mesas, comandas, pedidos delivery e balcão em uma única tela.",
      },
      { property: "og:title", content: "TGuia Food - Sistema de Mesas e Comandas" },
      {
        property: "og:description",
        content:
          "Painel do TGuia Food com pedidos em andamento, mesas livres e atalhos de caixa e vendas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const TABLE_STATE_KEY = "tguia-food-table-closing-state";
const allFreeTables = Array.from({ length: 85 }, (_, i) => String(i + 2).padStart(2, "0"));

const icon = (path: string, className: string) => (
  <svg className={`mb-1 h-8 w-8 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d={path} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
  </svg>
);

function LockIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 10V7a5 5 0 0110 0v3h1a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8a2 2 0 012-2h1zm2 0h6V7a3 3 0 00-6 0v3z" />
    </svg>
  );
}

function RibbonButton({ width, children, svg }: { width: string; children: React.ReactNode; svg: React.ReactNode }) {
  return (
    <button className={`ribbon-button flex flex-col items-center justify-start rounded-sm border border-transparent p-1 ${width}`}>
      {svg}
      <span className="leading-tight">{children}</span>
    </button>
  );
}

function readTableStates(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(TABLE_STATE_KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

function Index() {
  const [tableStates, setTableStates] = useState<Record<string, boolean>>(() => readTableStates());

  useEffect(() => {
    const refresh = () => setTableStates(readTableStates());
    window.addEventListener("tguia:table-state-change", refresh as EventListener);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("tguia:table-state-change", refresh as EventListener);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const closingTables = useMemo(
    () => allFreeTables.filter((table) => Boolean(tableStates[table])),
    [tableStates],
  );

  const freeTables = useMemo(
    () => allFreeTables.filter((table) => !tableStates[table]),
    [tableStates],
  );

  const ongoingCount = 1 + closingTables.length;

  return (
    <div className="relative mx-auto flex h-[1080px] w-[1920px] select-none flex-col bg-background text-app-text">
      <header className="flex h-8 items-center justify-between border-b border-app-border bg-app-chrome px-2 text-xs">
        <div className="flex space-x-1">
          <button className="translate-y-[1px] border-b-background border-l border-r border-t border-app-border bg-background px-3 py-1 font-semibold text-app-blue">PRINCIPAL</button>
          {["PRODUTOS", "FINANCEIRO", "CONFIGURAÇÕES", "APPS"].map((t) => (
            <button key={t} className="px-3 py-1 text-app-muted hover:bg-app-chrome-hover">{t}</button>
          ))}
        </div>
        <div className="flex space-x-0">
          <button className="flex h-8 w-8 items-center justify-center text-app-muted hover:bg-app-chrome-hover">_</button>
          <button className="flex h-8 w-8 items-center justify-center text-app-muted hover:bg-app-chrome-hover">□</button>
          <button className="flex h-8 w-8 items-center justify-center text-app-muted hover:bg-app-close hover:text-app-on-dark">✕</button>
        </div>
      </header>

      <nav className="flex h-[88px] items-stretch border-b border-app-border bg-app-ribbon text-center text-xs">
        <div className="relative flex min-w-[130px] items-stretch border-r border-app-border px-1 pb-1 pt-1">
          <div className="flex w-full justify-center space-x-1">
            <RibbonButton width="w-20" svg={icon("M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10", "text-app-icon-blue")}>Abrir / Fechar<br />Meu Caixa</RibbonButton>
            <RibbonButton width="w-20" svg={icon("M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", "text-app-icon-navy")}>Histórico<br />do Caixa</RibbonButton>
          </div>
          <div className="absolute bottom-0 left-0 w-full pb-0.5 text-center text-[10px] text-app-muted">Caixa</div>
        </div>

        <div className="relative flex items-stretch border-r border-app-border px-1 pb-1 pt-1">
          <div className="flex w-full justify-center space-x-1">
            <RibbonButton width="w-24" svg={icon("M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", "text-app-icon-yellow")}>Mesas / Comandas<br /><span className="font-semibold">(F3)</span></RibbonButton>
            <RibbonButton width="w-24" svg={icon("M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z", "text-app-icon-red")}>Pedidos Delivery<br /><span className="font-semibold">(F4)</span></RibbonButton>
            <RibbonButton width="w-24" svg={icon("M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", "text-app-icon-green")}>Pedido no Caixa<br /><span className="font-semibold">(F5)</span></RibbonButton>
            <RibbonButton width="w-20" svg={icon("M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9", "text-app-icon-sky")}>Cardápio<br />Online</RibbonButton>
          </div>
          <div className="absolute bottom-0 left-0 w-full pb-0.5 text-center text-[10px] text-app-muted">Vendas</div>
        </div>
      </nav>

      <div className="flex h-12 shrink-0 items-center justify-between border-b border-app-border bg-background px-4 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
              <svg className="h-4 w-4 text-app-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
            </div>
            <input type="text" placeholder="Buscar número ou nome..." className="w-64 rounded-sm border border-app-line bg-app-field py-1 pl-8 pr-2 text-sm focus:border-app-icon-sky focus:outline-none focus:ring-1 focus:ring-app-icon-sky" />
          </div>
          <button className="flex items-center space-x-1 rounded p-1 text-sm font-semibold hover:bg-app-hover"><span>Juntar Pedidos</span></button>
        </div>
        <div className="flex items-center space-x-6">
          <button className="flex items-center space-x-1 rounded p-1 text-sm font-semibold hover:bg-app-hover"><span>Atualizar</span></button>
          <button className="flex items-center space-x-1 rounded p-1 text-sm font-semibold hover:bg-app-hover"><span>Iniciar Pedido Balcão (F6)</span></button>
        </div>
      </div>

      <main className="app-scrollbar-hide flex flex-1 flex-col overflow-y-auto bg-background p-6">
        <section className="mb-6">
          <h1 className="mb-4 text-sm font-bold text-app-text">Pedidos em Andamento ({ongoingCount} de {ongoingCount})</h1>
          <div className="flex flex-wrap gap-4">
            <div className="table-box-active flex h-24 w-24 cursor-pointer flex-col items-center justify-center text-app-on-dark transition-colors">
              <span className="text-3xl font-bold">01</span>
              <span className="mt-1 text-xs uppercase">marcos</span>
            </div>

            {closingTables.map((table) => (
              <div
                key={table}
                className="table-box-active relative flex h-24 w-24 cursor-pointer flex-col items-center justify-center text-black transition-colors"
                style={{ backgroundColor: "#e5ad1d" }}
                title={`Mesa ${table} - Em Fechamento`}
              >
                <span className="absolute left-2 top-2"><LockIcon /></span>
                <span className="text-3xl font-bold text-white">{table}</span>
                <span className="mt-1 text-[10px] font-bold uppercase text-black">Em Fechamento</span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex-1">
          <h2 className="mb-4 text-sm font-bold text-app-text">Mesas / Comandas Livres</h2>
          <div className="app-grid">
            {freeTables.map((n) => (
              <div key={n} className="table-box flex h-[88px] flex-col justify-start pt-1 text-center text-app-on-dark">
                <span className="text-[9px]">ABRIR</span>
                <span className="mt-2 text-2xl font-bold">{n}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-10 flex h-10 shrink-0 items-center justify-between border-t border-app-border bg-app-chrome px-2 text-xs">
        <div className="flex items-center space-x-2"><div className="h-4 w-8 border border-app-border bg-app-field" /><span className="text-app-text">Exibir Total da Conta e Duração</span></div>
        <div className="absolute bottom-0 left-0 flex h-5 w-full items-center bg-app-status px-2 text-[11px]"><span className="text-app-text">Usuário: <span className="font-bold">Tiago Gonçalves</span> <a className="text-app-blue underline" href="#">administrador</a> ***Não Registrado***</span></div>
      </footer>
    </div>
  );
}
