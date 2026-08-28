import { useEffect, useMemo, useState } from "react";
import { ProductLocatorModal, type OrderProduct } from "./ProductLocatorModal";

type SelectedTable = {
  number: string;
  occupied: boolean;
};

type OrderItem = OrderProduct & { quantity: number };

function ActionIcon({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-6 w-6 items-center justify-center text-[20px]">{children}</span>;
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function TableOrderModal() {
  const [selectedTable, setSelectedTable] = useState<SelectedTable | null>(null);
  const [productsOpen, setProductsOpen] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const table = target?.closest<HTMLElement>(".table-box, .table-box-active");
      if (!table) return;

      const spans = Array.from(table.querySelectorAll("span"));
      const number = spans.map((span) => span.textContent?.trim() ?? "").find((text) => /^\d{1,3}$/.test(text));
      if (!number) return;

      setSelectedTable({ number: number.padStart(2, "0"), occupied: table.classList.contains("table-box-active") });
      setItems([]);
      setProductsOpen(false);
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    if (!selectedTable || productsOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedTable(null);
      if (event.key === "F3") {
        event.preventDefault();
        setProductsOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTable, productsOpen]);

  const orderNumber = useMemo(() => {
    if (!selectedTable) return "";
    return selectedTable.occupied ? "29588" : `${29600 + Number(selectedTable.number)}`;
  }, [selectedTable]);

  const total = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);

  const addProduct = (product: OrderProduct) => {
    setItems((current) => {
      const existing = current.find((item) => item.code === product.code);
      if (existing) return current.map((item) => item.code === product.code ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { ...product, quantity: 1 }];
    });
  };

  if (!selectedTable) return null;
  const tableLabel = String(Number(selectedTable.number));

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1f2c3b]/95 px-4 py-6"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !productsOpen) setSelectedTable(null);
        }}
      >
        <div role="dialog" aria-modal="true" aria-label={`Mesa/Comanda ${tableLabel}`} className="flex h-[633px] max-h-[92vh] w-[741px] max-w-[96vw] flex-col overflow-hidden border border-[#999] bg-white font-[Segoe_UI,Tahoma,Geneva,Verdana,sans-serif] text-sm text-[#374151] shadow-2xl">
          <div className="flex h-[30px] shrink-0 select-none items-center justify-between border-b border-[#a0a0a0] bg-gradient-to-b from-[#e6e6e6] to-[#d4d4d4] px-2">
            <div className="pl-1 text-[13px] font-semibold tracking-wide text-[#444]">Mesa/Comanda: {tableLabel} (#{orderNumber})</div>
            <div className="flex h-full gap-[2px] py-[3px]">
              <button type="button" aria-label="Minimizar" className="flex h-full w-[28px] items-center justify-center border border-[#a0a0a0] bg-[#e1e1e1] hover:bg-[#d0d0d0]"><span className="mt-2 h-[2px] w-[10px] bg-black" /></button>
              <button type="button" aria-label="Fechar" onClick={() => setSelectedTable(null)} className="flex h-full w-[28px] items-center justify-center border border-[#a0a0a0] bg-[#e1e1e1] hover:bg-red-500 hover:text-white">×</button>
            </div>
          </div>

          <div className="flex h-[75px] shrink-0 items-center border-b border-[#d4d4d4] bg-white px-4">
            <div className="flex w-[250px] items-center">
              <div className="mr-4 text-[34px] font-bold leading-none tracking-tighter text-[#32965d]">{selectedTable.number}</div>
              <div className="flex flex-col justify-center">
                <div className="mb-1 flex items-center gap-2"><span>Pedido <strong>#{orderNumber}</strong></span><span className="bg-[#32965d] px-2 py-[2px] text-xs font-semibold uppercase tracking-wider text-white">Em Aberto</span></div>
                <div className="text-xs text-gray-600">Iniciado em 28-08 às <strong>01:25</strong></div>
              </div>
            </div>

            <div className="flex flex-1 items-center justify-end gap-4">
              <div className="relative w-[220px]"><span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 text-gray-400">⌕</span><input className="block w-full border border-[#abadb3] py-1.5 pl-8 pr-3 text-sm placeholder-gray-400 focus:border-[#0078d7] focus:outline-none" placeholder="Buscar Produto..." type="text" /></div>
              <button type="button" onClick={() => setProductsOpen(true)} className="flex items-center gap-2 border border-transparent px-2 py-1 font-bold text-[#0078d7] hover:border-blue-200 hover:bg-blue-50"><ActionIcon>▣</ActionIcon><span className="text-[15px]">Produtos <span className="text-sm font-normal text-gray-500">(F3)</span></span></button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 overflow-hidden bg-white">
            <aside className="flex w-[280px] shrink-0 flex-col border-r border-[#d4d4d4] bg-[#ececec]">
              <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
                <div><div className="mb-1 text-gray-700">Criado por: <strong>Tiago Gonçalves</strong></div><select className="mb-3 w-full border border-[#abadb3] bg-white px-2 py-1.5 text-sm shadow-sm focus:border-[#0078d7] focus:outline-none"><option>Tiago Gonçalves</option></select><textarea className="h-[60px] w-full resize-none border border-[#abadb3] p-2 text-sm shadow-sm placeholder-gray-400 focus:border-[#0078d7] focus:outline-none" placeholder="Anotar observação..." /></div>
                <div><h3 className="mb-2 font-bold text-gray-800">Informações do Pedido</h3><div className="mb-4 text-gray-700">Código Personalizado: <strong>{29636 + Number(selectedTable.number)}</strong></div><label className="flex cursor-pointer select-none items-center gap-3 text-gray-700"><input type="checkbox" className="h-[22px] w-[44px] cursor-pointer accent-[#0078d7]" /><span>Bloquear Pedido <span className="text-gray-500">(F8)</span></span></label></div>
              </div>
              <div className="mt-auto flex flex-col gap-4 p-4"><button type="button" className="flex w-full items-center gap-3 py-1 text-left font-bold text-[#0078d7] hover:text-blue-800"><ActionIcon>♙</ActionIcon><span>Vincular Cliente <span className="font-normal text-gray-500">(F11)</span></span></button><button type="button" className="flex w-full items-center gap-3 py-1 text-left font-bold text-[#0078d7] hover:text-blue-800"><ActionIcon>☷</ActionIcon><span>Mais Opções <span className="font-normal text-gray-500">(F12)</span></span></button></div>
              <div className="flex h-[60px] shrink-0 items-center border-t border-[#d4d4d4] bg-[#ececec] px-4"><button type="button" onClick={() => setSelectedTable(null)} className="flex w-full items-center gap-2 py-2 font-bold text-[#0078d7] hover:text-blue-800"><ActionIcon>‹</ActionIcon><span className="text-[15px]">Voltar <span className="text-sm font-normal text-gray-500">(ESC)</span></span></button></div>
            </aside>

            <section className="flex min-w-0 flex-1 flex-col bg-white">
              <div className="flex-1 overflow-y-auto p-4">
                {items.length === 0 ? <div className="ml-1 mt-2 text-sm text-gray-400">Nenhum item lançado.</div> : (
                  <div className="space-y-1">
                    {items.map((item) => (
                      <div key={item.code} className="grid grid-cols-[42px_1fr_72px_90px] items-center border-b border-gray-200 py-2 text-sm">
                        <strong>{item.quantity}x</strong><span>{item.name}</span><span>{money.format(item.price)}</span><strong className="text-right">{money.format(item.price * item.quantity)}</strong>
                      </div>
                    ))}
                    <div className="mt-4 flex justify-end text-base font-bold">Total: {money.format(total)}</div>
                  </div>
                )}
              </div>
              <div className="flex h-[60px] shrink-0 items-center justify-between border-t border-[#d4d4d4] bg-white px-6">
                <button type="button" className="-ml-2 flex items-center gap-2 border border-transparent px-2 py-2 font-bold text-[#0078d7] hover:border-blue-200 hover:bg-blue-50"><ActionIcon>▧</ActionIcon><span className="text-[15px]">Imprimir <span className="text-sm font-normal text-gray-500">(F9)</span></span></button>
                <button type="button" disabled={items.length === 0} className={`-mr-2 flex items-center gap-2 px-2 py-2 font-bold uppercase tracking-wide ${items.length === 0 ? "cursor-not-allowed text-gray-400" : "text-[#0078d7] hover:bg-blue-50"}`}><ActionIcon>▱</ActionIcon><span className="text-[15px]">Pagamento <span className="text-sm font-normal normal-case tracking-normal">(F5)</span></span></button>
              </div>
            </section>
          </div>
        </div>
      </div>

      <ProductLocatorModal open={productsOpen} onClose={() => setProductsOpen(false)} onAdd={addProduct} />
    </>
  );
}
