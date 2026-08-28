import { useEffect, useMemo, useState } from "react";
import { ProductLocatorModal, type OrderProduct } from "./ProductLocatorModal";

type SelectedTable = {
  number: string;
  occupied: boolean;
};

type OrderItem = OrderProduct & { quantity: number };

const quickProducts: OrderProduct[] = [
  { category: "1 Cervejas", code: "2", name: "1 - Brahma 600ml", price: 9.9 },
  { category: "1 Cervejas", code: "4", name: "3 Original 600ml", price: 12.5 },
  { category: "1 Cervejas", code: "5", name: "4 Serramalte 600ml", price: 12.5 },
  { category: "1 Cervejas", code: "9", name: "Budwaiser long", price: 9.5 },
  { category: "1 Cervejas", code: "221", name: "cabare", price: 9.9 },
  { category: "1 Cervejas", code: "129", name: "heineken 600", price: 15 },
  { category: "1 Cervejas", code: "8", name: "Heineken long", price: 9.5 },
  { category: "1 Cervejas", code: "1", name: "Heineken zero", price: 9.5 },
  { category: "1 Cervejas", code: "10", name: "Malzbier", price: 9.5 },
  { category: "1 Cervejas", code: "0", name: "originalzinha", price: 8 },
];

function ActionIcon({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-6 w-6 items-center justify-center text-[20px]">{children}</span>;
}

function BasketIcon() {
  return (
    <svg className="h-7 w-7" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.3">
      <path d="M5 12h22l-2.2 13H7.2L5 12Z" />
      <path d="M10 12 16 5l6 7" />
      <path d="M11 16v6M16 16v6M21 16v6" />
    </svg>
  );
}

function PersonalizeIcon() {
  return (
    <svg className="h-8 w-8" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 8h14M13 16h14M13 24h14" />
      <path d="m4.5 7 2 2 4-4M4.5 15l2 2 4-4M4.5 23l2 2 4-4" />
    </svg>
  );
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const plainMoney = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function TableOrderModal() {
  const [selectedTable, setSelectedTable] = useState<SelectedTable | null>(null);
  const [productsOpen, setProductsOpen] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [quickQuery, setQuickQuery] = useState("");
  const [quickProduct, setQuickProduct] = useState<OrderProduct | null>(null);
  const [quickQuantity, setQuickQuantity] = useState(1);

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
      setQuickQuery("");
      setQuickProduct(null);
      setQuickQuantity(1);
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    if (!selectedTable || productsOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (quickProduct) {
          setQuickProduct(null);
          setQuickQuery("");
          setQuickQuantity(1);
        } else {
          setSelectedTable(null);
        }
      }
      if (event.key === "F3") {
        event.preventDefault();
        setProductsOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTable, productsOpen, quickProduct]);

  const orderNumber = useMemo(() => {
    if (!selectedTable) return "";
    return selectedTable.occupied ? "29588" : `${29600 + Number(selectedTable.number)}`;
  }, [selectedTable]);

  const total = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);

  const quickMatches = useMemo(() => {
    const query = quickQuery.trim().toLocaleLowerCase("pt-BR");
    if (query.length < 2 || quickProduct) return [];
    return quickProducts
      .filter((product) => product.name.toLocaleLowerCase("pt-BR").includes(query) || product.code.includes(query))
      .slice(0, 5);
  }, [quickQuery, quickProduct]);

  const addProduct = (product: OrderProduct, quantity = 1) => {
    setItems((current) => {
      const existing = current.find((item) => item.code === product.code);
      if (existing) {
        return current.map((item) => item.code === product.code ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...current, { ...product, quantity }];
    });
  };

  const confirmQuickAdd = () => {
    if (!quickProduct) return;
    addProduct(quickProduct, quickQuantity);
    setQuickProduct(null);
    setQuickQuery("");
    setQuickQuantity(1);
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

          <div className="relative flex h-[75px] shrink-0 items-center border-b border-[#d4d4d4] bg-white px-4">
            <div className="flex w-[250px] items-center">
              <div className="mr-4 text-[34px] font-bold leading-none tracking-tighter text-[#32965d]">{selectedTable.number}</div>
              <div className="flex flex-col justify-center">
                <div className="mb-1 flex items-center gap-2"><span>Pedido <strong>#{orderNumber}</strong></span><span className="bg-[#32965d] px-2 py-[2px] text-xs font-semibold uppercase tracking-wider text-white">Em Aberto</span></div>
                <div className="text-xs text-gray-600">Iniciado em 28-08 às <strong>01:25</strong></div>
              </div>
            </div>

            <div className="flex flex-1 items-center justify-end gap-3">
              <div className="relative w-[150px]">
                <svg className="pointer-events-none absolute left-2 top-1/2 h-[19px] w-[19px] -translate-y-1/2 text-[#7c8793]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-4-4" />
                </svg>
                <input
                  value={quickQuery}
                  onChange={(event) => {
                    setQuickQuery(event.target.value);
                    setQuickProduct(null);
                    setQuickQuantity(1);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && quickMatches[0]) {
                      event.preventDefault();
                      setQuickProduct(quickMatches[0]);
                      setQuickQuery(quickMatches[0].name);
                      setQuickQuantity(1);
                    }
                  }}
                  className="h-[31px] w-full border border-[#c7cbd0] bg-white py-1 pl-9 pr-2 text-[12px] text-[#20252b] focus:border-[#6ca9dc] focus:outline-none"
                  placeholder="Buscar Produto..."
                  type="text"
                />
                {quickMatches.length > 0 && (
                  <div className="absolute left-0 top-[31px] z-[125] w-[300px] border border-[#b7b7b7] bg-white shadow-lg">
                    {quickMatches.map((product) => (
                      <button
                        key={product.code}
                        type="button"
                        onClick={() => {
                          setQuickProduct(product);
                          setQuickQuery(product.name);
                          setQuickQuantity(1);
                        }}
                        className="flex w-full items-center justify-between border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-[#dcebfa]"
                      >
                        <span>{product.name}</span>
                        <strong>{plainMoney.format(product.price)}</strong>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setProductsOpen(true)} className="flex h-[34px] items-center gap-1.5 border border-transparent px-1 font-bold text-[#087cf0] hover:bg-blue-50">
                <BasketIcon />
                <span className="text-[13px] text-black">Produtos <span className="font-normal text-[#4b5563]">(F3)</span></span>
              </button>
            </div>

            {quickProduct && (
              <div className="absolute right-[32px] top-[55px] z-[130] w-[270px] border border-[#c8c8c8] border-b-[3px] border-b-[#cfcfcf] bg-white px-[10px] pb-[10px] pt-[27px] shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
                <button
                  type="button"
                  aria-label="Fechar lançamento rápido"
                  onClick={() => {
                    setQuickProduct(null);
                    setQuickQuery("");
                    setQuickQuantity(1);
                  }}
                  className="absolute right-[8px] top-[6px] flex h-[14px] w-[14px] items-center justify-center bg-[#e26150] text-[12px] font-bold leading-none text-white hover:bg-[#c94c3d]"
                >
                  ×
                </button>

                <div className="mb-[28px] whitespace-nowrap text-center text-[15px] font-bold text-black">
                  {quickProduct.name} - {plainMoney.format(quickProduct.price)}
                </div>

                <div className="mb-[22px] flex items-center justify-center gap-[10px]">
                  <button
                    type="button"
                    aria-label="Diminuir quantidade"
                    onClick={() => setQuickQuantity((value) => Math.max(1, value - 1))}
                    className="flex h-[21px] w-[21px] items-center justify-center rounded-full bg-[#87c5f7] text-[18px] font-bold leading-none text-white hover:bg-[#65afea]"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={quickQuantity}
                    onChange={(event) => setQuickQuantity(Math.max(1, Number(event.target.value) || 1))}
                    className="h-[31px] w-[77px] appearance-none border border-[#d0d4d8] bg-white p-0 text-center text-[12px] font-bold text-black focus:border-[#6ca9dc] focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Aumentar quantidade"
                    onClick={() => setQuickQuantity((value) => value + 1)}
                    className="flex h-[21px] w-[21px] items-center justify-center rounded-full bg-[#87c5f7] text-[18px] font-bold leading-none text-white hover:bg-[#65afea]"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  className="mb-[10px] flex h-[46px] w-full items-center justify-center gap-[12px] border border-[#d1d1d1] bg-white text-[12px] font-normal text-black hover:bg-[#f6f6f6]"
                >
                  <PersonalizeIcon />
                  <span>Personalizar (F2)</span>
                </button>

                <button
                  type="button"
                  onClick={confirmQuickAdd}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") confirmQuickAdd();
                  }}
                  autoFocus
                  className="flex h-[45px] w-full items-center justify-center gap-[12px] bg-[#444444] text-[12px] font-bold text-white hover:bg-[#333333]"
                >
                  <svg className="h-[30px] w-[30px]" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 5v22M5 16h22" />
                  </svg>
                  <span>Adicionar (ENTER)</span>
                </button>
              </div>
            )}
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
