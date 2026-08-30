import { useEffect, useState } from "react";

type ModalPosition = { left: number; top: number };

type ConsumptionReceiptEvent = CustomEvent<{ tableNumber?: string }>;

function PrintIcon() {
  return (
    <svg className="h-5 w-5 text-[#5599ff]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ReceiptPreviewModal() {
  const [open, setOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState("2");
  const [position, setPosition] = useState<ModalPosition>({ left: 420, top: 28 });

  const syncPosition = () => {
    const tableDialog = document.querySelector<HTMLElement>('[aria-label^="Mesa/Comanda"]');
    if (!tableDialog) return;

    const rect = tableDialog.getBoundingClientRect();
    const modalWidth = 420;
    const modalHeight = Math.min(720, window.innerHeight - 24);
    const preferredLeft = rect.left + rect.width * 0.58;
    const maxLeft = window.innerWidth - modalWidth - 12;
    const preferredTop = Math.max(12, rect.top - 22);
    const maxTop = Math.max(12, window.innerHeight - modalHeight - 12);

    setPosition({
      left: Math.max(12, Math.min(preferredLeft, maxLeft)),
      top: Math.min(preferredTop, maxTop),
    });
  };

  const resolveCurrentTable = () => {
    const tableDialog = document.querySelector<HTMLElement>('[aria-label^="Mesa/Comanda"]');
    const dialogLabel = tableDialog?.getAttribute("aria-label") ?? "";
    const match = dialogLabel.match(/Mesa\/Comanda\s+(\d+)/i);
    if (match?.[1]) setTableNumber(match[1]);
  };

  const showReceipt = (forcedTableNumber?: string) => {
    if (forcedTableNumber) setTableNumber(forcedTableNumber);
    else resolveCurrentTable();
    syncPosition();
    setOpen(true);
  };

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button) return;
      const label = button.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (!label.includes("Visualizar Conta Resumida")) return;

      event.preventDefault();
      event.stopPropagation();
      showReceipt();
    };

    const handleConsumptionReceipt = (event: Event) => {
      const customEvent = event as ConsumptionReceiptEvent;
      showReceipt(customEvent.detail?.tableNumber);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(false);
      }
    };

    const handleResize = () => {
      if (open) syncPosition();
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("tguia:open-consumption-receipt", handleConsumptionReceipt as EventListener);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("tguia:open-consumption-receipt", handleConsumptionReceipt as EventListener);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[400] bg-transparent">
      <div
        style={{ left: position.left, top: position.top }}
        className="pointer-events-auto fixed flex h-[720px] max-h-[calc(100vh-24px)] w-[420px] max-w-[calc(100vw-24px)] flex-col overflow-hidden border border-[#999] bg-white font-[Tahoma,Geneva,sans-serif] shadow-[0_10px_30px_rgba(0,0,0,.5)]"
      >
        <div className="flex h-8 shrink-0 items-center justify-between border-b border-[#a0a0a0] bg-gradient-to-b from-[#d4d4d4] to-[#c4c4c4] px-2 text-sm text-[#333]">
          <span className="font-semibold text-gray-800">Cupom</span>
          <button type="button" aria-label="Fechar" onClick={() => setOpen(false)} className="flex h-5 w-5 items-center justify-center rounded-sm border border-[#a0a0a0] bg-[#d0d0d0] text-gray-700 hover:bg-[#e0e0e0] hover:text-black">×</button>
        </div>

        <div className="border-b border-red-200 bg-[#ffebeb] p-2 text-center text-xs text-[#cc0000]">
          Nenhuma impressora foi selecionada. Para ativar a impressão automática,<br />acesse: 'Configurações &gt; Impressora'.
        </div>

        <div className="flex-1 overflow-y-auto bg-white p-4 pb-0 font-mono text-xs text-gray-800">
          <div className="mb-4 border-t border-dashed border-[#333]" />

          <div className="mb-6 text-center leading-tight">
            <div className="mb-1">1 Cervejas</div>
            <div className="mb-1">Vale 1</div>
            <div className="mb-1">1 - BRAHMA 600ML</div>
            <div className="text-gray-600">[Ped.: 29588 30/08 00:05]</div>
          </div>

          <div className="my-4 border-t border-dashed border-[#333]" />

          <div className="mb-6 text-center leading-tight">
            <div className="mb-1">1 Cervejas</div>
            <div className="mb-1">Vale 1</div>
            <div className="mb-1">1 - BRAHMA 600ML</div>
            <div className="text-gray-600">[Ped.: 29588 30/08 00:05]</div>
          </div>

          <div className="my-4 border-t border-dashed border-[#333]" />

          <div className="mb-6 text-center leading-tight">
            <div className="mb-1">1 Cervejas</div>
            <div className="mb-1">Vale 1</div>
            <div className="mb-1">HEINEKEN ZERO</div>
            <div className="text-gray-600">[Ped.: 29588 30/08 00:05]</div>
          </div>

          <div className="my-4 border-t border-dashed border-[#333]" />

          <div className="mb-6 text-center leading-tight">
            <div className="mb-1">4 File Mignon</div>
            <div className="mb-1">Vale 1</div>
            <div className="mb-1">FILE A CAVALO</div>
            <div className="text-gray-600">[Ped.: 29588 30/08 00:05]</div>
          </div>

          <div className="mt-8 text-center text-gray-500">Comanda {tableNumber}</div>
        </div>

        <div className="mt-auto flex h-14 shrink-0 items-center justify-between border-t border-[#222] bg-[#3d3d3d] px-4">
          <button type="button" onClick={() => setOpen(false)} className="ml-20 flex items-center text-[#5599ff] transition-colors hover:text-white">
            <span className="mr-1 text-2xl">‹</span>
            <span className="text-sm font-semibold text-white">Sair</span>
          </button>
          <button type="button" onClick={() => window.print()} className="mr-2 flex items-center rounded border border-gray-400 bg-transparent px-4 py-1.5 transition-colors hover:bg-[#555]">
            <PrintIcon />
            <span className="ml-2 text-sm font-semibold text-white">Imprimir</span>
          </button>
        </div>
      </div>
    </div>
  );
}
