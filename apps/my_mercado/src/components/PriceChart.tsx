import { memo } from "react";
import { ArrowLeft } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface PriceChartProps {
  chartData: Array<Record<string, string | number>>;
  groupedItems: Record<string, unknown[]>;
  onBack: () => void;
}

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f43f5e",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

/**
 * Componente de gráfico de tendência de preços
 * Lazy loaded para não carregar recharts no bundle inicial
 */
export const PriceChart = memo(function PriceChart({
  chartData,
  groupedItems,
  onBack,
}: PriceChartProps) {
  return (
    <div className="glass-card p-5">
      <button
        onClick={onBack}
        className="btn mb-6 bg-white/5 shadow-none text-slate-400 px-4 py-2 text-[0.85rem]"
      >
        <ArrowLeft size={16} /> Voltar
      </button>
      <h3 className="mb-6 text-white text-[1.2rem]">
        Tendência de Preços
      </h3>

      <div className="w-full h-[300px] mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid
              stroke="#1e293b"
              strokeDasharray="5 5"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              stroke="#475569"
              fontSize={10}
              tickMargin={10}
            />
            <YAxis
              stroke="#475569"
              fontSize={10}
              tickFormatter={(value) => `R$${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(15, 23, 42, 0.9)",
                border: "1px solid var(--card-border)",
                borderRadius: "12px",
                fontSize: "0.8rem",
              }}
              itemStyle={{ padding: "2px 0" }}
              cursor={{ stroke: "#334155" }}
            />
            {Object.keys(groupedItems).map((itemName, idx) => (
              <Line
                key={itemName}
                type="monotone"
                name={itemName}
                dataKey={itemName}
                stroke={COLORS[idx % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3, fill: COLORS[idx % COLORS.length] }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

export default PriceChart;
