import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { cardClass, chartMuted, chartPrimary, chartSecondary } from '../../lib/dashboard-styles';
import type { Car } from '../../types/car';

interface StatRow {
  id: string;
  label: string;
  avg: number | null;
  median: number | null;
}

interface ScatterRow {
  mileage: number;
  price: number;
  brand?: string;
}

export interface PriceChartsProps {
  isDarkMode: boolean;
  statsChartRows: StatRow[];
  scatterData: ScatterRow[];
  deals: Car[];
}

export function PriceCharts({ isDarkMode, statsChartRows, scatterData }: PriceChartsProps) {
  const textColor = isDarkMode ? '#cbd5e1' : '#475569';
  const gridColor = isDarkMode ? '#334155' : '#e2e8f0';
  const tooltipStyle = {
    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
    border: `1px solid ${gridColor}`,
    borderRadius: '12px',
    color: textColor,
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Prisnivå</h3>

      <div className={cardClass(isDarkMode)}>
        <h4 className="mb-4 text-sm font-medium text-slate-500 dark:text-slate-400">
          Snitt og median per modell (filter)
        </h4>
        <div className="h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statsChartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: textColor }}
                interval={0}
                angle={-18}
                textAnchor="end"
                height={56}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: textColor }}
                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              />
              <Tooltip
                formatter={(value: number) =>
                  value != null ? `${value.toLocaleString('no-NO')} kr` : '—'
                }
                contentStyle={tooltipStyle}
              />
              <Legend />
              <Bar dataKey="avg" name="Snitt" fill={chartPrimary} radius={[4, 4, 0, 0]} />
              <Bar dataKey="median" name="Median" fill={chartSecondary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={cardClass(isDarkMode)}>
        <h4 className="mb-4 text-sm font-medium text-slate-500 dark:text-slate-400">
          Pris vs. kilometer (utvalg)
        </h4>
        <div className="h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                type="number"
                dataKey="mileage"
                name="Km"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: textColor }}
                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              />
              <YAxis
                type="number"
                dataKey="price"
                name="Pris"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: textColor }}
                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              />
              <ZAxis type="category" dataKey="brand" name="Merke" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3', stroke: chartMuted }}
                contentStyle={tooltipStyle}
              />
              <Scatter name="Biler" data={scatterData} fill={chartPrimary} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
