import { createFileRoute } from "@tanstack/react-router";

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

const freeTables = Array.from({ length: 85 }, (_, i) =>
  String(i + 2).padStart(2, "0"),
);

const icon = (path: string, className: string) => (
  <svg
    className={`mb-1 h-8 w-8 ${className}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      d={path}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    />
  </svg>
);

function RibbonButton({
  width,
  children,
  svg,
}: {
  width: string;
  children: React.ReactNode;
  svg: React.ReactNode;
}) {
  return (
    <button
      className={`ribbon-button flex flex-col items-center justify-start rounded-sm border border-transparent p-1 ${width}`}
    >
      {svg}
      <span className="leading-tight">{children}</span>
    </button>
  );
}

function Index() {
  return (
    <div className="relative mx-auto flex h-[1080px] w-[1920px] select-none flex-col bg-background text-app-text">
      {/* Header & window controls */}
      <header className="flex h-8 items-center justify-between border-b border-app-border bg-app-chrome px-2 text-xs">
        <div className="flex space-x-1">
          <button className="translate-y-[1px] border-b-background border-l border-r border-t border-app-border bg-background px-3 py-1 font-semibold text-app-blue">
            PRINCIPAL
          </button>
          {["PRODUTOS", "FINANCEIRO", "CONFIGURAÇÕES", "APPS"].map((t) => (
            <button
              key={t}
              className="px-3 py-1 text-app-muted hover:bg-app-chrome-hover"
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex space-x-0">
          <button className="flex h-8 w-8 items-center justify-center text-app-muted hover:bg-app-chrome-hover">
            _
          </button>
          <button className="flex h-8 w-8 items-center justify-center text-app-muted hover:bg-app-chrome-hover">
            □
          </button>
          <button className="flex h-8 w-8 items-center justify-center text-app-muted hover:bg-app-close hover:text-app-on-dark">
            ✕
          </button>
        </div>
      </header>

      {/* Ribbon */}
      <nav className="flex h-[88px] items-stretch border-b border-app-border bg-app-ribbon text-center text-xs">
        <div className="relative flex min-w-[130px] items-stretch border-r border-app-border px-1 pb-1 pt-1">
          <div className="flex w-full justify-center space-x-1">
            <RibbonButton
              width="w-20"
              svg={icon(
                "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
                "text-app-icon-blue",
              )}
            >
              Abrir / Fechar
              <br />
              Meu Caixa
            </RibbonButton>
            <RibbonButton
              width="w-20"
              svg={icon(
                "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
                "text-app-icon-navy",
              )}
            >
              Histórico
              <br />
              do Caixa
            </RibbonButton>
          </div>
          <div className="absolute bottom-0 left-0 w-full pb-0.5 text-center text-[10px] text-app-muted">
            Caixa
          </div>
        </div>

        <div className="relative flex items-stretch border-r border-app-border px-1 pb-1 pt-1">
          <div className="flex w-full justify-center space-x-1">
            <RibbonButton
              width="w-24"
              svg={icon(
                "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
                "text-app-icon-yellow",
              )}
            >
              Mesas / Comandas
              <br />
              <span className="font-semibold">(F3)</span>
            </RibbonButton>
            <RibbonButton
              width="w-24"
              svg={icon(
                "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z",
                "text-app-icon-red",
              )}
            >
              Pedidos Delivery
              <br />
              <span className="font-semibold">(F4)</span>
            </RibbonButton>
            <RibbonButton
              width="w-24"
              svg={icon(
                "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
                "text-app-icon-green",
              )}
            >
              Pedido no Caixa
              <br />
              <span className="font-semibold">(F5)</span>
            </RibbonButton>
            <RibbonButton
              width="w-20"
              svg={icon(
                "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
                "text-app-icon-sky",
              )}
            >
              Cardápio
              <br />
              Online
            </RibbonButton>
          </div>
          <div className="absolute bottom-0 left-0 w-full pb-0.5 text-center text-[10px] text-app-muted">
            Vendas
          </div>
        </div>

        <div className="relative flex items-stretch border-r border-app-border px-1 pb-1 pt-1">
          <div className="flex w-full justify-center space-x-1">
            <button className="ribbon-button flex w-20 flex-col items-center justify-start rounded-sm border border-transparent p-1">
              {icon(
                "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
                "text-app-icon-green-dark",
              )}
              <span className="mt-1 leading-tight">
                Clientes
                <br />
                <span className="font-semibold">(F11)</span>
              </span>
            </button>
          </div>
          <div className="absolute bottom-0 left-0 w-full pb-0.5 text-center text-[10px] text-app-muted">
            Clientes
          </div>
        </div>

        <div className="flex items-stretch border-r border-app-border px-1 pb-1 pt-1">
          <button className="ribbon-button flex w-20 flex-col items-center justify-start rounded-sm border border-transparent p-1">
            <svg
              className="mb-1 h-8 w-8 text-app-icon-yellow"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                clipRule="evenodd"
                fillRule="evenodd"
                d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8l-3.354-1.935a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z"
              />
            </svg>
            <span className="mt-1 leading-tight">Mais Vendidos</span>
          </button>
          <button className="ribbon-button flex w-20 flex-col items-center justify-start rounded-sm border border-transparent p-1">
            {icon(
              "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
              "text-app-icon-navy",
            )}
            <span className="mt-1 leading-tight">
              Histórico
              <br />
              de Pedidos
            </span>
          </button>
          <button className="ribbon-button flex w-24 flex-col items-center justify-start rounded-sm border border-transparent p-1">
            {icon(
              "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
              "text-app-icon-gray",
            )}
            <span className="mt-1 leading-tight">
              Ranking de
              <br />
              Atendimentos
            </span>
          </button>
          <button className="ribbon-button flex w-24 flex-col items-center justify-start rounded-sm border border-transparent p-1">
            {icon(
              "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
              "text-app-icon-gold",
            )}
            <span className="mt-1 leading-tight">
              Bloquear ou
              <br />
              Trocar Usuário
            </span>
          </button>
          <button className="ribbon-button flex w-16 flex-col items-center justify-start rounded-sm border border-transparent p-1">
            {icon(
              "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
              "text-app-icon-orange",
            )}
            <span className="mt-1 leading-tight">Sair</span>
          </button>
        </div>
      </nav>

      {/* Action bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-app-border bg-background px-4 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
              <svg
                className="h-4 w-4 text-app-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Buscar número ou nome..."
              className="w-64 rounded-sm border border-app-line bg-app-field py-1 pl-8 pr-2 text-sm focus:border-app-icon-sky focus:outline-none focus:ring-1 focus:ring-app-icon-sky"
            />
          </div>
          <button className="flex items-center space-x-1 rounded p-1 text-sm font-semibold hover:bg-app-hover">
            <svg
              className="h-5 w-5 text-app-icon-blue"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
            <span>Juntar Pedidos</span>
          </button>
        </div>
        <div className="flex items-center space-x-6">
          <button className="flex items-center space-x-1 rounded p-1 text-sm font-semibold hover:bg-app-hover">
            <svg
              className="h-5 w-5 text-app-icon-blue"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
            <span>Atualizar</span>
          </button>
          <button className="flex items-center space-x-1 rounded p-1 text-sm font-semibold hover:bg-app-hover">
            <svg
              className="h-5 w-5 text-app-icon-blue"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M12 4v16m8-8H4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
            <span>Iniciar Pedido Balcão (F6)</span>
          </button>
        </div>
      </div>

      {/* Main */}
      <main className="app-scrollbar-hide flex flex-1 flex-col overflow-y-auto bg-background p-6">
        <section className="mb-6">
          <h1 className="mb-4 text-sm font-bold text-app-text">
            Pedidos em Andamento (1 de 1)
          </h1>
          <div className="flex space-x-4">
            <div className="table-box-active flex h-24 w-24 cursor-pointer flex-col items-center justify-center text-app-on-dark transition-colors">
              <span className="text-3xl font-bold">01</span>
              <span className="mt-1 text-xs uppercase">marcos</span>
            </div>
          </div>
        </section>

        <section className="flex-1">
          <h2 className="mb-4 text-sm font-bold text-app-text">
            Mesas / Comandas Livres
          </h2>
          <div className="app-grid">
            {freeTables.map((n) => (
              <div
                key={n}
                className="table-box flex h-[88px] flex-col justify-start pt-1 text-center text-app-on-dark"
              >
                <span className="text-[9px]">ABRIR</span>
                <span className="mt-2 text-2xl font-bold">{n}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 flex h-10 shrink-0 items-center justify-between border-t border-app-border bg-app-chrome px-2 text-xs">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="h-4 w-8 border border-app-border bg-app-field" />
            <span className="text-app-text">Exibir Total da Conta e Duração</span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-app-text">Ajustar Tamanho:</span>
            <div className="relative flex h-4 w-24 items-center">
              <div className="absolute h-[1px] w-full bg-app-border" />
              <div className="absolute flex w-full justify-between px-[2px]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-2 w-[1px] bg-app-border" />
                ))}
              </div>
              <div className="absolute right-[10%] h-4 w-2 rounded-[1px] border border-app-border bg-app-field shadow-sm" />
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 flex h-5 w-full items-center bg-app-status px-2 text-[11px]">
          <span className="text-app-text">
            Usuário: <span className="font-bold">Tiago Gonçalves</span>{" "}
            <a className="text-app-blue underline" href="#">
              administrador
            </a>
            {"     "}***Não Registrado***
          </span>
        </div>
      </footer>
    </div>
  );
}
