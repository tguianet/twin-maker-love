import { useEffect, useState } from "react";

function TrashIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" />
    </svg>
  );
}

export function OrderMoreOptionsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button) return;

      const label = button.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (label.includes("Mais Opções") || label.includes("Mais Opcoes")) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(true);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F12") {
        const tableDialog = document.querySelector('[aria-label^="Mesa/Comanda"]');
        if (tableDialog) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }
        return;
      }

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

  const close = () => setOpen(false);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-[#e5e7eb]/90"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mais opções do pedido"
        className="flex w-[266px] flex-col border border-gray-300 bg-white pb-4 pt-6 font-[Segoe_UI,Tahoma,Geneva,Verdana,sans-serif] shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-5 text-center text-sm text-[#111827]">
          <button type="button" className="w-full px-4 py-1 transition-colors hover:bg-gray-100">
            Trocar para...
          </button>

          <button type="button" className="w-full px-4 py-1 transition-colors hover:bg-gray-100">
            Visualizar Conta Resumida
          </button>

          <button type="button" className="w-full px-4 py-1 leading-6 transition-colors hover:bg-gray-100">
            Transferir/Copiar Itens para Outro Pedido
          </button>

          <button type="button" className="w-full px-4 py-1 leading-6 transition-colors hover:bg-gray-100">
            Imprimir Fichas de Consumação <strong>(1 Item novo)</strong>
          </button>

          <button type="button" className="w-full px-4 py-1 transition-colors hover:bg-gray-100">
            Enviar para WhatsApp
          </button>

          <button type="button" className="w-full px-4 py-1 transition-colors hover:bg-gray-100">
            Recalcular Pedido
          </button>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 px-4 py-1 text-[#a31a1a] transition-colors hover:bg-red-50"
          >
            <TrashIcon />
            <span>Excluir Pedido</span>
          </button>

          <button
            type="button"
            onClick={close}
            className="mt-4 w-full px-4 py-1 transition-colors hover:bg-gray-100"
          >
            Cancelar (ESC)
          </button>
        </div>
      </div>
    </div>
  );
}
