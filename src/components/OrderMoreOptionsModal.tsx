import { useEffect, useState } from "react";

function TrashIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg className="h-8 w-8 text-[#2f6fa8]" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 11h20v8H6zM9 19v7M23 19v7M10 8h12" />
    </svg>
  );
}

function CounterIcon() {
  return (
    <svg className="h-8 w-8 text-[#2f6fa8]" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 10h22M7 10v14h18V10M10 15h12M10 20h12" />
    </svg>
  );
}

function RegisterIcon() {
  return (
    <svg className="h-8 w-8 text-[#888]" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="7" y="9" width="18" height="14" rx="2" />
      <path d="M10 13h12M10 17h7M11 25h10" />
    </svg>
  );
}

function DeliveryIcon() {
  return (
    <svg className="h-8 w-8 text-[#2f6fa8]" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 20h14V10H6zM20 14h4l3 4v2h-7z" />
      <circle cx="11" cy="23" r="2" />
      <circle cx="24" cy="23" r="2" />
    </svg>
  );
}

type PopupPosition = { left: number; top: number };

const tables = Array.from({ length: 12 }, (_, index) => index + 1);

export function OrderMoreOptionsModal() {
  const [open, setOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [tableSelectOpen, setTableSelectOpen] = useState(false);
  const [position, setPosition] = useState<PopupPosition>({ left: 0, top: 0 });
  const [currentTable, setCurrentTable] = useState("3");

  const syncPosition = () => {
    const tableDialog = document.querySelector<HTMLElement>('[aria-label^="Mesa/Comanda"]');
    if (!tableDialog) return;
    const rect = tableDialog.getBoundingClientRect();
    setPosition({ left: rect.left + 16, top: rect.top + 84 });

    const label = tableDialog.getAttribute("aria-label") ?? "";
    const match = label.match(/Mesa\/Comanda\s+(\d+)/i);
    if (match?.[1]) setCurrentTable(match[1]);
  };

  const show = () => {
    syncPosition();
    setSwapOpen(false);
    setTableSelectOpen(false);
    setOpen(true);
  };

  const close = () => {
    setTableSelectOpen(false);
    setSwapOpen(false);
    setOpen(false);
  };

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button) return;
      const label = button.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (label.includes("Mais Opções") || label.includes("Mais Opcoes")) {
        event.preventDefault();
        event.stopPropagation();
        show();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F12") {
        const tableDialog = document.querySelector('[aria-label^="Mesa/Comanda"]');
        if (tableDialog) {
          event.preventDefault();
          event.stopPropagation();
          show();
        }
        return;
      }

      if (event.key === "Escape") {
        if (tableSelectOpen) {
          event.preventDefault();
          event.stopImmediatePropagation();
          setTableSelectOpen(false);
          setSwapOpen(true);
          return;
        }
        if (swapOpen) {
          event.preventDefault();
          event.stopImmediatePropagation();
          setSwapOpen(false);
          setOpen(true);
          return;
        }
        if (open) {
          event.preventDefault();
          event.stopImmediatePropagation();
          close();
        }
      }
    };

    const handleResize = () => {
      if (open || swapOpen || tableSelectOpen) syncPosition();
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open, swapOpen, tableSelectOpen]);

  if (!open && !swapOpen && !tableSelectOpen) return null;

  return (
    <div className="fixed inset-0 z-[299] bg-transparent" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      {open && !swapOpen && !tableSelectOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Mais opções do pedido"
          style={{ left: position.left, top: position.top }}
          className="fixed z-[300] flex w-[266px] flex-col border border-gray-300 bg-white pb-4 pt-6 font-[Segoe_UI,Tahoma,Geneva,Verdana,sans-serif] shadow-[0_10px_28px_rgba(0,0,0,0.28)]"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="flex flex-col gap-5 text-center text-[12px] text-[#111827]">
            <button
              type="button"
              onClick={() => {
                syncPosition();
                setOpen(false);
                setSwapOpen(true);
              }}
              className="w-full px-4 py-1 transition-colors hover:bg-gray-100"
            >
              Trocar para...
            </button>
            <button type="button" className="w-full px-4 py-1 transition-colors hover:bg-gray-100">Visualizar Conta Resumida</button>
            <button type="button" className="w-full px-4 py-1 leading-5 transition-colors hover:bg-gray-100">Transferir/Copiar Itens para Outro Pedido</button>
            <button type="button" className="w-full px-4 py-1 leading-5 transition-colors hover:bg-gray-100">Imprimir Fichas de Consumação <strong>(1 Item novo)</strong></button>
            <button type="button" className="w-full px-4 py-1 transition-colors hover:bg-gray-100">Enviar para WhatsApp</button>
            <button type="button" className="w-full px-4 py-1 transition-colors hover:bg-gray-100">Recalcular Pedido</button>
            <button type="button" className="flex w-full items-center justify-center gap-2 px-4 py-1 text-[#b91c1c] transition-colors hover:bg-red-50"><TrashIcon /><span>Excluir Pedido</span></button>
            <button type="button" onClick={close} className="mt-3 w-full px-4 py-1 transition-colors hover:bg-gray-100">Cancelar (ESC)</button>
          </div>
        </div>
      )}

      {swapOpen && !tableSelectOpen && (
        <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/10" onMouseDown={(event) => event.target === event.currentTarget && setSwapOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Trocar pedido para"
            className="w-[606px] max-w-[94vw] overflow-hidden rounded-[4px] border border-[#a0a0a0] bg-white font-[Segoe_UI,Tahoma,Geneva,Verdana,sans-serif] shadow-[2px_2px_5px_rgba(0,0,0,0.3)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#b0b0b0] bg-gradient-to-b from-[#eaeaea] to-[#d4d4d4] px-[10px] py-[6px]">
              <div className="text-[14px] font-semibold text-[#555]">Trocar pedido para...</div>
              <button type="button" aria-label="Fechar" onClick={() => { setSwapOpen(false); setOpen(true); }} className="flex h-5 w-6 items-center justify-center rounded-[2px] border border-[#a0a0a0] bg-gradient-to-b from-[#e0e0e0] to-[#c0c0c0] text-[12px] text-[#555] hover:border-[#e81123] hover:bg-[#e81123] hover:text-white">X</button>
            </div>

            <div className="p-5">
              <div className="mb-[30px] grid grid-cols-2 gap-[15px]">
                <button
                  type="button"
                  onClick={() => {
                    setSwapOpen(false);
                    setTableSelectOpen(true);
                  }}
                  className="flex min-h-[60px] items-center gap-[15px] rounded-[4px] border border-[#bcbcbc] bg-gradient-to-b from-[#fcfcfc] to-[#e6e6e6] px-[15px] py-[10px] text-left shadow-[inset_0_1px_0_rgba(255,255,255,.8),0_1px_2px_rgba(0,0,0,.05)] hover:border-[#78aee5] hover:from-[#f0f8ff] hover:to-[#dcf0ff]"
                >
                  <TableIcon />
                  <span className="text-[14px] font-semibold text-[#333]">Outra Mesa/Comanda (Atual: {currentTable})</span>
                </button>

                <button type="button" className="flex min-h-[60px] items-center gap-[15px] rounded-[4px] border border-[#bcbcbc] bg-gradient-to-b from-[#fcfcfc] to-[#e6e6e6] px-[15px] py-[10px] text-left shadow-[inset_0_1px_0_rgba(255,255,255,.8),0_1px_2px_rgba(0,0,0,.05)] hover:border-[#78aee5] hover:from-[#f0f8ff] hover:to-[#dcf0ff]">
                  <CounterIcon />
                  <span className="text-[14px] font-semibold text-[#333]">Balcão</span>
                </button>

                <button type="button" disabled className="flex min-h-[60px] cursor-default items-center gap-[15px] rounded-[4px] border border-[#ccc] bg-gradient-to-b from-[#f0f0f0] to-[#e0e0e0] px-[15px] py-[10px] text-left text-[#999]">
                  <RegisterIcon />
                  <span className="text-[14px] font-semibold text-[#a0a0a0]">Pedido no Caixa</span>
                </button>

                <button type="button" className="flex min-h-[60px] items-center gap-[15px] rounded-[4px] border border-[#bcbcbc] bg-gradient-to-b from-[#fcfcfc] to-[#e6e6e6] px-[15px] py-[10px] text-left shadow-[inset_0_1px_0_rgba(255,255,255,.8),0_1px_2px_rgba(0,0,0,.05)] hover:border-[#78aee5] hover:from-[#f0f8ff] hover:to-[#dcf0ff]">
                  <DeliveryIcon />
                  <span className="text-[14px] font-semibold text-[#333]">Delivery</span>
                </button>
              </div>

              <div className="flex justify-end pt-[10px]">
                <button type="button" onClick={() => { setSwapOpen(false); setOpen(true); }} className="flex items-center gap-2 bg-transparent px-[10px] py-[5px] text-[14px] font-bold text-black hover:underline">
                  <span className="text-[20px] font-bold text-[#0078d7]">‹</span>
                  <span>Voltar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tableSelectOpen && (
        <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/10" onMouseDown={(event) => event.target === event.currentTarget && setTableSelectOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Trocar Mesa/Comanda"
            className="flex h-[600px] w-[896px] max-h-[92vh] max-w-[96vw] flex-col overflow-hidden rounded-sm border border-gray-400 bg-white font-[Segoe_UI,Tahoma,Geneva,Verdana,sans-serif] shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex h-[30px] shrink-0 items-center justify-between border-b border-gray-300 bg-[#e1e1e1] px-3">
              <div className="text-sm font-semibold text-gray-700">Trocar Mesa/Comanda</div>
              <div className="flex gap-1">
                <button type="button" className="flex h-5 w-7 items-center justify-center text-xs text-gray-600 hover:bg-gray-300">−</button>
                <button type="button" className="flex h-5 w-7 items-center justify-center text-xs text-gray-600 hover:bg-gray-300">□</button>
                <button type="button" onClick={() => { setTableSelectOpen(false); setSwapOpen(true); }} className="flex h-5 w-7 items-center justify-center text-xs text-gray-600 hover:bg-red-500 hover:text-white">×</button>
              </div>
            </div>

            <div className="relative flex flex-1 flex-col bg-[#393939] p-8">
              <h2 className="mb-10 text-center text-xl text-white">Selecione a mesa ou comanda para abrir:</h2>

              <div className="grid grid-cols-10 gap-x-2 gap-y-8 px-10">
                {tables.map((table) => {
                  const tableNumber = String(table).padStart(2, "0");
                  const unavailable = table === 1 || tableNumber === currentTable.padStart(2, "0");
                  const highlighted = table === 1;

                  return (
                    <button
                      key={table}
                      type="button"
                      disabled={unavailable}
                      className={`flex w-20 flex-col items-center justify-center rounded p-2 ${highlighted ? "bg-[#e6e6fa]" : ""} ${unavailable ? "cursor-default" : "cursor-pointer hover:bg-white/5"}`}
                    >
                      {unavailable ? (
                        <div className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#666]">
                          <div className="absolute h-[2px] w-full -rotate-45 bg-[#666]" />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2ecc71] text-2xl font-bold text-white">✓</div>
                      )}
                      <span className={`mt-2 font-semibold ${highlighted ? "text-[#2c3e50]" : "text-white"}`}>{tableNumber}</span>
                    </button>
                  );
                })}
              </div>

              <div className="absolute bottom-8 right-8">
                <button type="button" onClick={() => { setTableSelectOpen(false); setSwapOpen(true); }} className="flex items-center text-white hover:text-gray-300">
                  <span className="mr-2 text-xl font-bold text-blue-500">‹</span>
                  <span className="text-lg font-semibold">Voltar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
