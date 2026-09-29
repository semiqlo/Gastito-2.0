import React, { useState, useMemo, useEffect } from 'react';
import {
  AppDatabaseState,
  TransactionType,
} from '../domain/models';
import {
  calculateAccountBalance,
  formatMoney,
} from '../data/localRepository';
import {
  buildMonthlyComparisonAndTrend,
  calculateStatisticalMetrics,
  EconomicIndicatorsData,
} from '../utils/economicIndicators';
import {
  generateAndDownloadPdfReport,
  PdfReportSections,
} from '../utils/pdfReportGenerator';
import { GastitoLogo } from './GastitoLogo';
import { Calendar, Check, Download, X } from 'lucide-react';

interface FormalPdfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dbState: AppDatabaseState;
  initialStartDate: string;
  initialEndDate: string;
  selectedCategoryIds: Set<string>;
  indicators: EconomicIndicatorsData | null;
}

export const FormalPdfReportModal: React.FC<FormalPdfReportModalProps> = ({
  isOpen,
  onClose,
  dbState,
  initialStartDate,
  initialEndDate,
  selectedCategoryIds,
  indicators,
}) => {
  const [pdfStartDate, setPdfStartDate] = useState(initialStartDate);
  const [pdfEndDate, setPdfEndDate] = useState(initialEndDate);
  const [savedNotice, setSavedNotice] = useState(false);

  const [pdfSections, setPdfSections] = useState<PdfReportSections>({
    summary: true,
    indicators: true,
    monthlyTrend: true,
    categories: true,
    accounts: true,
    budgets: true,
    obligations: true,
    debts: true,
  });

  useEffect(() => {
    if (isOpen) {
      setPdfStartDate(initialStartDate);
      setPdfEndDate(initialEndDate);
      setSavedNotice(false);
    }
  }, [isOpen, initialStartDate, initialEndDate]);

  const { accounts, transactions, transfers, budgets, obligations, debts, preferences, categories } =
    dbState;
  const currencySymbol = preferences.currencySymbol || '$';
  const catMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  // Filtrar transacciones según el rango de fechas elegido en el modal de PDF
  const rangeTransactions = useMemo(
    () =>
      transactions.filter(
        (tx) => tx.date >= pdfStartDate && tx.date <= pdfEndDate
      ),
    [transactions, pdfStartDate, pdfEndDate]
  );

  const totalIncome = useMemo(
    () =>
      rangeTransactions
        .filter((t) => t.type === TransactionType.INCOME)
        .reduce((s, t) => s + t.amount, 0),
    [rangeTransactions]
  );

  const selectedRangeExpenses = useMemo(
    () =>
      rangeTransactions.filter(
        (t) =>
          t.type === TransactionType.EXPENSE &&
          selectedCategoryIds.has(t.categoryId)
      ),
    [rangeTransactions, selectedCategoryIds]
  );

  const totalExpense = useMemo(
    () => selectedRangeExpenses.reduce((s, t) => s + t.amount, 0),
    [selectedRangeExpenses]
  );

  const netBalance = totalIncome - totalExpense;

  const globalStats = useMemo(
    () =>
      calculateStatisticalMetrics(selectedRangeExpenses.map((t) => t.amount)),
    [selectedRangeExpenses]
  );

  const monthlyComparison = useMemo(
    () => buildMonthlyComparisonAndTrend(transactions, selectedCategoryIds),
    [transactions, selectedCategoryIds]
  );

  // Desglose completo de categorías de gasto (incluyendo valores en 0 para que las barras siempre existan)
  const categoryBreakdown = useMemo(() => {
    const expCats = categories.filter(
      (c) => !c.isDeleted && c.type !== TransactionType.INCOME
    );
    return expCats
      .map((cat) => {
        const catTxs = rangeTransactions.filter(
          (t) =>
            t.type === TransactionType.EXPENSE && t.categoryId === cat.id
        );
        const amounts = catTxs.map((t) => t.amount);
        const st = calculateStatisticalMetrics(amounts);
        return {
          category: cat,
          total: st.sum,
          count: st.count,
          mean: st.mean,
          stdDev: st.stdDev,
          cvPct: st.cvPct,
          isChecked: selectedCategoryIds.has(cat.id),
        };
      })
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.category.name.localeCompare(b.category.name);
      });
  }, [categories, rangeTransactions, selectedCategoryIds]);

  if (!isOpen) return null;

  const checkedCategoryRows = categoryBreakdown.filter((c) => c.isChecked);
  const displayCategoryRows =
    checkedCategoryRows.length > 0 ? checkedCategoryRows : categoryBreakdown;
  const maxBarVal = Math.max(0, ...displayCategoryRows.map((r) => r.total));

  const pts = monthlyComparison.comparisonPoints;
  const rawMaxLine = Math.max(
    ...pts.map((p) =>
      Math.max(p.currentMonthCumulative, p.previousMonthCumulative)
    ),
    monthlyComparison.monthlyMean + monthlyComparison.monthlyStdDev
  );
  const maxLineVal = rawMaxLine > 0 ? rawMaxLine * 1.15 : 100;

  const chartW = 540;
  const chartH = 155;
  const padL = 48;
  const padR = 20;
  const padT = 20;
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

  const handleSavePdfFile = () => {
    generateAndDownloadPdfReport({
      dbState,
      startDate: pdfStartDate,
      endDate: pdfEndDate,
      periodLabel: `${pdfStartDate} al ${pdfEndDate}`,
      totalIncome,
      totalExpense,
      netBalance,
      categoryBreakdown,
      indicators,
      monthlyComparison,
      sections: pdfSections,
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3500);
  };

  const applyQuickRange = (preset: 'MONTH' | 'LAST_30' | 'YEAR') => {
    const now = new Date();
    const endStr = now.toISOString().split('T')[0];
    if (preset === 'MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0];
      setPdfStartDate(start);
      setPdfEndDate(endStr);
    } else if (preset === 'LAST_30') {
      const start = new Date();
      start.setDate(now.getDate() - 30);
      setPdfStartDate(start.toISOString().split('T')[0]);
      setPdfEndDate(endStr);
    } else if (preset === 'YEAR') {
      setPdfStartDate(`${now.getFullYear()}-01-01`);
      setPdfEndDate(endStr);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white text-stone-900 rounded-3xl max-w-4xl w-full p-5 sm:p-8 space-y-6 max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Panel de Configuración del Informe PDF (Rango de Fechas + Secciones + Botón Guardar PDF) */}
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                Configuración del Informe PDF
              </h3>
              <p className="text-xs text-stone-500">
                Selecciona el rango de fechas y las secciones que deseas incluir al guardar tu informe PDF
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSavePdfFile}
                className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                Guardar Informe PDF (.pdf)
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-stone-200/80 hover:bg-stone-300 text-stone-700"
                aria-label="Cerrar vista previa de PDF"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {savedNotice && (
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-900 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-700" />
              Informe PDF generado y guardado correctamente en tu dispositivo.
            </div>
          )}

          {/* Selector de Rango de Fechas para el PDF */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-stone-200/80">
            <div>
              <label className="block text-[11px] font-bold uppercase text-stone-500 mb-1">
                Fecha Desde (Inicio)
              </label>
              <input
                type="date"
                value={pdfStartDate}
                onChange={(e) => setPdfStartDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-white border border-stone-300 text-xs font-mono font-bold text-stone-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-stone-500 mb-1">
                Fecha Hasta (Término)
              </label>
              <input
                type="date"
                value={pdfEndDate}
                onChange={(e) => setPdfEndDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-white border border-stone-300 text-xs font-mono font-bold text-stone-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-stone-500 mb-1">
                Atajos de Rango
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => applyQuickRange('MONTH')}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-white border border-stone-300 hover:border-emerald-600 text-[11px] font-bold text-stone-700"
                >
                  Este Mes
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickRange('LAST_30')}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-white border border-stone-300 hover:border-emerald-600 text-[11px] font-bold text-stone-700"
                >
                  30 Días
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickRange('YEAR')}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-white border border-stone-300 hover:border-emerald-600 text-[11px] font-bold text-stone-700"
                >
                  Este Año
                </button>
              </div>
            </div>
          </div>

          {/* Checkboxes de secciones del PDF */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-200/80">
            {(
              [
                { key: 'summary', label: 'Resumen y Controles' },
                { key: 'indicators', label: 'UF / USD / EUR / UTM' },
                { key: 'monthlyTrend', label: 'Gráfico de Líneas' },
                { key: 'categories', label: 'Gráfico de Barras' },
                { key: 'accounts', label: 'Cuentas' },
                { key: 'budgets', label: 'Presupuestos' },
                { key: 'obligations', label: 'Pagos Fijos' },
                { key: 'debts', label: 'Deudas' },
              ] as { key: keyof PdfReportSections; label: string }[]
            ).map((sec) => (
              <label
                key={sec.key}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white border border-stone-200 px-2.5 py-1.5 rounded-lg cursor-pointer"
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
                  className="accent-emerald-700"
                />
                {sec.label}
              </label>
            ))}
          </div>
        </div>

        {/* Cabecera Formal del Reporte PDF */}
        <div className="space-y-3 border-b-2 border-emerald-700 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
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
            <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-mono text-xs font-bold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-700" />
              Rango: {pdfStartDate} al {pdfEndDate}
            </div>
          </div>
        </div>

        {/* 1. Resumen y Controles Estadísticos */}
        {pdfSections.summary && (
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              1. Resumen del Período ({pdfStartDate} al {pdfEndDate}) y Controles Estadísticos
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
                  Gastos Rango
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
                  Actual vs Pasado
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-stone-50 p-3 rounded-2xl border border-stone-200 text-xs">
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

        {/* 3. Gráfico de Líneas (Mes Actual vs Mes Pasado, siempre visible incluso en 0) */}
        {pdfSections.monthlyTrend && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              3. Gráfico de Líneas: {monthlyComparison.currentMonthLabel} (
              {formatMoney(monthlyComparison.currentMonthTotal, currencySymbol)}) vs.{' '}
              {monthlyComparison.previousMonthLabel} (
              {formatMoney(monthlyComparison.previousMonthTotal, currencySymbol)}) · Rango: {pdfStartDate} al {pdfEndDate}
            </h4>
            <div className="p-3 rounded-2xl border border-stone-200 bg-white">
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-40">
                {[0, 0.5, 1].map((ratio, idx) => {
                  const gy = padT + plotH * (1 - ratio);
                  const gVal = rawMaxLine > 0 ? Math.round(maxLineVal * ratio) : 0;
                  return (
                    <g key={idx}>
                      <line
                        x1={padL}
                        y1={gy}
                        x2={chartW - padR}
                        y2={gy}
                        stroke="#E7E5E4"
                        strokeWidth="1"
                      />
                      <text
                        x={padL - 5}
                        y={gy + 3}
                        textAnchor="end"
                        fontSize="8"
                        fill="#78716C"
                      >
                        {currencySymbol}
                        {gVal}
                      </text>
                    </g>
                  );
                })}
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
                  const cyPrev = getY(p.previousMonthCumulative);
                  return (
                    <g key={p.dayLabel}>
                      <circle cx={cx} cy={cyPrev} r="3" fill="#F59E0B" />
                      <circle cx={cx} cy={cy} r="3.8" fill="#047857" />
                      <text
                        x={cx}
                        y={Math.max(10, cy - 6)}
                        textAnchor="middle"
                        fontSize="8"
                        fontWeight="bold"
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

        {/* 4. Gráfico de Barras y Tabla por Categorías (Siempre visible incluso si los datos son 0) */}
        {pdfSections.categories && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              4. Gráfico de Barras y Estadísticas por Categoría ({pdfStartDate} al {pdfEndDate})
            </h4>

            {/* Barras verticales siempre visibles aunque el gasto sea $0.00 */}
            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200">
              <div className="flex items-end gap-2.5 h-36 overflow-x-auto pt-4 pb-1 px-2">
                {displayCategoryRows.map((row) => {
                  const pct =
                    totalExpense > 0 ? (row.total / totalExpense) * 100 : 0;
                  const barHeightPct =
                    maxBarVal > 0 && row.total > 0
                      ? Math.max(8, (row.total / maxBarVal) * 100)
                      : 5;
                  return (
                    <div
                      key={row.category.id}
                      className="flex flex-col items-center justify-end h-full min-w-[58px] flex-1"
                    >
                      <span className="text-[9px] font-mono font-bold text-stone-700 mb-1">
                        {pct.toFixed(0)}%
                      </span>
                      <div className="w-full max-w-[36px] bg-stone-200/80 rounded-t-lg flex items-end h-20 overflow-hidden border-b border-stone-300">
                        <div
                          className="w-full rounded-t-lg"
                          style={{
                            height: `${barHeightPct}%`,
                            backgroundColor: row.category.color,
                            opacity: row.total > 0 ? 1 : 0.45,
                          }}
                        />
                      </div>
                      <span className="text-[9px] font-semibold text-stone-700 mt-1 truncate max-w-[64px] text-center">
                        {row.category.name}
                      </span>
                      <span className="text-[9px] font-mono text-stone-500">
                        {formatMoney(row.total, currencySymbol)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="py-1.5">Categoría</th>
                  <th className="py-1.5">Proporción</th>
                  <th className="py-1.5 text-right">Mov.</th>
                  <th className="py-1.5 text-right">Promedio (μ)</th>
                  <th className="py-1.5 text-right">Desv. Est. (σ)</th>
                  <th className="py-1.5 text-right">%</th>
                  <th className="py-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {displayCategoryRows.map((row) => {
                  const pct =
                    totalExpense > 0 ? (row.total / totalExpense) * 100 : 0;
                  return (
                    <tr key={row.category.id} className="border-b border-stone-100">
                      <td className="py-1.5 font-semibold">{row.category.name}</td>
                      <td className="py-1.5 w-28 pr-3">
                        <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(row.total > 0 ? 4 : 0, Math.min(100, pct))}%`,
                              backgroundColor: row.category.color,
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-1.5 text-right font-mono">{row.count}</td>
                      <td className="py-1.5 text-right font-mono">
                        {formatMoney(row.mean, currencySymbol)}
                      </td>
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
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-2 text-stone-400 italic">
                      Sin cuentas registradas ({currencySymbol}0.00)
                    </td>
                  </tr>
                ) : (
                  accounts.map((acc) => (
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
                  ))
                )}
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
                {budgets.length === 0 ? (
                  <p className="text-xs text-stone-400 italic">Sin presupuestos activos.</p>
                ) : (
                  budgets.map((b) => (
                    <div
                      key={b.id}
                      className="flex justify-between text-xs border-b border-stone-100 py-1"
                    >
                      <span>{catMap.get(b.categoryId) || 'Categoría'}</span>
                      <span className="font-mono font-bold">
                        Límite: {formatMoney(b.limitAmount, currencySymbol)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {pdfSections.obligations && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  7. Recordatorios y Cuentas Variables/Fijas ({obligations.length})
                </h4>
                {obligations.length === 0 ? (
                  <p className="text-xs text-stone-400 italic">Sin obligaciones registradas.</p>
                ) : (
                  obligations.map((o) => {
                    const linkedRange = rangeTransactions.filter(
                      (t) =>
                        t.linkedObligationId === o.id &&
                        t.type === TransactionType.EXPENSE
                    );
                    const paidInRange =
                      linkedRange.length > 0
                        ? linkedRange.reduce((s, t) => s + t.amount, 0)
                        : (o.paymentHistory || [])
                            .filter(
                              (p) =>
                                p.date >= pdfStartDate && p.date <= pdfEndDate
                            )
                            .reduce((s, p) => s + p.amountPaid, 0);
                    return (
                      <div
                        key={o.id}
                        className="flex justify-between items-center gap-2 text-xs border-b border-stone-100 py-1"
                      >
                        <span className="truncate">
                          {o.name} ·{' '}
                          <span className="text-stone-500">
                            {o.isVariableAmount ? 'Variable' : 'Fijo'} (Vence {o.dueDate})
                          </span>
                        </span>
                        <span className="font-mono font-bold shrink-0">
                          Ref:{' '}
                          {o.amount > 0
                            ? formatMoney(o.amount, currencySymbol)
                            : 'Var'}{' '}
                          | Pagado: {formatMoney(paidInRange, currencySymbol)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
