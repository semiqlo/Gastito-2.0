import React from 'react';
import {
  Category,
  ObligationStatus,
  RecurringObligation,
  Transaction,
  TransactionType,
} from '../domain/models';
import { formatMoney, triggerHaptic } from '../data/localRepository';
import {
  calculateStatisticalMetrics,
  EconomicIndicatorsData,
  MonthlyComparisonPoint,
  MonthlyTrendSummary,
} from '../utils/economicIndicators';
import { CategoryIcon } from './GastitoLogo';
import {
  Activity,
  BarChart3,
  Calendar,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  Globe,
  RefreshCw,
  Square,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

interface AnalyticsChartsAndIndicatorsProps {
  categories: Category[];
  filteredExpenseTransactions: Transaction[];
  allTransactions: Transaction[];
  obligations?: RecurringObligation[];
  onOpenObligationPayment?: (obligation: RecurringObligation) => void;
  onManageObligations?: () => void;
  selectedCategoryIds: Set<string>;
  onToggleCategoryId: (catId: string) => void;
  onSelectAllCategories: () => void;
  onClearAllCategories: () => void;
  indicators: EconomicIndicatorsData | null;
  loadingIndicators: boolean;
  onRefreshIndicators: () => void;
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
  totalIncomePeriod: number;
  totalExpensePeriod: number;
  startDate: string;
  endDate: string;
  currencySymbol: string;
  hapticEnabled: boolean;
}

export const AnalyticsChartsAndIndicators: React.FC<
  AnalyticsChartsAndIndicatorsProps
> = ({
  categories,
  filteredExpenseTransactions,
  allTransactions,
  obligations = [],
  onOpenObligationPayment,
  onManageObligations,
  selectedCategoryIds,
  onToggleCategoryId,
  onSelectAllCategories,
  onClearAllCategories,
  indicators,
  loadingIndicators,
  onRefreshIndicators,
  monthlyComparison,
  totalIncomePeriod,
  startDate,
  endDate,
  currencySymbol,
  hapticEnabled,
}) => {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const expenseCategories = categories.filter(
    (c) => !c.isDeleted && c.type !== TransactionType.INCOME
  );

  // Filtrar los gastos del período únicamente por las categorías con checkbox activo
  const activeSelectedExpenses = filteredExpenseTransactions.filter((t) =>
    selectedCategoryIds.has(t.categoryId)
  );

  const selectedTotalExpense = activeSelectedExpenses.reduce(
    (s, t) => s + t.amount,
    0
  );

  const selectedStats = calculateStatisticalMetrics(
    activeSelectedExpenses.map((t) => t.amount)
  );

  const savingsRatePct =
    totalIncomePeriod > 0
      ? ((totalIncomePeriod - selectedTotalExpense) / totalIncomePeriod) * 100
      : 0;

  // Agrupación para el Gráfico de Barras por Categoría (incluye categorías en $0.00)
  const categoryBarData = expenseCategories
    .map((cat) => {
      const catTxs = filteredExpenseTransactions.filter(
        (t) => t.categoryId === cat.id
      );
      const total = catTxs.reduce((s, t) => s + t.amount, 0);
      const isChecked = selectedCategoryIds.has(cat.id);
      const stats = calculateStatisticalMetrics(catTxs.map((t) => t.amount));
      return {
        category: cat,
        total: Number(total.toFixed(2)),
        count: catTxs.length,
        isChecked,
        stdDev: stats.stdDev,
        mean: stats.mean,
      };
    })
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.category.name.localeCompare(b.category.name);
    });

  const checkedBarItems = categoryBarData.filter((d) => d.isChecked);
  const visibleBarChartItems =
    checkedBarItems.length > 0 ? checkedBarItems : categoryBarData;

  const maxBarValue = Math.max(
    0,
    ...visibleBarChartItems.map((d) => d.total)
  );

  // Coordenadas para el Gráfico de Líneas SVG (Gasto Actual vs Mes Pasado)
  const pts = monthlyComparison.comparisonPoints;
  const rawMaxLine = Math.max(
    ...pts.map((p) =>
      Math.max(p.currentMonthCumulative, p.previousMonthCumulative)
    ),
    monthlyComparison.monthlyMean + monthlyComparison.monthlyStdDev
  );
  const maxLineVal = rawMaxLine > 0 ? rawMaxLine * 1.15 : 100;

  const chartW = 600;
  const chartH = 210;
  const padLeft = 54;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 34;
  const plotW = chartW - padLeft - padRight;
  const plotH = chartH - padTop - padBottom;

  const getX = (idx: number) =>
    padLeft + (idx / Math.max(1, pts.length - 1)) * plotW;
  const getY = (val: number) =>
    padTop + plotH - Math.min(1, Math.max(0, val / maxLineVal)) * plotH;

  const currentLinePoints = pts
    .map((p, i) => `${getX(i)},${getY(p.currentMonthCumulative)}`)
    .join(' ');
  const prevLinePoints = pts
    .map((p, i) => `${getX(i)},${getY(p.previousMonthCumulative)}`)
    .join(' ');

  const meanY = getY(monthlyComparison.monthlyMean);
  const stdUpperY = getY(
    monthlyComparison.monthlyMean + monthlyComparison.monthlyStdDev
  );
  const stdLowerY = getY(
    Math.max(0, monthlyComparison.monthlyMean - monthlyComparison.monthlyStdDev)
  );

  const formatClpIndicator = (val?: number) => {
    if (val === undefined || val === null) return '---';
    return `$${Math.round(val).toLocaleString('es-CL', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  // Estadística de Recordatorios y Cuentas (Luz, Agua, Gastos Comunes y Pagos Fijos)
  const obligationsStatRows = obligations.map((obl) => {
    const cat = catMap.get(obl.categoryId);
    // Movimientos vinculados explícitamente a este recordatorio
    const linkedAll = allTransactions.filter(
      (t) => t.linkedObligationId === obl.id && t.type === TransactionType.EXPENSE
    );
    const linkedInRange = filteredExpenseTransactions.filter(
      (t) => t.linkedObligationId === obl.id
    );

    // Historial combinado (transacciones vinculadas o historial propio del recordatorio)
    const historyAmounts =
      linkedAll.length > 0
        ? linkedAll.map((t) => t.amount)
        : (obl.paymentHistory || []).map((p) => p.amountPaid);

    const histMetrics = calculateStatisticalMetrics(historyAmounts);

    const periodPaidTotal =
      linkedInRange.length > 0
        ? linkedInRange.reduce((s, t) => s + t.amount, 0)
        : (obl.paymentHistory || [])
            .filter((p) => p.date >= startDate && p.date <= endDate)
            .reduce((s, p) => s + p.amountPaid, 0);

    const periodCount =
      linkedInRange.length > 0
        ? linkedInRange.length
        : (obl.paymentHistory || []).filter(
            (p) => p.date >= startDate && p.date <= endDate
          ).length;

    const lastPaid =
      obl.lastPaidAmount ??
      (linkedAll.length > 0
        ? [...linkedAll].sort((a, b) => b.date.localeCompare(a.date))[0].amount
        : 0);

    const effectivePaidForCompare =
      periodPaidTotal > 0 ? periodPaidTotal : lastPaid;

    const diffFromReference =
      obl.amount > 0 && effectivePaidForCompare > 0
        ? effectivePaidForCompare - obl.amount
        : 0;

    return {
      obligation: obl,
      category: cat,
      isVariable: Boolean(obl.isVariableAmount),
      referenceAmount: obl.amount,
      lastPaid,
      periodPaidTotal,
      periodCount,
      historicalMean: histMetrics.mean,
      historicalStdDev: histMetrics.stdDev,
      historicalCount: histMetrics.count,
      diffFromReference,
    };
  });

  const totalPaidInObligationsRange = obligationsStatRows.reduce(
    (s, r) => s + r.periodPaidTotal,
    0
  );
  const totalPaidVariableRange = obligationsStatRows
    .filter((r) => r.isVariable)
    .reduce((s, r) => s + r.periodPaidTotal, 0);
  const totalDiffVsReference = obligationsStatRows.reduce(
    (s, r) => s + r.diffFromReference,
    0
  );
  const obligationsShareOfExpensePct =
    selectedTotalExpense > 0
      ? (totalPaidInObligationsRange / selectedTotalExpense) * 100
      : 0;

  return (
    <div className="space-y-5">
      {/* 1. INDICADORES ECONÓMICOS EN TIEMPO REAL (mindicador.cl) */}
      <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-stone-900 dark:text-zinc-100">
                  Indicadores Económicos en Tiempo Real
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold">
                  mindicador.cl
                </span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                Valores oficiales de UF, Dólar Observado, Euro y UTM actualizados
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={loadingIndicators}
            onClick={() => {
              triggerHaptic(hapticEnabled, 12);
              onRefreshIndicators();
            }}
            className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-xs font-bold text-stone-700 dark:text-zinc-300 flex items-center gap-1.5"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loadingIndicators ? 'animate-spin' : ''}`}
            />
            Actualizar
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            {
              code: 'UF',
              title: 'Unidad de Fomento',
              value: indicators?.uf.valor,
              date: indicators?.uf.fecha,
              badge: 'UF',
              color: 'text-emerald-700 dark:text-emerald-400',
            },
            {
              code: 'USD',
              title: 'Dólar Observado',
              value: indicators?.dolar.valor,
              date: indicators?.dolar.fecha,
              badge: 'USD',
              color: 'text-sky-700 dark:text-sky-400',
            },
            {
              code: 'EUR',
              title: 'Euro',
              value: indicators?.euro.valor,
              date: indicators?.euro.fecha,
              badge: 'EUR',
              color: 'text-indigo-700 dark:text-indigo-400',
            },
            {
              code: 'UTM',
              title: 'Unidad Trib. Mensual',
              value: indicators?.utm.valor,
              date: indicators?.utm.fecha,
              badge: 'UTM',
              color: 'text-amber-700 dark:text-amber-400',
            },
          ].map((ind) => (
            <div
              key={ind.code}
              className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-800/60 border border-stone-200/60 dark:border-zinc-800 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-500 dark:text-zinc-400 truncate">
                  {ind.title}
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white dark:bg-zinc-900 text-stone-700 dark:text-zinc-300">
                  {ind.badge}
                </span>
              </div>
              <p
                className={`text-base font-extrabold font-mono tabular-nums mt-1 ${ind.color}`}
              >
                {formatClpIndicator(ind.value)}
              </p>
              <span className="text-[10px] text-stone-400 font-mono mt-0.5">
                {ind.date ? ind.date.split('T')[0] : 'Al día'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. CONTROLES ECONÓMICOS Y DESVIACIÓN ESTÁNDAR */}
      <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-stone-900 dark:text-zinc-100">
              Controles Económicos y Estadísticos (Categorías Seleccionadas)
            </h3>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-stone-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 dark:bg-zinc-800">
              <Calendar className="w-3 h-3 text-emerald-600" />
              {startDate} al {endDate}
            </span>
            <span>n = {selectedStats.count} mov.</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-800/60">
            <span className="text-[10px] font-bold uppercase text-stone-400 block">
              Mes Actual vs Pasado
            </span>
            <p
              className={`text-sm font-extrabold font-mono tabular-nums mt-1 flex items-center gap-1 ${
                monthlyComparison.monthOverMonthPct <= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {monthlyComparison.monthOverMonthPct > 0 ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              {monthlyComparison.monthOverMonthPct > 0 ? '+' : ''}
              {monthlyComparison.monthOverMonthPct.toFixed(1)}%
            </p>
            <span className="text-[10px] text-stone-400 font-mono">
              Ant: {formatMoney(monthlyComparison.previousMonthTotal, currencySymbol)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-800/60">
            <span className="text-[10px] font-bold uppercase text-stone-400 block">
              Desviación Estándar (σ)
            </span>
            <p className="text-sm font-extrabold font-mono tabular-nums text-stone-900 dark:text-zinc-100 mt-1">
              {formatMoney(selectedStats.stdDev, currencySymbol)}
            </p>
            <span className="text-[10px] text-stone-400 font-mono">
              Mensual σ: {formatMoney(monthlyComparison.monthlyStdDev, currencySymbol)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-800/60">
            <span className="text-[10px] font-bold uppercase text-stone-400 block">
              Coef. Variación (CV)
            </span>
            <p className="text-sm font-extrabold font-mono tabular-nums text-stone-900 dark:text-zinc-100 mt-1">
              {selectedStats.cvPct.toFixed(1)}%
            </p>
            <span className="text-[10px] text-stone-400">
              {selectedStats.cvPct < 35 ? 'Dispersión controlada' : 'Dispersión alta'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-800/60">
            <span className="text-[10px] font-bold uppercase text-stone-400 block">
              Promedio (μ) / Mediana
            </span>
            <p className="text-sm font-extrabold font-mono tabular-nums text-stone-900 dark:text-zinc-100 mt-1">
              {formatMoney(selectedStats.mean, currencySymbol)}
            </p>
            <span className="text-[10px] text-stone-400 font-mono">
              Med: {formatMoney(selectedStats.median, currencySymbol)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-800/60">
            <span className="text-[10px] font-bold uppercase text-stone-400 block">
              Ritmo Diario (Burn Rate)
            </span>
            <p className="text-sm font-extrabold font-mono tabular-nums text-stone-900 dark:text-zinc-100 mt-1">
              {formatMoney(monthlyComparison.dailyBurnRate, currencySymbol)}/día
            </p>
            <span className="text-[10px] text-stone-400 font-mono">
              Proy: {formatMoney(monthlyComparison.projectedMonthEnd, currencySymbol)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-800/60">
            <span className="text-[10px] font-bold uppercase text-stone-400 block">
              Tasa de Ahorro Neto
            </span>
            <p
              className={`text-sm font-extrabold font-mono tabular-nums mt-1 ${
                savingsRatePct >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {savingsRatePct.toFixed(1)}%
            </p>
            <span className="text-[10px] text-stone-400">
              Sobre ingresos del período
            </span>
          </div>
        </div>
      </div>

      {/* 3. GRÁFICO DE LÍNEAS: GASTO MES ACTUAL VS MES PASADO + TENDENCIA MENSUAL */}
      <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-zinc-100">
              Gráfico de Líneas: Gasto Acumulado ({monthlyComparison.currentMonthLabel} vs.{' '}
              {monthlyComparison.previousMonthLabel})
            </h3>
            <p className="text-xs text-stone-500 dark:text-zinc-400">
              Rango activo: <strong>{startDate}</strong> al <strong>{endDate}</strong> · Porcentajes por tramo, media mensual (μ) y desviación estándar (±1σ)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
              <span className="w-3 h-1 rounded-full bg-emerald-600 inline-block" />
              Actual ({formatMoney(monthlyComparison.currentMonthTotal, currencySymbol)})
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
              <span className="w-3 h-1 rounded-full bg-amber-500 inline-block" />
              Mes Pasado ({formatMoney(monthlyComparison.previousMonthTotal, currencySymbol)})
            </span>
          </div>
        </div>

        {/* SVG Line Chart (Siempre visible incluso con datos en 0) */}
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full h-52 min-w-[460px]"
            role="img"
            aria-label="Gráfico de líneas de gasto actual vs mes pasado"
          >
            {/* Banda de Desviación Estándar (μ ± σ) */}
            {monthlyComparison.monthlyStdDev > 0 && (
              <rect
                x={padLeft}
                y={stdUpperY}
                width={plotW}
                height={Math.max(2, stdLowerY - stdUpperY)}
                fill="#10B981"
                fillOpacity="0.08"
              />
            )}

            {/* Línea de Promedio Mensual (μ) */}
            <line
              x1={padLeft}
              y1={meanY}
              x2={chartW - padRight}
              y2={meanY}
              stroke="#64748B"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <text
              x={chartW - padRight - 4}
              y={Math.max(12, meanY - 5)}
              textAnchor="end"
              className="fill-stone-400 text-[9px] font-mono"
            >
              μ = {formatMoney(monthlyComparison.monthlyMean, currencySymbol)} (±σ{' '}
              {formatMoney(monthlyComparison.monthlyStdDev, currencySymbol)})
            </text>

            {/* Guías horizontales */}
            {[0, 0.5, 1].map((ratio, idx) => {
              const yPos = padTop + plotH * (1 - ratio);
              const val = rawMaxLine > 0 ? maxLineVal * ratio : 0;
              return (
                <g key={idx}>
                  <line
                    x1={padLeft}
                    y1={yPos}
                    x2={chartW - padRight}
                    y2={yPos}
                    stroke="currentColor"
                    className="text-stone-200 dark:text-zinc-800"
                    strokeWidth="1"
                  />
                  <text
                    x={padLeft - 6}
                    y={yPos + 3}
                    textAnchor="end"
                    className="fill-stone-400 text-[9px] font-mono"
                  >
                    {currencySymbol}
                    {Math.round(val)}
                  </text>
                </g>
              );
            })}

            {/* Línea Mes Pasado (Punteada Ámbar) */}
            <polyline
              fill="none"
              stroke="#F59E0B"
              strokeWidth="2.5"
              strokeDasharray="5 4"
              points={prevLinePoints}
            />

            {/* Línea Mes Actual (Sólida Esmeralda) */}
            <polyline
              fill="none"
              stroke="#059669"
              strokeWidth="3"
              points={currentLinePoints}
            />

            {/* Puntos y etiquetas de porcentaje en cada tramo */}
            {pts.map((p, idx) => {
              const cx = getX(idx);
              const cyCurr = getY(p.currentMonthCumulative);
              const cyPrev = getY(p.previousMonthCumulative);
              return (
                <g key={p.dayLabel}>
                  <circle
                    cx={cx}
                    cy={cyPrev}
                    r="3.5"
                    className="fill-amber-500"
                  />
                  <circle
                    cx={cx}
                    cy={cyCurr}
                    r="4.5"
                    className="fill-emerald-600 stroke-white dark:stroke-zinc-900"
                    strokeWidth="1.5"
                  />
                  {/* Etiqueta de variación porcentual sobre el punto */}
                  <text
                    x={cx}
                    y={Math.max(12, cyCurr - 8)}
                    textAnchor="middle"
                    className="fill-stone-700 dark:fill-zinc-200 text-[9px] font-mono font-bold"
                  >
                    {p.diffPct > 0 ? `+${p.diffPct}%` : `${p.diffPct}%`}
                  </text>
                  {/* Etiqueta eje X */}
                  <text
                    x={cx}
                    y={chartH - 10}
                    textAnchor="middle"
                    className="fill-stone-500 dark:fill-zinc-400 text-[10px] font-semibold"
                  >
                    {p.dayLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Tabla compacta de Tendencia Mensual (Últimos 6 Meses) */}
        <div className="pt-3 border-t border-stone-100 dark:border-zinc-800">
          <span className="text-[11px] font-bold uppercase text-stone-400 block mb-2">
            Evolución y Tendencia Mensual (Últimos 6 Meses)
          </span>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {monthlyComparison.sixMonthTrend.map((m) => (
              <div
                key={m.monthKey}
                className="p-2.5 rounded-xl bg-stone-50 dark:bg-zinc-800/50 border border-stone-200/50 dark:border-zinc-800 text-center"
              >
                <span className="text-[11px] font-bold text-stone-600 dark:text-zinc-300 block">
                  {m.label}
                </span>
                <span className="text-xs font-extrabold font-mono tabular-nums text-stone-900 dark:text-zinc-100 block mt-0.5">
                  {formatMoney(m.expense, currencySymbol)}
                </span>
                <span
                  className={`text-[10px] font-mono font-semibold ${
                    m.variationFromPrevPct <= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {m.variationFromPrevPct > 0 ? '+' : ''}
                  {m.variationFromPrevPct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. GRÁFICO DE BARRAS CON CHECKBOXES PARA INCLUIR / EXCLUIR CATEGORÍAS (SIEMPRE VISIBLE INCLUSO EN 0) */}
      <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-stone-900 dark:text-zinc-100">
                Gráfico de Barras por Categoría de Gasto ({startDate} al {endDate})
              </h3>
            </div>
            <p className="text-xs text-stone-500 dark:text-zinc-400">
              Marca o desmarca las casillas para incluir o excluir categorías en la estadística y en el informe PDF
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(hapticEnabled, 10);
                onSelectAllCategories();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 text-[11px] font-bold text-stone-700 dark:text-zinc-300"
            >
              Marcar todas
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(hapticEnabled, 10);
                onClearAllCategories();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 text-[11px] font-bold text-stone-700 dark:text-zinc-300"
            >
              Desmarcar todas
            </button>
          </div>
        </div>

        {/* Gráfico de Barras Visual (Siempre renderizado aunque los valores sean 0) */}
        <div className="p-4 rounded-2xl bg-stone-50 dark:bg-zinc-800/40 border border-stone-200/60 dark:border-zinc-800">
          <div className="flex items-end gap-3 h-44 overflow-x-auto pb-2 pt-6 px-2">
            {visibleBarChartItems.map((item) => {
              const heightPct =
                maxBarValue > 0 && item.total > 0
                  ? Math.max(8, (item.total / maxBarValue) * 100)
                  : 4;
              const sharePct =
                selectedTotalExpense > 0 && item.isChecked
                  ? (item.total / selectedTotalExpense) * 100
                  : 0;
              return (
                <div
                  key={item.category.id}
                  className="flex flex-col items-center justify-end h-full min-w-[68px] flex-1 group"
                >
                  <span className="text-[10px] font-mono font-bold text-stone-700 dark:text-zinc-200 mb-1">
                    {sharePct.toFixed(1)}%
                  </span>
                  <div className="w-full max-w-[44px] bg-stone-200/70 dark:bg-zinc-800 rounded-t-xl flex items-end h-28 overflow-hidden border-b border-stone-300 dark:border-zinc-700">
                    <div
                      className="w-full rounded-t-xl transition-all duration-300"
                      style={{
                        height: `${heightPct}%`,
                        backgroundColor: item.category.color,
                        opacity: item.total > 0 ? 1 : 0.45,
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-stone-700 dark:text-zinc-300 mt-1.5 truncate max-w-[76px] text-center">
                    {item.category.name}
                  </span>
                  <span className="text-[10px] font-mono text-stone-500 dark:text-zinc-400">
                    {formatMoney(item.total, currencySymbol)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lista de Categorías con Checkboxes para activar/desactivar en la estadística */}
        <div className="space-y-2">
          {categoryBarData.map((item) => {
            const sharePct =
              item.isChecked && selectedTotalExpense > 0
                ? (item.total / selectedTotalExpense) * 100
                : 0;

            return (
              <div
                key={item.category.id}
                onClick={() => {
                  triggerHaptic(hapticEnabled, 8);
                  onToggleCategoryId(item.category.id);
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  item.isChecked
                    ? 'bg-white dark:bg-zinc-900 border-stone-200/90 dark:border-zinc-800'
                    : 'bg-stone-100/60 dark:bg-zinc-800/30 border-stone-200/40 dark:border-zinc-800/40 opacity-55'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic(hapticEnabled, 8);
                        onToggleCategoryId(item.category.id);
                      }}
                      className="text-emerald-700 dark:text-emerald-400 shrink-0"
                      aria-label={`Incluir ${item.category.name} en estadísticas`}
                    >
                      {item.isChecked ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4 text-stone-400" />
                      )}
                    </button>

                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: item.category.color }}
                    >
                      <CategoryIcon
                        iconName={item.category.icon}
                        className="w-3.5 h-3.5"
                      />
                    </span>

                    <div className="min-w-0">
                      <span className="font-bold text-stone-800 dark:text-zinc-200 truncate block">
                        {item.category.name}
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        {item.count} mov. · Prom: {formatMoney(item.mean, currencySymbol)} · σ:{' '}
                        {formatMoney(item.stdDev, currencySymbol)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 font-mono tabular-nums shrink-0">
                    <span className="font-bold text-stone-900 dark:text-zinc-100">
                      {formatMoney(item.total, currencySymbol)}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 w-12 text-right">
                      {item.isChecked ? `${sharePct.toFixed(1)}%` : 'Excluida'}
                    </span>
                  </div>
                </div>

                {item.isChecked && (
                  <div className="h-2 w-full bg-stone-100 dark:bg-zinc-800 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, sharePct)}%`,
                        backgroundColor: item.category.color,
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. ESTADÍSTICA DE RECORDATORIOS Y CUENTAS (LUZ, AGUA, GASTOS COMUNES Y PAGOS FIJOS) */}
      <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-stone-900 dark:text-zinc-100">
                Estadística de Recordatorios y Cuentas Variables / Fijas ({startDate} al {endDate})
              </h3>
            </div>
            <p className="text-xs text-stone-500 dark:text-zinc-400">
              Evalúa cuánto pagaste realmente en cuentas como Luz, Agua, Gastos Comunes o Arriendo frente a su monto estimado y su promedio histórico
            </p>
          </div>

          {onManageObligations && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(hapticEnabled, 12);
                onManageObligations();
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              <CalendarClock className="w-3.5 h-3.5" />
              Gestionar / Agregar Cuentas
            </button>
          )}
        </div>

        {/* KPIs de Cuentas y Recordatorios */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="min-w-0 overflow-hidden p-3 rounded-xl bg-stone-50 dark:bg-zinc-800/60 border border-stone-200/60 dark:border-zinc-800">
            <span className="text-[10px] font-bold uppercase text-stone-400 block truncate">
              Pagado en Cuentas (Rango)
            </span>
            <p className="text-sm font-extrabold font-mono tabular-nums text-stone-900 dark:text-zinc-100 mt-1 break-all">
              {formatMoney(totalPaidInObligationsRange, currencySymbol)}
            </p>
            <span className="text-[10px] text-stone-400 font-mono">
              {obligationsShareOfExpensePct.toFixed(1)}% del gasto del período
            </span>
          </div>

          <div className="min-w-0 overflow-hidden p-3 rounded-xl bg-stone-50 dark:bg-zinc-800/60 border border-stone-200/60 dark:border-zinc-800">
            <span className="text-[10px] font-bold uppercase text-stone-400 block truncate">
              Cuentas Monto Variable
            </span>
            <p className="text-sm font-extrabold font-mono tabular-nums text-amber-700 dark:text-amber-400 mt-1 break-all">
              {formatMoney(totalPaidVariableRange, currencySymbol)}
            </p>
            <span className="text-[10px] text-stone-400">
              {obligationsStatRows.filter((r) => r.isVariable).length} cuentas variables (Luz, Agua, GGCC...)
            </span>
          </div>

          <div className="min-w-0 overflow-hidden p-3 rounded-xl bg-stone-50 dark:bg-zinc-800/60 border border-stone-200/60 dark:border-zinc-800">
            <span className="text-[10px] font-bold uppercase text-stone-400 block truncate">
              Diferencia Real vs. Referencial
            </span>
            <p
              className={`text-sm font-extrabold font-mono tabular-nums mt-1 break-all ${
                totalDiffVsReference > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : totalDiffVsReference < 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-stone-900 dark:text-zinc-100'
              }`}
            >
              {totalDiffVsReference > 0 ? '+' : ''}
              {formatMoney(totalDiffVsReference, currencySymbol)}
            </p>
            <span className="text-[10px] text-stone-400">
              {totalDiffVsReference > 0
                ? 'Pagaste más de lo estimado'
                : totalDiffVsReference < 0
                ? 'Ahorro frente a lo estimado'
                : 'Igual a lo referencial'}
            </span>
          </div>

          <div className="min-w-0 overflow-hidden p-3 rounded-xl bg-stone-50 dark:bg-zinc-800/60 border border-stone-200/60 dark:border-zinc-800">
            <span className="text-[10px] font-bold uppercase text-stone-400 block truncate">
              Total Recordatorios Activos
            </span>
            <p className="text-sm font-extrabold font-mono tabular-nums text-stone-900 dark:text-zinc-100 mt-1">
              {obligationsStatRows.length} cuentas
            </p>
            <span className="text-[10px] text-stone-400">
              {
                obligationsStatRows.filter(
                  (r) => r.obligation.status !== ObligationStatus.PAID && r.periodPaidTotal === 0
                ).length
              }{' '}
              pendientes de pago
            </span>
          </div>
        </div>

        {/* Desglose por cada Recordatorio / Cuenta (Luz, Agua, Gastos Comunes, Arriendo, etc.) */}
        {obligationsStatRows.length === 0 ? (
          <div className="p-4 rounded-xl bg-stone-50 dark:bg-zinc-800/40 text-center text-xs text-stone-500">
            Aún no tienes recordatorios de cuentas configurados. Usa el botón superior para agregar cuentas de Luz, Agua, Gastos Comunes o Arriendo.
          </div>
        ) : (
          <div className="space-y-2.5">
            {obligationsStatRows.map((row) => {
              const {
                obligation,
                category,
                isVariable,
                referenceAmount,
                lastPaid,
                periodPaidTotal,
                historicalMean,
                historicalStdDev,
                diffFromReference,
              } = row;

              const displayedPaid =
                periodPaidTotal > 0 ? periodPaidTotal : lastPaid;
              const maxCompare = Math.max(
                1,
                referenceAmount,
                displayedPaid,
                historicalMean
              );
              const refBarPct =
                referenceAmount > 0
                  ? Math.min(100, (referenceAmount / maxCompare) * 100)
                  : 4;
              const paidBarPct =
                displayedPaid > 0
                  ? Math.min(100, (displayedPaid / maxCompare) * 100)
                  : 4;

              return (
                <div
                  key={obligation.id}
                  className="p-3.5 rounded-xl bg-stone-50/70 dark:bg-zinc-800/40 border border-stone-200/70 dark:border-zinc-800 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: category?.color || '#047857' }}
                      >
                        <CategoryIcon
                          iconName={category?.icon || 'Zap'}
                          className="w-4 h-4"
                        />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold text-stone-900 dark:text-zinc-100 truncate">
                            {obligation.name}
                          </span>
                          <span className="text-[10px] font-semibold text-stone-500 dark:text-zinc-400">
                            · {isVariable ? 'Monto Variable (Cuenta)' : 'Monto Fijo'} · Vence{' '}
                            {obligation.dueDate}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-stone-500 dark:text-zinc-400 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span>
                            Referencial:{' '}
                            <strong>
                              {referenceAmount > 0
                                ? formatMoney(referenceAmount, currencySymbol)
                                : 'Variable'}
                            </strong>
                          </span>
                          <span>
                            Pagado en rango:{' '}
                            <strong className="text-stone-900 dark:text-zinc-100">
                              {formatMoney(periodPaidTotal, currencySymbol)}
                            </strong>
                          </span>
                          <span>
                            Último pago:{' '}
                            <strong>
                              {lastPaid > 0
                                ? formatMoney(lastPaid, currencySymbol)
                                : 'Pendiente'}
                            </strong>
                          </span>
                          <span>
                            Prom (μ):{' '}
                            <strong>
                              {formatMoney(historicalMean, currencySymbol)}
                            </strong>
                          </span>
                          <span>
                            Desv (σ):{' '}
                            <strong>
                              {formatMoney(historicalStdDev, currencySymbol)}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {referenceAmount > 0 && displayedPaid > 0 && (
                        <span
                          className={`text-xs font-mono font-bold ${
                            diffFromReference > 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : diffFromReference < 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-stone-500'
                          }`}
                        >
                          {diffFromReference > 0 ? '+' : ''}
                          {formatMoney(diffFromReference, currencySymbol)}
                        </span>
                      )}

                      {onOpenObligationPayment && (
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic(hapticEnabled, 15);
                            onOpenObligationPayment(obligation);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Ingresar Monto Pagado
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Barras comparativas: Referencial vs Monto Real Pagado */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center gap-2 text-[10px] font-mono text-stone-500">
                      <span className="w-20 shrink-0">Referencial:</span>
                      <div className="flex-1 h-1.5 bg-stone-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-stone-400 dark:bg-zinc-500 rounded-full"
                          style={{ width: `${refBarPct}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-stone-700 dark:text-zinc-300">
                      <span className="w-20 shrink-0 font-bold">Real Pagado:</span>
                      <div className="flex-1 h-2 bg-stone-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${paidBarPct}%`,
                            backgroundColor: category?.color || '#059669',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
