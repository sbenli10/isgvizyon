import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import { AlertCircle } from "lucide-react";

type RiskDistributionItem = {
  name: string;
  value: number;
  color: string;
};

type RiskDistributionChartProps = {
  loading: boolean;
  riskDistribution: RiskDistributionItem[];
};

export default function RiskDistributionChart({
  loading,
  riskDistribution,
}: RiskDistributionChartProps) {
  if (loading) {
    return <div className="h-[320px] animate-pulse rounded-2xl bg-slate-900/70" />;
  }

  if (riskDistribution.length === 0) {
    return (
      <div className="flex h-[320px] flex-col items-center justify-center text-muted-foreground">
        <AlertCircle className="mb-3 h-12 w-12 opacity-30" />
        <p className="text-sm">Henüz denetim verisi yok</p>
        <p className="mt-1 text-xs">İlk denetiminizi oluşturun</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={riskDistribution}
          cx="50%"
          cy="50%"
          innerRadius={56}
          outerRadius={104}
          paddingAngle={3}
          dataKey="value"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={2}
        >
          {riskDistribution.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
