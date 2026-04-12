import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface LegendEntry {
  id: string;
  name: string;
  emoji: string;
  count: number;
}

interface LegendPanelProps {
  items: LegendEntry[];
}

export function LegendPanel({ items }: LegendPanelProps) {
  return (
    <Card id="evacuation-legend" className="border-slate-700/70 bg-slate-950/40 backdrop-blur-sm shadow-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-100">Otomatik Lejant</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-xs text-slate-400">Canvas uzerinde sembol kullandikca lejant otomatik olusur.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200">
                <span className="mr-2">{item.emoji}</span>
                <span className="font-medium">{item.name}</span>
                <span className="ml-2 text-slate-400">x {item.count}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}