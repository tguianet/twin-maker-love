import { useEffect, useState } from "react";

function PrintIcon() {
  return (
    <svg className="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ReceiptPreviewModal() {
  const [open, setOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState("2");

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button) return;
      const label = button.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (!label.includes("Visualizar Conta Resumida")) return;

      event.preventDefault();
      event.stopPropagation();

      const tableDialog = document.querySelector<HTMLElement>('[aria-label^="Mesa/Comanda"]');
      const dialogLabel = tableDialog?.getAttribute("aria-label") ?? "";
      const match = dialogLabel.match(/Mesa\/Comanda\s+(\d+)/i);
      if (match?.[1]) setTableNumber(match[1]);

      setOpen(true);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(false);
      }
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-[#f0f0f0]/95 p-4">
      <div className="relative flex h-[660px] w-[390px] max-h-[94vh] max-w-[96vw] flex-col overflow-hidden border border-gray-400 bg-[#dcdde1] font-[Inter,Segoe_UI,Tahoma,Geneva,Verdana,sans-serif] shadow-[0_4px_6px_-1px_rgba(0,0,0,.1),0_2px_4px_-1px_rgba(0,0,0,.06),0_0_0_1px_rgba(0,0,0,.1)]">
        <header className="flex h-8 shrink-0 select-none items-center justify-between border-b border-gray-400 bg-gradient-to-b from-[#e8e9ec] to-[#cfd0d5] px-2">
          <span className="text-sm font-medium text-[#1e293b]">Cupom</span>
          <button type="button" aria-label="Fechar" onClick={() => setOpen(false)} className="flex h-6 w-6 items-center justify-center rounded-sm text-gray-600 hover:bg-[#e81123] hover:text-white">×</button>
        </header>

        <main className="relative flex flex-1 flex-col bg-[#f0f0f0]">
          <div className="mx-[2px] mt-[2px] border-b border-gray-300 bg-[#ffe4e1] p-2 text-center text-xs text-[#dc2626]">
            Nenhuma impressora foi selecionada. Para ativar a impressão automática,<br />acesse: 'Configurações &gt; Impressora'.
          </div>

          <div className="relative mx-[2px] mb-[2px] flex flex-1 flex-col overflow-hidden border border-gray-300 bg-white">
            <div className="flex-1 overflow-y-auto p-4 pr-6 font-mono text-xs leading-relaxed text-gray-800">
              <div className="mb-4 text-center">Gerado por Consumer</div>
              <div className="mb-4 text-center">------------------------------------</div>
              <div className="text-center">IMPRESSO EM 29/08/2026 09:54:36</div>
              <div className="text-center">SIMPLES CONFERENCIA DA CONTA</div>
              <div className="text-center">RELATORIO GERENCIAL</div>
              <div className="mb-4 mt-4 text-center">*** NAO E DOCUMENTO FISCAL ***</div>
              <div className="mb-4">ABERTO EM 28/08/2026 01:25</div>
              <div className="text-center">(Pedido N.: 29639)</div>
              <div className="mb-2 text-center">COMANDA {tableNumber}</div>

              <div className="mb-1 flex justify-between font-bold"><span>ITEM</span><span>Total</span></div>
              <div className="mb-2 flex justify-between"><span>1 1 - Brahma 600ml</span><span>9,90</span></div>
              <div className="mb-2">------------------------------------</div>

              <div className="flex justify-between"><span>TOTAL:</span><span>9,90</span></div>
              <div className="flex justify-between"><span>+ SERVICO:</span><span>0,99</span></div>
              <div className="mt-1 flex justify-between font-bold"><span>= TOTAL A PAGAR:</span><span>10,89</span></div>
              <div className="mt-4">Tempo: 1.08h29m</div>
              <div className="mb-4 mt-2">Atendente: Tiago Gonçalves</div>

              <div className="mt-6 text-center">***</div>
              <div className="mt-2 text-center">Participa do nosso Programa de Fidelidade?</div>
              <div className="text-center">Verifique seu Saldo no App.</div>
              <div className="mt-2 text-center">* Obrigado pela Preferencia! *</div>
              <div className="text-center">Volte Sempre!</div>
              <div className="mt-2 text-center">RESTAURANTE CLUBE MEDICO</div>
              <div className="mb-4 mt-4 text-center">------------------------------------</div>
              <div className="text-center">Consumer 15.0.0.8</div>
              <div className="mb-4 mt-6 text-center">------------------------------------</div>
              <div className="text-center">*** Senha ***</div>
              <div className="mt-1 pb-10 text-center text-lg font-bold">29639</div>
            </div>
          </div>
        </main>

        <footer className="mt-auto flex h-16 shrink-0 items-center justify-between bg-[#383a40] px-4">
          <button type="button" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-white hover:text-gray-300">
            <span className="text-2xl text-blue-500">‹</span><span className="text-[15px] font-medium">Sair</span>
          </button>
          <button type="button" onClick={() => window.print()} className="flex items-center gap-3 rounded-sm border border-white bg-transparent px-6 py-2 text-white hover:bg-white/10">
            <PrintIcon /><span className="text-[15px] font-medium">Imprimir</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
