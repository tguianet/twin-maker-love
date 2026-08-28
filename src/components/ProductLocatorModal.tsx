import { useEffect, useMemo, useState } from "react";

export type OrderProduct = {
  code: string;
  category: string;
  name: string;
  price: number;
};

type ProductLocatorModalProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (product: OrderProduct) => void;
};

const categories = [
  ["Todas", "bg-white text-black"],
  ["1 Cervejas", "bg-[#2482a8] text-white"],
  ["2 Drinks", "bg-[#4b6a8a] text-white"],
  ["2 Refrigerantes e suco", "bg-[#3f8e79] text-white"],
  ["2 Suco de jarra", "bg-[#3b9c56] text-white"],
  ["3 Caipirinha", "bg-[#8cba51] text-black"],
  ["3 Saladas", "bg-[#facc15] text-black"],
  ["4 File Mignon", "bg-[#f27244] text-white"],
  ["5 Picanha", "bg-[#f99b1c] text-black"],
  ["6 File de Frango", "bg-[#e53e3e] text-white"],
  ["7 File de Sant Peter", "bg-[#b91c52] text-white"],
  ["8 Massas", "bg-[#6a1b9a] text-white"],
  ["9 Pratos kids", "bg-[#229cb5] text-white"],
  ["Lanche de File Mignon", "bg-[#668299] text-white"],
  ["Lanche de Frango", "bg-[#4a8275] text-white"],
  ["Lanche de hamburguer", "bg-[#40b08f] text-black"],
  ["Lanches especiais", "bg-[#a3c263] text-black"],
  ["outros", "bg-[#f0c341] text-black"],
] as const;

const products: OrderProduct[] = [
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

const money = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function IconButton({ children, onClick, label }: { children: React.ReactNode; onClick?: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-[2px] border border-[#ccc] bg-[#f0f0f0] text-xl text-[#374151] hover:bg-[#e0e0e0]"
    >
      {children}
    </button>
  );
}

export function ProductLocatorModal({ open, onClose, onAdd }: ProductLocatorModalProps) {
  const [category, setCategory] = useState("1 Cervejas");
  const [query, setQuery] = useState("");
  const [selectedCode, setSelectedCode] = useState("2");
  const [groupCategory, setGroupCategory] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "F11") {
        event.preventDefault();
        const selected = products.find((product) => product.code === selectedCode);
        if (selected) onAdd(selected);
      }
      if (event.key === "Enter") {
        const selected = products.find((product) => product.code === selectedCode);
        if (selected) onAdd(selected);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onAdd, onClose, selectedCode]);

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return products.filter((product) => {
      const categoryMatches = category === "Todas" || product.category === category;
      const queryMatches =
        !normalized ||
        product.name.toLocaleLowerCase("pt-BR").includes(normalized) ||
        product.code.includes(normalized) ||
        product.category.toLocaleLowerCase("pt-BR").includes(normalized);
      return categoryMatches && queryMatches;
    });
  }, [category, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Localizar Produto" className="flex h-[768px] max-h-[94vh] w-[1024px] max-w-[96vw] flex-col overflow-hidden border border-[#666] bg-white font-[Segoe_UI,Tahoma,Geneva,Verdana,sans-serif] shadow-[2px_2px_8px_rgba(0,0,0,0.55)]">
        <div className="flex h-8 shrink-0 select-none items-center justify-between border-b border-[#999] bg-gradient-to-b from-[#eaeaea] to-[#d0d0d0] px-2">
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-sm bg-blue-500" />
            <span className="text-xs font-semibold text-gray-800">Localizar Produto</span>
          </div>
          <div className="flex gap-1">
            <button type="button" className="flex h-6 w-8 items-center justify-center hover:bg-gray-300">−</button>
            <button type="button" className="flex h-6 w-8 items-center justify-center hover:bg-gray-300">▣</button>
            <button type="button" onClick={onClose} className="flex h-6 w-8 items-center justify-center hover:bg-red-500 hover:text-white">×</button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="w-[320px] shrink-0 overflow-y-auto bg-[#2b2b2b] p-2">
            <div className="grid grid-cols-2 gap-2">
              {categories.map(([label, colorClass]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setCategory(label)}
                  className={`flex h-[60px] items-center justify-center p-2 text-center text-[13px] font-semibold transition-opacity hover:opacity-90 ${colorClass} ${category === label ? "ring-2 ring-blue-300 ring-inset" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col bg-white">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-300 bg-gray-50 px-4">
              <div className="relative w-96 max-w-[58%]">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">⌕</span>
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="block w-full rounded-sm border border-gray-300 py-1.5 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Pesquisar..."
                  type="text"
                />
              </div>
              <div className="flex gap-2">
                <IconButton label="Lista">☰</IconButton>
                <IconButton label="Grade">▦</IconButton>
                <IconButton label="Atualizar">↻</IconButton>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="grid h-10 shrink-0 grid-cols-[110px_96px_1fr_128px_96px_96px] items-center border-y border-gray-300 bg-[#f5f5f5] pr-3 text-xs font-semibold text-gray-600">
                <div className="h-full border-r border-gray-200 px-2 flex items-center">Categoria</div>
                <div className="h-full border-r border-gray-200 px-2 flex items-center">Código</div>
                <div className="h-full border-r border-gray-200 px-2 flex items-center">Nome do Produto</div>
                <div className="h-full border-r border-gray-200 px-2 flex items-center">Preço de Venda</div>
                <div className="h-full border-r border-gray-200 text-center leading-tight flex flex-col items-center justify-center"><span>Adicionar</span><span>(F11)</span></div>
                <div className="text-center leading-tight flex flex-col items-center justify-center"><span>Personalizar</span><span>(Enter)</span></div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {visibleProducts.map((product, index) => {
                  const selected = selectedCode === product.code;
                  return (
                    <div
                      key={`${product.code}-${product.name}`}
                      onClick={() => setSelectedCode(product.code)}
                      onDoubleClick={() => onAdd(product)}
                      className={`grid h-12 cursor-default grid-cols-[110px_96px_1fr_128px_96px_96px] items-center border-b border-gray-100 border-l-4 border-l-[#2482a8] text-sm ${selected ? "bg-[#dcebfa]" : index % 2 ? "bg-[#f9f9f9]" : "bg-white"}`}
                    >
                      <div className="flex h-full items-center border-r border-gray-200 px-2">{product.category}</div>
                      <div className="flex h-full items-center border-r border-gray-200 px-2">{product.code}</div>
                      <div className="flex h-full items-center border-r border-gray-200 px-2">{product.name}</div>
                      <div className="flex h-full items-center border-r border-gray-200 px-2 font-bold">{money.format(product.price)}</div>
                      <button type="button" onClick={(event) => { event.stopPropagation(); onAdd(product); }} className="flex h-full items-center justify-center border-r border-gray-200 text-3xl font-light hover:bg-blue-50" aria-label={`Adicionar ${product.name}`}>+</button>
                      <button type="button" onClick={(event) => event.stopPropagation()} className="flex h-full items-center justify-center text-2xl hover:bg-blue-50" aria-label={`Personalizar ${product.name}`}>☷</button>
                    </div>
                  );
                })}
                {visibleProducts.length === 0 && <div className="p-6 text-sm text-gray-400">Nenhum produto encontrado.</div>}
              </div>
            </div>

            <div className="flex h-10 shrink-0 items-center border-t border-gray-300 bg-gray-50 px-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={groupCategory} onChange={(event) => setGroupCategory(event.target.checked)} className="h-5 w-10 accent-blue-500" />
                Agrupar Categoria
              </label>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
