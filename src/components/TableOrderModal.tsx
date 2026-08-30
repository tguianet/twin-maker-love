import { useEffect, useMemo, useState } from "react";
import { ProductLocatorModal, type OrderProduct } from "./ProductLocatorModal";

type SelectedTable = { number: string; occupied: boolean };
type OrderItem = OrderProduct & { quantity: number };
type TableStateMap = Record<string, boolean>;

const TABLE_STATE_KEY = "tguia-food-table-closing-state";

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

const money = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function readTableStates(): TableStateMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(TABLE_STATE_KEY) ?? "{}") as TableStateMap;
  } catch {
    return {};
  }
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

function SmallIcon({ children, tone = "blue" }: { children: React.ReactNode; tone?: "blue" | "gray" | "black" }) {
  const color = tone === "blue" ? "text-[#1688ff]" : tone === "gray" ? "text-[#9ca3af]" : "text-[#111827]";
  return <span className={`inline-flex h-7 w-7 items-center justify-center text-[25px] leading-none ${color}`}>{children}</span>;
}

export function TableOrderModal() {
  const [selectedTable, setSelectedTable] = useState<SelectedTable | null>(null);
  const [productsOpen, setProductsOpen] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [quickQuery, setQuickQuery] = useState("");
  const [quickProduct, setQuickProduct] = useState<OrderProduct | null>(null);
  const [quickQuantity, setQuickQuantity] = useState(1);
  const [actionItemCode, setActionItemCode] = useState<string | null>(null);
  const [tableStates, setTableStates] = useState<TableStateMap>(() => readTableStates());

  const isBlocked = selectedTable ? Boolean(tableStates[selectedTable.number]) : false;

  const toggleBlocked = () => {
    if (!selectedTable) return;
    const tableNumber = selectedTable.number;
    setTableStates((current) => {
      const next = { ...current, [tableNumber]: !current[tableNumber] };
      window.localStorage.setItem(TABLE_STATE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("tguia:table-state-change", {
        detail: { tableNumber, blocked: Boolean(next[tableNumber]) },
      }));
      return next;
    });
  };

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const table = target?.closest<HTMLElement>(".table-box, .table-box-active");
      if (!table) return;
      const number = Array.from(table.querySelectorAll("span"))
        .map((span) => span.textContent?.trim() ?? "")
        .find((text) => /^\d{1,3}$/.test(text));
      if (!number) return;
      setSelectedTable({ number: number.padStart(2, "0"), occupied: table.classList.contains("table-box-active") });
      setItems([]);
      setProductsOpen(false);
      setQuickQuery("");
      setQuickProduct(null);
      setQuickQuantity(1);
      setActionItemCode(null);
      setTableStates(readTableStates());
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    if (!selectedTable || productsOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (actionItemCode) setActionItemCode(null);
        else if (quickProduct) {
          setQuickProduct(null);
          setQuickQuery("");
          setQuickQuantity(1);
        } else setSelectedTable(null);
      }
      if (event.key === "F3" && !isBlocked) {
        event.preventDefault();
        setProductsOpen(true);
      }
      if (event.key === "F8") {
        event.preventDefault();
        toggleBlocked();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTable, productsOpen, quickProduct, actionItemCode, isBlocked]);

  const orderNumber = useMemo(() => {
    if (!selectedTable) return "";
    return selectedTable.occupied ? "29588" : String(29600 + Number(selectedTable.number));
  }, [selectedTable]);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);
  const service = subtotal * 0.1;
  const total = subtotal + service;

  const addProduct = (product: OrderProduct, quantity = 1) => {
    if (isBlocked) return;
    setItems((current) => {
      const existing = current.find((item) => item.code === product.code);
      if (!existing) return [...current, { ...product, quantity }];
      return current.map((item) => item.code === product.code ? { ...item, quantity: item.quantity + quantity } : item);
    });
  };

  const updateQuantity = (code: string, delta: number) => {
    if (isBlocked) return;
    setItems((current) =>
      current
        .map((item) => item.code === code ? { ...item, quantity: item.quantity + delta } : item)
        .filter((item) => item.quantity > 0),
    );
  };

  const removeItem = (code: string) => {
    if (isBlocked) return;
    setItems((current) => current.filter((item) => item.code !== code));
    setActionItemCode(null);
  };

  const duplicateItem = (code: string) => {
    if (isBlocked) return;
    const found = items.find((item) => item.code === code);
    if (found) addProduct(found, found.quantity);
    setActionItemCode(null);
  };

  const findQuickProduct = (value: string) => {
    const query = value.trim().toLocaleLowerCase("pt-BR");
    if (query.length < 2) return null;
    return quickProducts.find((product) => product.name.toLocaleLowerCase("pt-BR").includes(query) || product.code === query) ?? null;
  };

  const confirmQuickAdd = () => {
    if (!quickProduct || isBlocked) return;
    addProduct(quickProduct, quickQuantity);
    setQuickProduct(null);
    setQuickQuery("");
    setQuickQuantity(1);
  };

  if (!selectedTable) return null;
  const tableLabel = String(Number(selectedTable.number));
  const actionItem = items.find((item) => item.code === actionItemCode) ?? null;
  const statusColor = isBlocked ? "#e59b13" : "#32965d";

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1f2c3b]/95 px-4 py-6">
        <div role="dialog" aria-modal="true" aria-label={`Mesa/Comanda ${tableLabel}`} onMouseDown={(e) => e.stopPropagation()} className="flex h-[633px] max-h-[92vh] w-[741px] max-w-[96vw] flex-col overflow-hidden border border-[#999] bg-white font-[Segoe_UI,Tahoma,Geneva,Verdana,sans-serif] text-[12px] text-[#273142] shadow-2xl">
          <div className="flex h-[30px] shrink-0 items-center justify-between border-b border-[#a0a0a0] bg-gradient-to-b from-[#e6e6e6] to-[#d4d4d4] px-2">
            <strong>Mesa/Comanda: {tableLabel} (#{orderNumber})</strong>
            <div className="flex gap-[2px]"><button className="h-6 w-7 border border-[#aaa] bg-[#e1e1e1]">−</button><button onClick={() => setSelectedTable(null)} className="h-6 w-7 border border-[#aaa] bg-[#e1e1e1] hover:bg-red-500 hover:text-white">×</button></div>
          </div>

          <div className="relative flex h-[68px] shrink-0 items-center border-b border-[#d4d4d4] px-4">
            <div className="flex w-[265px] items-center">
              <div className="mr-4 text-[29px] font-bold" style={{ color: statusColor }}>{selectedTable.number}</div>
              <div>
                <div className="mb-1">Pedido <strong>#{orderNumber}</strong> <span className="ml-2 px-2 py-1 text-white" style={{ backgroundColor: statusColor }}>{isBlocked ? "Em Fechamento" : "Em Aberto"}</span></div>
                <div>Iniciado em 28-08 às <strong>01:25</strong></div>
              </div>
            </div>
            <div className="flex flex-1 justify-end gap-3">
              <input disabled={isBlocked} value={quickQuery} onChange={(e) => { const v = e.target.value; setQuickQuery(v); setQuickProduct(findQuickProduct(v)); setQuickQuantity(1); }} className="h-8 w-[150px] border border-[#c7cbd0] px-3 disabled:bg-gray-100 disabled:text-gray-400" placeholder="Buscar Produto..." />
              <button disabled={isBlocked} onClick={() => setProductsOpen(true)} className="flex items-center gap-1 font-bold text-black disabled:cursor-not-allowed disabled:opacity-40"><span className="text-[#087cf0]"><BasketIcon /></span>Produtos <span className="font-normal">(F3)</span></button>
            </div>

            {quickProduct && !isBlocked && (
              <div className="absolute right-[30px] top-[55px] z-[130] w-[285px] rounded-sm border border-gray-300 bg-white shadow-[0_4px_15px_rgba(0,0,0,.2)]">
                <div className="flex justify-end p-[2px]"><button onClick={() => { setQuickProduct(null); setQuickQuery(""); setQuickQuantity(1); }} className="flex h-5 w-5 items-center justify-center rounded-sm bg-[#d9534f] text-white">×</button></div>
                <div className="flex flex-col items-center px-5 pb-5 pt-3">
                  <h2 className="mb-6 text-center font-mono text-lg font-bold text-black">{quickProduct.name} - {money.format(quickProduct.price)}</h2>
                  <div className="mb-8 flex items-center gap-3"><button onClick={() => setQuickQuantity((q) => Math.max(1, q - 1))} className="flex h-6 w-6 items-center justify-center rounded-full bg-[#8dbbf2] text-lg text-white">−</button><input readOnly value={quickQuantity} className="h-8 w-20 border border-[#ccc] text-center font-bold" /><button onClick={() => setQuickQuantity((q) => q + 1)} className="flex h-6 w-6 items-center justify-center rounded-full bg-[#8dbbf2] text-lg text-white">+</button></div>
                  <div className="flex w-full flex-col gap-3"><button className="w-full border border-[#ccc] bg-white py-2.5">Personalizar (F2)</button><button onClick={confirmQuickAdd} className="w-full bg-[#3f3f3f] py-3 font-bold text-white">＋ Adicionar (ENTER)</button></div>
                </div>
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-1">
            <aside className="flex w-[220px] shrink-0 flex-col border-r border-[#d4d4d4] bg-[#ececec]">
              <div className="p-3">
                <div className="mb-1">Criado por: <strong>Tiago Gonçalves</strong></div>
                <select className="mb-2 w-full border border-[#abadb3] bg-white px-2 py-1.5"><option>Tiago Gonçalves</option></select>
                <textarea className="h-[58px] w-full resize-none border border-[#abadb3] p-2" placeholder="Anotar observação..." />
                <h3 className="mt-3 font-bold">Informações do Pedido</h3>
                <div className="mt-3">Código Personalizado: <strong>{29636 + Number(selectedTable.number)}</strong></div>
                <label className="mt-4 flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={isBlocked} onChange={toggleBlocked} />
                  {isBlocked ? "Desbloquear Pedido (F8)" : "Bloquear Pedido (F8)"}
                </label>
              </div>
              <div className="mt-auto p-3"><button className="mb-4 block font-bold text-[#0078d7]">Vincular Cliente (F11)</button><button className="block font-bold text-[#0078d7]">Mais Opções (F12)</button></div>
              <div className="border-t border-[#d4d4d4] p-4"><button onClick={() => setSelectedTable(null)} className="font-bold text-[#0078d7]">‹ Voltar (ESC)</button></div>
            </aside>

            <section className="relative flex min-w-0 flex-1 flex-col bg-white">
              <div className="flex h-9 items-center justify-between border-b border-[#ddd] px-2"><strong>Itens do Pedido ({items.reduce((sum, item) => sum + item.quantity, 0)})</strong><label className="flex items-center gap-1 text-[11px] text-gray-500"><input type="checkbox" /> Exibição Completa</label></div>

              <div className="flex-1 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="p-4 text-gray-400">Nenhum item lançado.</div>
                ) : (
                  <>
                    {items.map((item) => (
                      <div key={item.code} className="grid h-9 grid-cols-[24px_1fr_78px_34px] items-center border-b border-gray-100 px-2 text-[12px]">
                        <span className="bg-[#e5e5e5] text-center font-bold">{item.quantity}</span>
                        <strong className="truncate">{item.name}</strong>
                        <strong className="text-right text-[14px]">{money.format(item.price * item.quantity)}</strong>
                        <button disabled={isBlocked} onClick={() => setActionItemCode(item.code)} className="text-right text-[22px] leading-none text-black disabled:opacity-30">⋮</button>
                      </div>
                    ))}
                    <div className="border-b border-gray-100 py-2 text-[14px] font-bold"><div className="grid grid-cols-[1fr_120px] px-20"><span>SUBTOTAL:</span><span className="text-right">{money.format(subtotal)}</span></div></div>
                    <div className="border-b border-gray-100 py-2 text-[14px] font-bold"><div className="grid grid-cols-[1fr_120px] px-14"><span>(+) SERVIÇO:</span><span className="text-right">{money.format(service)}</span></div></div>
                    <div className="border-b border-gray-100 py-2 text-[14px] font-bold"><div className="grid grid-cols-[1fr_120px] px-20"><span>TOTAL:</span><span className="text-right">{money.format(total)}</span></div></div>
                  </>
                )}
              </div>

              <div className="flex h-[60px] items-center justify-between border-t border-[#d4d4d4] px-6"><button className="font-bold text-[#0078d7]">▧ Imprimir (F9)</button><button disabled={items.length === 0} className={`px-4 py-3 font-bold ${items.length ? "bg-[#444] text-white" : "text-gray-400"}`}>▱ PAGAMENTO (F5)</button></div>

              {actionItem && !isBlocked && (
                <div className="absolute inset-0 z-[150] flex items-center justify-center bg-white/70">
                  <div className="w-[332px] border border-[#d1d5db] bg-white p-5 shadow-[0_8px_28px_rgba(0,0,0,.24)]">
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => { updateQuantity(actionItem.code, -1); setActionItemCode(null); }} className="flex h-[49px] items-center justify-center gap-3 border border-[#e5e7eb] bg-white hover:bg-gray-50"><SmallIcon tone="gray">⊖</SmallIcon><span>Diminuir -1</span></button>
                        <button onClick={() => { updateQuantity(actionItem.code, 1); setActionItemCode(null); }} className="flex h-[49px] items-center justify-center gap-3 border border-[#e5e7eb] bg-white hover:bg-gray-50"><SmallIcon>⊕</SmallIcon><span>Adicionar +1</span></button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setActionItemCode(null)} className="flex h-[49px] items-center justify-center gap-3 border border-[#e5e7eb] bg-white hover:bg-gray-50"><SmallIcon>✎</SmallIcon><span>Editar</span></button>
                        <button onClick={() => duplicateItem(actionItem.code)} className="flex h-[49px] items-center justify-center gap-3 border border-[#e5e7eb] bg-white hover:bg-gray-50"><SmallIcon>⧉</SmallIcon><span className="text-center">Duplicar e<br />Editar</span></button>
                      </div>
                      <button onClick={() => removeItem(actionItem.code)} className="flex h-[49px] items-center justify-center gap-3 border border-[#e5e7eb] bg-white hover:bg-gray-50"><SmallIcon tone="black">▣</SmallIcon><span>Excluir Item</span></button>
                      <button onClick={() => setActionItemCode(null)} className="mt-2 flex h-[49px] items-center justify-center gap-3 border border-[#e5e7eb] bg-white hover:bg-gray-50"><SmallIcon>‹</SmallIcon><span>Voltar (ESC)</span></button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <ProductLocatorModal open={productsOpen} onClose={() => setProductsOpen(false)} onAdd={addProduct} />
    </>
  );
}
