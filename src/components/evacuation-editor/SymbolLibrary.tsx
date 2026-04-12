import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface EditorSymbol {
  id: string;
  name: string;
  emoji: string;
  svg: string;
}

export const ISO7010_SYMBOLS: EditorSymbol[] = [
  { id: "emergency-exit", name: "Acil Çıkış", emoji: "🚪", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#16a34a"/><path d="M12 32h16" stroke="#fff" stroke-width="4"/><path d="m22 24 10 8-10 8" fill="none" stroke="#fff" stroke-width="4"/><rect x="40" y="14" width="12" height="36" rx="2" fill="#fff"/></svg>' },
  { id: "emergency-door", name: "Acil Çıkış Kapısı", emoji: "🚪", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#15803d"/><rect x="24" y="10" width="20" height="44" rx="3" fill="#fff"/><circle cx="39" cy="32" r="2" fill="#15803d"/></svg>' },
  { id: "fire-extinguisher", name: "Yangın Söndürücü", emoji: "🧯", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#dc2626"/><rect x="25" y="18" width="14" height="32" rx="4" fill="#fff"/><rect x="21" y="14" width="8" height="5" fill="#fff"/><path d="M29 14c0-4 3-7 7-7h4" stroke="#fff" stroke-width="3" fill="none"/></svg>' },
  { id: "fire-cabinet", name: "Yangın Dolabı", emoji: "🧰", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#b91c1c"/><rect x="14" y="12" width="36" height="40" rx="4" fill="#fff"/><circle cx="32" cy="32" r="10" fill="none" stroke="#b91c1c" stroke-width="4"/></svg>' },
  { id: "fire-hose", name: "Yangın Hortumu", emoji: "🧵", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#991b1b"/><circle cx="32" cy="32" r="14" fill="none" stroke="#fff" stroke-width="5"/><path d="M32 18v8m0 12v8m14-14h-8m-12 0h-8" stroke="#fff" stroke-width="4"/></svg>' },
  { id: "alarm-button", name: "Yangın Alarm Butonu", emoji: "🔴", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#ef4444"/><circle cx="32" cy="32" r="14" fill="#fff"/><circle cx="32" cy="32" r="8" fill="#ef4444"/></svg>' },
  { id: "emergency-light", name: "Acil Aydınlatma", emoji: "💡", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#0f766e"/><rect x="14" y="24" width="36" height="16" rx="4" fill="#fff"/><path d="M22 40h20" stroke="#fff" stroke-width="3"/><circle cx="24" cy="32" r="3" fill="#0f766e"/><circle cx="40" cy="32" r="3" fill="#0f766e"/></svg>' },
  { id: "assembly-point", name: "Toplanma Noktası", emoji: "📍", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#2563eb"/><path d="m32 12 8 16h-16z" fill="#fff"/><circle cx="32" cy="38" r="10" fill="none" stroke="#fff" stroke-width="4"/></svg>' },
  { id: "first-aid", name: "İlk Yardım", emoji: "🩹", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#16a34a"/><rect x="12" y="12" width="40" height="40" rx="6" fill="#fff"/><path d="M32 20v24M20 32h24" stroke="#16a34a" stroke-width="6"/></svg>' },
  { id: "emergency-phone", name: "Acil Telefon", emoji: "📞", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#1d4ed8"/><path d="M22 20c6 12 14 20 20 24l6-6-6-6-4 3c-4-2-7-5-9-9l3-4-6-6z" fill="#fff"/></svg>' },
  { id: "stairs", name: "Merdiven", emoji: "🪜", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#475569"/><path d="M16 44h8v-8h8v-8h8v-8h8" stroke="#fff" stroke-width="4" fill="none"/></svg>' },
  { id: "accessible", name: "Engelli Erişimi", emoji: "♿", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#0ea5e9"/><circle cx="29" cy="18" r="4" fill="#fff"/><path d="M28 24h8m-4 0v12m0 0 8 8m-8-8-8 8" stroke="#fff" stroke-width="4" fill="none"/><circle cx="32" cy="38" r="10" fill="none" stroke="#fff" stroke-width="3"/></svg>' },
  { id: "evac-arrow", name: "Tahliye Oku", emoji: "➡️", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#16a34a"/><path d="M14 32h28" stroke="#fff" stroke-width="6"/><path d="m34 20 14 12-14 12" fill="none" stroke="#fff" stroke-width="6"/></svg>' },
];

interface SymbolLibraryProps {
  onAddSymbol: (symbol: EditorSymbol) => void;
}

export function SymbolLibrary({ onAddSymbol }: SymbolLibraryProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ISO7010_SYMBOLS;
    return ISO7010_SYMBOLS.filter((item) => item.name.toLowerCase().includes(q));
  }, [query]);

  return (
    <Card className="flex h-full min-h-0 flex-col border-slate-700/70 bg-slate-950/40 backdrop-blur-sm shadow-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-100">ISO 7010 Sembol Kütüphanesi</CardTitle>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sembol ara"
          className="h-9 border-slate-700 bg-slate-900/70 text-slate-200"
        />
      </CardHeader>
      <CardContent className="min-h-0 flex-1 pt-0">
        <ScrollArea className="h-full pr-2">
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((symbol) => (
              <button
                key={symbol.id}
                onClick={() => onAddSymbol(symbol)}
                className={cn(
                  "group rounded-xl border border-slate-700/80 bg-slate-900/70 p-2 text-left",
                  "transition-all hover:border-emerald-500/60 hover:bg-slate-900"
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-9 w-9 rounded-lg bg-white p-1"
                    dangerouslySetInnerHTML={{ __html: symbol.svg }}
                  />
                  <span className="text-xs font-medium leading-tight text-slate-200">{symbol.name}</span>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
