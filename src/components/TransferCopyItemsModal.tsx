import { useEffect, useState } from "react";

export function TransferCopyItemsModal() {
  const [open, setOpen] = useState(false);
  const [sourceTable, setSourceTable] = useState("002");
  const [destination, setDestination] = useState("0");
  const [mode, setMode] = useState<"transfer" | "copy">("transfer");
  const [deleteSource, setDeleteSource] = useState(true);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button) return;
      const label = button.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (!label.includes("Transferir/Copiar Itens para Outro Pedido")) return;

      event.preventDefault();
      event.stopPropagation();

      const tableDialog = document.querySelector<HTMLElement>('[aria-label^="Mesa/Comanda"]');
      const dialogLabel = tableDialog?.getAttribute("aria-label") ?? "";
      const match = dialogLabel.match(/Mesa\/Comanda\s+(\d+)/i);
      if (match?.[1]) setSourceTable(match[1].padStart(3, "0"));
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
    <div className="fixed inset-0 z-[410] flex items-center justify-center bg-transparent p-4 pointer-events-none">
      <div className="pointer-events-auto flex w-[900px] max-w-[96vw] flex-col overflow-hidden rounded border border-[#999] bg-[#e3e3e3] font-[Tahoma,Segoe_UI,Geneva,Verdana,sans-serif] text-[12px] text-[#333] shadow-[2px_2px_5px_rgba(0,0,0,.2)]">
        <div className="flex items-center justify-between border-b border-[#999] bg-gradient-to-b from-[#f0f4f9] to-[#c4d3e5] px-2 py-1 select-none">
          <span className="text-[11px] font-semibold text-gray-700">Transferir ou copiar itens para outra mesa/comanda</span>
          <button type="button" aria-label="Fechar" onClick={() => setOpen(false)} className="rounded-[2px] border border-[#777] bg-gradient-to-b from-[#e3e3e3] to-[#c4c4c4] px-1 text-[10px] hover:border-[#e81123] hover:bg-[#e81123] hover:text-white">X</button>
        </div>

        <div className="flex flex-col gap-4 border border-white border-b-[#a0a0a0] border-r-[#a0a0a0] bg-[#f0f0f0] p-4">
          <div className="grid grid-cols-[1fr_100px_1fr] items-stretch gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex h-8 items-center gap-2">
                <span className="text-[13px]">Itens da mesa/comanda:</span>
                <span className="text-[20px] font-bold text-gray-800">{sourceTable}</span>
              </div>
              <div className="h-[250px] overflow-y-auto border border-[#a0a0a0] bg-white">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="w-12 border-b border-r border-[#ccc] bg-[#f0f0f0] px-1 py-0.5 text-left font-normal">Qtd</th>
                      <th className="border-b border-r border-[#ccc] bg-[#f0f0f0] px-1 py-0.5 text-left font-normal">Produto</th>
                      <th className="w-32 border-b border-[#ccc] bg-[#f0f0f0] px-1 py-0.5 text-right font-normal">Total (incluindo sub itens)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-blue-50/50">
                      <td className="border-b border-[#eee] px-1 py-0.5 text-center font-semibold">1</td>
                      <td className="border-b border-[#eee] px-1 py-0.5">1 - Brahma 600ml</td>
                      <td className="border-b border-[#eee] px-1 py-0.5 text-right">9,90</td>
                    </tr>
                    <tr><td className="px-1 py-0.5">&nbsp;</td><td></td><td></td></tr>
                    <tr><td className="px-1 py-0.5">&nbsp;</td><td></td><td></td></tr>
                  </tbody>
                </table>
              </div>
              <div className="relative mt-1 flex h-8 justify-end">
                <div className="flex w-48 items-center justify-end border border-gray-300 bg-white px-3 py-1 text-[15px]"><span className="text-blue-700">Total: 9,90</span></div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-2">
              <button type="button" disabled className="w-full cursor-default rounded-[3px] border border-[#ccc] bg-[#f0f0f0] py-2 text-center text-[11px] leading-tight text-gray-400">Transferir<br />Tudo &gt;&gt;</button>
              <button type="button" disabled className="w-full cursor-default rounded-[3px] border border-[#ccc] bg-[#f0f0f0] py-2 text-center text-[11px] leading-tight text-gray-400">Transferir<br />Selecionado &gt;</button>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex h-8 items-center justify-end gap-2">
                <label htmlFor="dest-input" className="text-[11px]">Transferir para a mesa/comanda:</label>
                <input id="dest-input" value={destination} onChange={(e) => setDestination(e.target.value)} className="w-16 border border-[#a0a0a0] bg-white px-1 py-0.5 text-right text-[12px] focus:outline-1 focus:outline-[#559bd6]" />
                <button type="button" className="flex items-center gap-1 rounded-[3px] border border-[#a0a0a0] bg-gradient-to-b from-[#f5f5f5] to-[#d8d8d8] px-3 py-1 hover:border-[#7eb4ea] hover:from-[#e8f1fc] hover:to-[#d1e2f2]">🔍 Localizar</button>
              </div>
              <div className="h-[250px] overflow-y-auto border border-[#a0a0a0] bg-white">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="w-12 border-b border-r border-[#ccc] bg-[#f0f0f0] px-1 py-0.5 text-left font-normal">Qtd</th>
                      <th className="border-b border-r border-[#ccc] bg-[#f0f0f0] px-1 py-0.5 text-left font-normal">Produto</th>
                      <th className="w-32 border-b border-[#ccc] bg-[#f0f0f0] px-1 py-0.5 text-right font-normal">Total (incluindo sub itens)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td className="px-1 py-0.5">&nbsp;</td><td></td><td></td></tr>
                    <tr><td className="px-1 py-0.5">&nbsp;</td><td></td><td></td></tr>
                    <tr><td className="px-1 py-0.5">&nbsp;</td><td></td><td></td></tr>
                  </tbody>
                </table>
              </div>
              <div className="relative mt-1 flex h-8 justify-end">
                <div className="flex w-48 items-center justify-end border border-gray-300 bg-white px-3 py-1 text-[15px]"><span className="text-blue-700">Total:</span></div>
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-2 border-t border-gray-300 pt-4">
            <div className="flex items-center gap-6">
              <label className="flex cursor-pointer items-center gap-1"><input type="radio" name="action_type" checked={mode === "transfer"} onChange={() => setMode("transfer")} className="h-3 w-3" /><span>Transferir item(s)</span></label>
              <label className="flex cursor-pointer items-center gap-1"><input type="radio" name="action_type" checked={mode === "copy"} onChange={() => setMode("copy")} className="h-3 w-3" /><span>Copiar item(s)</span></label>
            </div>
            <label className="mt-1 flex w-fit cursor-pointer items-center gap-1"><input type="checkbox" checked={deleteSource} onChange={(e) => setDeleteSource(e.target.checked)} className="h-3 w-3 rounded-sm" /><span>Excluir pedido de origem se transferir todos os itens</span></label>
            <p className="mt-1 text-[10px] text-gray-500">*Ao transferir um item, seu pagamento vinculado (se existir) também será transferido. Ao tranferir todos os itens, todos pagamentos serão transferidos.</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-6 rounded-b border-t border-gray-300 bg-[#f0f0f0] p-3">
          <button type="button" onClick={() => setOpen(false)} className="flex items-center gap-2 text-[13px] font-semibold text-black hover:text-blue-700"><span className="text-xl text-blue-500">‹</span>Voltar</button>
          <button type="button" className="flex items-center gap-2 text-[13px] font-semibold text-black hover:text-green-700"><span className="text-lg text-gray-400">✓</span>Confirmar</button>
        </div>
      </div>
    </div>
  );
}
