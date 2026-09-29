import React, { useState } from 'react';
import {
  AppDatabaseState,
  Category,
} from '../domain/models';
import {
  calculateAccountBalance,
  formatMoney,
} from '../data/localRepository';
import {
  calculateStatisticalMetrics,
  EconomicIndicatorsData,
  MonthlyComparisonPoint,
  MonthlyTrendSummary,
} from '../utils/economicIndicators';
import { GastitoLogo } from './GastitoLogo';
import { Printer, X } from 'lucide-react';

interface FormalPdfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dbState: AppDatabaseState;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  expenseByCategory: { category: Category; total: number; count: number; stdDev: number }[];
  indicators: EconomicIndicatorsData | null;
  monthlyComparison: {
    currentMonthLabel: string;
    previousMonthLabel: string;
    currentMonthTotal: number;
    previousMonthTotal: number;
    monthOverMonthPct: number;
    dailyBurnRate: number;
    projectedMonthEnd: number;
    comparisonPoints: MonthlyComparisonPoint[];
    sixMonthTrend: MonthlyTrendSummary[];
    monthlyStdDev: number;
    monthlyMean: number;
    monthlyCvPct: number;
  };
}

export const FormalPdfReportModal: React.FC<FormalPdfReportModalProps> = ({
  isOpen,
  onClose,
  dbState,
  totalIncome,
  totalExpense,
  netBalance,
  expenseByCategory,
  indicators,
  monthlyComparison,
}) => {
  const [pdfSections, setPdfSections] = useState({
    summary: true,
    indicators: true,
    monthlyTrend: true,
    categories: true,
    accounts: true,
    budgets: true,
    obligations: true,
  });

  if (!isOpen) return null;

  const { accounts, transactions, transfers, budgets, obligations, preferences, categories } =
    dbState;
  const currencySymbol = preferences.currencySymbol;
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const expenseAmounts = transactions
    .filter((t) => t.type === 'EXPENSE')
    .map((t) => t.amount);
  const globalStats = calculateStatisticalMetrics(expenseAmounts);

  const pts = monthlyComparison.comparisonPoints;
  const maxLineVal = Math.max(
    100,
    ...pts.map((p) =>
      Math.max(p.currentMonthCumulative, p.previousMonthCumulative)
    )
  );
  const chartW = 540;
  const chartH = 150;
  const padL = 44;
  const padR = 20;
  const padT = 18;
  const padB = 26;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const getX = (i: number) => padL + (i / Math.max(1, pts.length - 1)) * plotW;
  const getY = (v: number) =>
    padT + plotH - Math.min(1, Math.max(0, v / maxLineVal)) * plotH;

  const currPts = pts
    .map((p, i) => `${getX(i)},${getY(p.currentMonthCumulative)}`)
    .join(' ');
  const prevPts = pts
    .map((p, i) => `${getX(i)},${getY(p.previousMonthCumulative)}`)
    .join(' ');

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white text-stone-900 rounded-3xl max-w-4xl w-full p-6 sm:p-8 space-y-6 max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Barra de controles (no se imprime) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4 no-print">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { key: 'summary', label: 'Resumen y Controles' },
                { key: 'indicators', label: 'UF / USD / EUR / UTM' },
                { key: 'monthlyTrend', label: 'Gráfico Mensual' },
                { key: 'categories', label: 'Barras Categorías' },
                { key: 'accounts', label: 'Cuentas' },
                { key: 'budgets', label: 'Presupuestos' },
                { key: 'obligations', label: 'Pagos Fijos' },
              ] as { key: keyof typeof pdfSections; label: string }[]
            ).map((sec) => (
              <label
                key={sec.key}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-stone-100 px-2.5 py-1.5 rounded-lg cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={pdfSections[sec.key]}
                  onChange={(e) =>
                    setPdfSections((prev) => ({
                      ...prev,
                      [sec.key]: e.target.checked,
                    }))
                  }
                />
                {sec.label}
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Imprimir / Guardar PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-stone-100 text-stone-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cabecera Formal del Reporte PDF */}
        <div className="flex items-center justify-between border-b-2 border-emerald-700 pb-4">
          <div className="flex items-center gap-3">
            <GastitoLogo size={44} />
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                GASTITO 2.0 — Informe Estadístico y Financiero
              </h2>
              <p className="text-xs text-stone-600">
                Usuario Titular:{' '}
                <strong>{preferences.userName?.trim() || 'Usuario Principal'}</strong> ·
                Asistente: {preferences.assistantName || 'Gastito'} · Emisión:{' '}
                {new Date().toISOString().split('T')[0]}
              </p>
            </div>
          </div>
          <div className="text-right font-mono text-xs text-stone-500">
            Reporte Ejecutivo Ordenado
          </div>
        </div>

        {/* 1. Resumen y Controles Estadísticos */}
        {pdfSections.summary && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              1. Resumen del Período y Controles Estadísticos
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
              <div>
                <span className="text-[10px] uppercase text-stone-500 font-bold block">
                  Ingresos
                </span>
                <p className="text-sm font-bold font-mono text-emerald-700">
                  {formatMoney(totalIncome, currencySymbol)}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-stone-500 font-bold block">
                  Gastos Seleccionados
                </span>
                <p className="text-sm font-bold font-mono text-rose-700">
                  {formatMoney(totalExpense, currencySymbol)}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-stone-500 font-bold block">
                  Balance Neto
                </span>
                <p className="text-sm font-bold font-mono text-stone-900">
                  {formatMoney(netBalance, currencySymbol)}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-stone-500 font-bold block">
                  Mes Actual vs Pasado
                </span>
                <p className="text-sm font-bold font-mono text-stone-900">
                  {monthlyComparison.monthOverMonthPct > 0 ? '+' : ''}
                  {monthlyComparison.monthOverMonthPct.toFixed(1)}%
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-stone-500 font-bold block">
                  Desv. Estándar (σ)
                </span>
                <p className="text-sm font-bold font-mono text-stone-900">
                  {formatMoney(globalStats.stdDev, currencySymbol)}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-stone-500 font-bold block">
                  Coef. Variación (CV)
                </span>
                <p className="text-sm font-bold font-mono text-stone-900">
                  {globalStats.cvPct.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 2. Indicadores Económicos (mindicador.cl) */}
        {pdfSections.indicators && indicators && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              2. Indicadores Económicos Oficiales (mindicador.cl)
            </h4>
            <div className="grid grid-cols-4 gap-2.5 bg-stone-50 p-3 rounded-2xl border border-stone-200 text-xs">
              <div>
                <span className="font-bold text-stone-500 block">UF</span>
                <span className="font-mono font-bold text-stone-900">
                  ${indicators.uf.valor.toLocaleString('es-CL')}
                </span>
              </div>
              <div>
                <span className="font-bold text-stone-500 block">Dólar Observado</span>
                <span className="font-mono font-bold text-stone-900">
                  ${indicators.dolar.valor.toLocaleString('es-CL')}
                </span>
              </div>
              <div>
                <span className="font-bold text-stone-500 block">Euro</span>
                <span className="font-mono font-bold text-stone-900">
                  ${indicators.euro.valor.toLocaleString('es-CL')}
                </span>
              </div>
              <div>
                <span className="font-bold text-stone-500 block">UTM</span>
                <span className="font-mono font-bold text-stone-900">
                  ${indicators.utm.valor.toLocaleString('es-CL')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 3. Gráfico de Líneas (Mes Actual vs Mes Pasado) y Tendencia */}
        {pdfSections.monthlyTrend && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              3. Evolución Mensual: {monthlyComparison.currentMonthLabel} (
              {formatMoney(monthlyComparison.currentMonthTotal, currencySymbol)}) vs.{' '}
              {monthlyComparison.previousMonthLabel} (
              {formatMoney(monthlyComparison.previousMonthTotal, currencySymbol)})
            </h4>
            <div className="p-3 rounded-2xl border border-stone-200 bg-white">
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-36">
                <polyline
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  points={prevPts}
                />
                <polyline
                  fill="none"
                  stroke="#047857"
                  strokeWidth="2.8"
                  points={currPts}
                />
                {pts.map((p, i) => {
                  const cx = getX(i);
                  const cy = getY(p.currentMonthCumulative);
                  return (
                    <g key={p.dayLabel}>
                      <circle cx={cx} cy={cy} r="3.5" fill="#047857" />
                      <text
                        x={cx}
                        y={Math.max(10, cy - 6)}
                        textAnchor="middle"
                        fontSize="8"
                        fill="#1C1917"
                      >
                        {p.diffPct > 0 ? `+${p.diffPct}%` : `${p.diffPct}%`}
                      </text>
                      <text
                        x={cx}
                        y={chartH - 6}
                        textAnchor="middle"
                        fontSize="9"
                        fill="#57534E"
                      >
                        {p.dayLabel}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {/* 4. Categorías de Gasto Seleccionadas (Barras y Tabla) */}
        {pdfSections.categories && expenseByCategory.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              4. Ranking y Gráfico de Barras por Categorías Seleccionadas
            </h4>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="py-1.5">Categoría</th>
                  <th className="py-1.5">Proporción Visual</th>
                  <th className="py-1.5 text-right">Mov.</th>
                  <th className="py-1.5 text-right">Desv. Estándar (σ)</th>
                  <th className="py-1.5 text-right">%</th>
                  <th className="py-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {expenseByCategory.map((row) => {
                  const pct =
                    totalExpense > 0 ? (row.total / totalExpense) * 100 : 0;
                  return (
                    <tr key={row.category.id} className="border-b border-stone-100">
                      <td className="py-1.5 font-semibold">{row.category.name}</td>
                      <td className="py-1.5 w-36 pr-3">
                        <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, pct)}%`,
                              backgroundColor: row.category.color,
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-1.5 text-right font-mono">{row.count}</td>
                      <td className="py-1.5 text-right font-mono">
                        {formatMoney(row.stdDev, currencySymbol)}
                      </td>
                      <td className="py-1.5 text-right font-mono">
                        {pct.toFixed(1)}%
                      </td>
                      <td className="py-1.5 text-right font-mono font-bold">
                        {formatMoney(row.total, currencySymbol)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Saldos por Cuenta */}
        {pdfSections.accounts && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              5. Saldos Auditados por Cuenta
            </h4>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="py-1.5">Cuenta</th>
                  <th className="py-1.5">Tipo</th>
                  <th className="py-1.5 text-right">Saldo Actual</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => (
                  <tr key={acc.id} className="border-b border-stone-100">
                    <td className="py-1.5 font-semibold">{acc.name}</td>
                    <td className="py-1.5 text-stone-500">{acc.type}</td>
                    <td className="py-1.5 text-right font-mono font-bold">
                      {formatMoney(
                        calculateAccountBalance(acc, transactions, transfers),
                        currencySymbol
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. Presupuestos y Pagos Fijos */}
        {(pdfSections.budgets || pdfSections.obligations) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {pdfSections.budgets && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  6. Estado de Presupuestos ({budgets.length})
                </h4>
                {budgets.map((b) => (
                  <div
                    key={b.id}
                    className="flex justify-between text-xs border-b border-stone-100 py-1"
                  >
                    <span>{catMap.get(b.categoryId) || 'Categoría'}</span>
                    <span className="font-mono font-bold">
                      Límite: {formatMoney(b.limitAmount, currencySymbol)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {pdfSections.obligations && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  7. Pagos Fijos / Obligaciones ({obligations.length})
                </h4>
                {obligations.map((o) => (
                  <div
                    key={o.id}
                    className="flex justify-between text-xs border-b border-stone-100 py-1"
                  >
                    <span>
                      {o.name} ({o.dueDate})
                    </span>
                    <span className="font-mono font-bold">
                      {formatMoney(o.amount, currencySymbol)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
