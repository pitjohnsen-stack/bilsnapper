import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cardClass, chartPrimary, chartSecondary } from '../../lib/dashboard-styles';
import type { MarketStat } from '../../types/car';

export interface HistoryChartProps {
  isDarkMode: boolean;
  reversedStats: MarketStat[];
  brandFilter: string;
}

export function HistoryChart({ isDarkMode, reversedStats, brandFilter }: HistoryChartProps) {
  const textColor = isDarkMode ? '#cbd5e1' : '#475569';
  const gridColor = isDarkMode ? '#334155' : '#e2e8f0';
  const tooltipStyle = {
    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
    border: `1px solid ${gridColor}`,
    borderRadius: '12px',
    color: textColor,
  };

  return (
    <div className={cardClass(isDarkMode)}>
      <h3 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">Prisutvikling over tid</h3>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        Historikk fra lagrede market_statistics-punkter
        {brandFilter !== 'all' ? ` (filtrert: ${brandFilter})` : ''}.
      </p>

      <div className="h-96 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={reversedStats} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
            <XAxis
              dataKey="calculatedAt"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: textColor }}
              tickFormatter={(val) =>
                val ? new Date(val).toLocaleDateString('no-NO', { day: '2-digit', month: 'short' }) : ''
              }
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: textColor }}
              tickFormatter={(value) => `${Math.round(value / 1000)}k`}
            />
            <Tooltip
              labelFormatter={(val) => (val ? new Date(val).toLocaleString('no-NO') : '')}
              formatter={(value: number) =>
                value != null ? `${value.toLocaleString('no-NO')} kr` : '—'
              }
              contentStyle={tooltipStyle}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="avgPrice"
              name="Snittpris"
              stroke={chartPrimary}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="medianPrice"
              name="Median"
              stroke={chartSecondary}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
