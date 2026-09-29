import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  AppDatabaseState,
  Budget,
  BudgetPeriod,
  ObligationStatus,
  RecurrenceFrequency,
  RecurringObligation,
  RenewalRule,
  TransactionType,
} from '../domain/models';
import {
  formatMoney,
  triggerHaptic,
} from '../data/localRepository';
import { exportToMultiSheetExcel } from '../utils/exportManager';
import {
  buildMonthlyComparisonAndTrend,
  calculateStatisticalMetrics,
  EconomicIndicatorsData,
  fetchMindicadorData,
} from '../utils/economicIndicators';
import { generateAndDownloadPdfReport } from '../utils/pdfReportGenerator';
import { AnalyticsChartsAndIndicators } from './AnalyticsChartsAndIndicators';
import { FormalPdfReportModal } from './FormalPdfReportModal';
import { CategoryIcon } from './GastitoLogo';
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  Plus,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Trash2,
  X,
} from 'lucide-react';

interface SummaryTabProps {
  dbState: AppDatabaseState;
  onSaveBudget: (budget: Omit<Budget, 'id' | 'history'>, existingId?: string) => void;
  onCloseBudgetPeriod: (budgetId: string, spentAmount: number) => void;
  onDeleteBudget: (budgetId: string) => void;
  onSaveObligation: (obligation: Omit<RecurringObligation, 'id'>, existingId?: string) => void;
  onPayObligation: (obligation: RecurringObligation) => void;
  onDeleteObligation: (obligationId: string) => void;
}

type PeriodFilter = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM';
type SubSection = 'ANALYTICS' | 'BUDGETS' | 'RECURRING' | 'EXPORT';

export const SummaryTab: React.FC<SummaryTabProps> = ({
  dbState,
  onSaveBudget,
  onCloseBudgetPeriod,
  onDeleteBudget,
  onSaveObligation,
  onPayObligation,
  onDeleteObligation,
}) => {
  const {
    categories,
    accounts,
    transactions,
    budgets,
    obligations,
    preferences,
  } = dbState;
  const currencySymbol = preferences.currencySymbol;
  const hapticEnabled = preferences.hapticFeedbackEnabled;

  const [activeSubSection, setActiveSubSection] = useState<SubSection>('ANALYTICS');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('MONTH');
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Categorías seleccionadas con checkbox para incluir/excluir en la estadística
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(() => {
    const validIds = categories
      .filter((c) => !c.isDeleted)
      .map((c) => c.id);
    return new Set(validIds);
  });

  // Sincronizar nuevas categorías si se agregan
  useEffect(() => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      categories.forEach((c) => {
        if (!c.isDeleted && !next.has(c.id) && prev.size === 0) {
          next.add(c.id);
        }
      });
      return next;
    });
  }, [categories]);

  // Indicadores económicos en tiempo real desde mindicador.cl
  const [indicators, setIndicators] = useState<EconomicIndicatorsData | null>(null);
  const [loadingIndicators, setLoadingIndicators] = useState<boolean>(false);

  const loadIndicators = useCallback(async () => {
    setLoadingIndicators(true);
    try {
      const data = await fetchMindicadorData();
      setIndicators(data);
    } finally {
      setLoadingIndicators(false);
    }
  }, []);

  useEffect(() => {
    loadIndicators();
  }, [loadIndicators]);

  const [selectedStatCatId, setSelectedStatCatId] = useState<string>(
    categories.find((c) => !c.isDeleted)?.id || ''
  );

  // Modal Presupuesto
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [bgtCategoryId, setBgtCategoryId] = useState(
    categories.find((c) => !c.isDeleted && c.type !== TransactionType.INCOME)?.id || ''
  );
  const [bgtLimit, setBgtLimit] = useState('');
  const [bgtPeriod, setBgtPeriod] = useState<BudgetPeriod>(BudgetPeriod.MONTHLY);
  const [bgtStartDate, setBgtStartDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Modal Pago Recurrente (Obligación)
  const [showObligationModal, setShowObligationModal] = useState(false);
  const [oblName, setOblName] = useState('');
  const [oblCategoryId, setOblCategoryId] = useState(
    categories.find((c) => !c.isDeleted && c.type !== TransactionType.INCOME)?.id || ''
  );
  const [oblAmount, setOblAmount] = useState('');
  const [oblAccountId, setOblAccountId] = useState(accounts[0]?.id || '');
  const [oblDueDate, setOblDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [oblFrequency, setOblFrequency] = useState<RecurrenceFrequency>(RecurrenceFrequency.MONTHLY);
  const [oblRenewalRule, setOblRenewalRule] = useState<RenewalRule>(
    RenewalRule.ONLY_IF_PREVIOUS_PAID
  );
  const [oblNotify, setOblNotify] = useState(true);

  // Modal Configurar y Guardar Informe PDF
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  // Cálculo explícito del Rango de Fechas activo (startDate y endDate)
  const activeDateRange = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (periodFilter === 'DAY') {
      return { start: todayStr, end: todayStr, label: 'Hoy' };
    }
    if (periodFilter === 'WEEK') {
      const weekAgo = new Date();
      weekAgo.setDate(today.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];
      return { start: weekAgoStr, end: todayStr, label: 'Últimos 7 días' };
    }
    if (periodFilter === 'MONTH') {
      const firstOfMonth = `${todayStr.slice(0, 7)}-01`;
      return { start: firstOfMonth, end: todayStr, label: 'Mes actual' };
    }
    if (periodFilter === 'YEAR') {
      const firstOfYear = `${todayStr.slice(0, 4)}-01-01`;
      return { start: firstOfYear, end: todayStr, label: 'Año actual' };
    }
    return {
      start: customStart,
      end: customEnd,
      label: 'Rango personalizado',
    };
  }, [periodFilter, customStart, customEnd]);

  // Filtrado de transacciones por el rango de fechas activo
  const filteredTransactions = useMemo(() => {
    return transactions.filter(
      (tx) => tx.date >= activeDateRange.start && tx.date <= activeDateRange.end
    );
  }, [transactions, activeDateRange]);

  const filteredExpenseTransactions = useMemo(
    () =>
      filteredTransactions.filter((t) => t.type === TransactionType.EXPENSE),
    [filteredTransactions]
  );

  const totalIncome = useMemo(
    () =>
      filteredTransactions
        .filter((t) => t.type === TransactionType.INCOME)
        .reduce((s, t) => s + t.amount, 0),
    [filteredTransactions]
  );

  // Gastos del período considerando las categorías marcadas en el checkbox
  const totalExpense = useMemo(
    () =>
      filteredExpenseTransactions
        .filter((t) => selectedCategoryIds.has(t.categoryId))
        .reduce((s, t) => s + t.amount, 0),
    [filteredExpenseTransactions, selectedCategoryIds]
  );

  const netBalance = totalIncome - totalExpense;

  // Curva comparativa Mes Actual vs Mes Pasado y tendencia de 6 meses
  const monthlyComparison = useMemo(
    () => buildMonthlyComparisonAndTrend(transactions, selectedCategoryIds),
    [transactions, selectedCategoryIds]
  );

  const handleToggleCategoryStat = (catId: string) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  const handleSelectAllCategories = () => {
    setSelectedCategoryIds(
      new Set(categories.filter((c) => !c.isDeleted).map((c) => c.id))
    );
  };

  const handleClearAllCategories = () => {
    setSelectedCategoryIds(new Set());
  };

  // Análisis estadístico temporal para una categoría individual
  const categoryStats = useMemo(() => {
    const txs = transactions
      .filter(
        (t) =>
          t.categoryId === selectedStatCatId &&
          t.date >= activeDateRange.start &&
          t.date <= activeDateRange.end
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    const amounts = txs.map((t) => t.amount);
    const metrics = calculateStatisticalMetrics(amounts);

    if (txs.length === 0) {
      return {
        count: 0,
        total: 0,
        avg: 0,
        min: 0,
        max: 0,
        stdDev: 0,
        variationPct: 0,
        trendLabel: 'Sin movimientos en rango ($0)',
      };
    }

    let variationPct = 0;
    let trendLabel = 'Estable';
    if (amounts.length >= 2) {
      const prev = amounts[amounts.length - 2];
      const last = amounts[amounts.length - 1];
      if (prev > 0) {
        variationPct = ((last - prev) / prev) * 100;
      }
      if (variationPct > 8) trendLabel = 'En aumento';
      else if (variationPct < -8) trendLabel = 'En descenso';
    }

    return {
      count: metrics.count,
      total: metrics.sum,
      avg: metrics.mean,
      min: metrics.min,
      max: metrics.max,
      stdDev: metrics.stdDev,
      variationPct,
      trendLabel,
    };
  }, [transactions, selectedStatCatId, activeDateRange]);

  // Descarga directa de PDF desde cualquier vista con el rango de fechas actual
  const handleDirectSavePdf = () => {
    triggerHaptic(hapticEnabled, 20);
    const expCats = categories.filter(
      (c) => !c.isDeleted && c.type !== TransactionType.INCOME
    );
    const categoryBreakdown = expCats
      .map((cat) => {
        const catTxs = filteredExpenseTransactions.filter(
          (t) => t.categoryId === cat.id
        );
        const st = calculateStatisticalMetrics(catTxs.map((t) => t.amount));
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

    generateAndDownloadPdfReport({
      dbState,
      startDate: activeDateRange.start,
      endDate: activeDateRange.end,
      periodLabel: activeDateRange.label,
      totalIncome,
      totalExpense,
      netBalance,
      categoryBreakdown,
      indicators,
      monthlyComparison,
      sections: {
        summary: true,
        indicators: true,
        monthlyTrend: true,
        categories: true,
        accounts: true,
        budgets: true,
        obligations: true,
        debts: true,
      },
    });
  };

  const handleCreateBudgetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(bgtLimit);
    if (!bgtCategoryId || Number.isNaN(num) || num <= 0) return;

    triggerHaptic(hapticEnabled, [15, 30]);
    onSaveBudget({
      categoryId: bgtCategoryId,
      limitAmount: num,
      period: bgtPeriod,
      startDate: bgtStartDate,
      isActive: true,
    });
    setBgtLimit('');
    setShowBudgetModal(false);
  };

  const handleCreateObligationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(oblAmount);
    if (!oblName.trim() || Number.isNaN(num) || num <= 0 || !oblCategoryId || !oblAccountId)
      return;

    triggerHaptic(hapticEnabled, [15, 30]);
    onSaveObligation({
      name: oblName.trim(),
      categoryId: oblCategoryId,
      amount: num,
      accountId: oblAccountId,
      dueDate: oblDueDate,
      frequency: oblFrequency,
      renewalRule: oblRenewalRule,
      notificationsEnabled: oblNotify,
      status: ObligationStatus.PENDING,
    });
    setOblName('');
    setOblAmount('');
    setShowObligationModal(false);
  };

  const periodLabelMap: Record<BudgetPeriod, string> = {
    [BudgetPeriod.WEEKLY]: 'Semanal',
    [BudgetPeriod.BIWEEKLY]: 'Quincenal',
    [BudgetPeriod.MONTHLY]: 'Mensual',
    [BudgetPeriod.YEARLY]: 'Anual',
    [BudgetPeriod.CUSTOM]: 'Personalizado',
  };

  const renewalLabelMap: Record<RenewalRule, string> = {
    [RenewalRule.AUTO_CREATE]: 'Crear automáticamente al vencer',
    [RenewalRule.ASK_BEFORE]: 'Preguntar antes de renovar',
    [RenewalRule.ONLY_IF_PREVIOUS_PAID]: 'Solo renovar si el anterior fue pagado',
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Navegación interna de Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-stone-200/70 dark:bg-zinc-800 p-1 rounded-2xl">
        <button
          type="button"
          onClick={() => {
            triggerHaptic(hapticEnabled, 10);
            setActiveSubSection('ANALYTICS');
          }}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeSubSection === 'ANALYTICS'
              ? 'bg-white dark:bg-zinc-900 text-stone-900 dark:text-zinc-100 shadow-xs'
              : 'text-stone-600 dark:text-zinc-400'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
          Estadísticas
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic(hapticEnabled, 10);
            setActiveSubSection('BUDGETS');
          }}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeSubSection === 'BUDGETS'
              ? 'bg-white dark:bg-zinc-900 text-stone-900 dark:text-zinc-100 shadow-xs'
              : 'text-stone-600 dark:text-zinc-400'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
          Presupuestos ({budgets.length})
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic(hapticEnabled, 10);
            setActiveSubSection('RECURRING');
          }}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeSubSection === 'RECURRING'
              ? 'bg-white dark:bg-zinc-900 text-stone-900 dark:text-zinc-100 shadow-xs'
              : 'text-stone-600 dark:text-zinc-400'
          }`}
        >
          <CalendarClock className="w-3.5 h-3.5 text-indigo-600" />
          Pagos Fijos ({obligations.length})
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic(hapticEnabled, 10);
            setActiveSubSection('EXPORT');
          }}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeSubSection === 'EXPORT'
              ? 'bg-white dark:bg-zinc-900 text-stone-900 dark:text-zinc-100 shadow-xs'
              : 'text-stone-600 dark:text-zinc-400'
          }`}
        >
          <Download className="w-3.5 h-3.5 text-emerald-600" />
          Exportar
        </button>
      </div>

      {/* SECCIÓN 1: ANÁLISIS Y ESTADÍSTICAS */}
      {activeSubSection === 'ANALYTICS' && (
        <div className="space-y-5">
          {/* Selector de Período y Rango de Fechas + Botón directo Guardar Informe PDF */}
          <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500 block">
                  Período y Rango de Fechas
                </span>
                <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Desde {activeDateRange.start} hasta {activeDateRange.end}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1 bg-stone-100 dark:bg-zinc-800 p-1 rounded-xl">
                  {(
                    [
                      { id: 'DAY', label: 'Hoy' },
                      { id: 'WEEK', label: 'Semana' },
                      { id: 'MONTH', label: 'Mes' },
                      { id: 'YEAR', label: 'Año' },
                      { id: 'CUSTOM', label: 'Rango Fechas' },
                    ] as { id: PeriodFilter; label: string }[]
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPeriodFilter(item.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        periodFilter === item.id
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'text-stone-600 dark:text-zinc-400'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(hapticEnabled, 15);
                    setShowPdfPreview(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-stone-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Guardar Informe PDF
                </button>
              </div>
            </div>

            {periodFilter === 'CUSTOM' && (
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-stone-100 dark:border-zinc-800">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-500 mb-1">
                    Fecha Desde
                  </label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-500 mb-1">
                    Fecha Hasta
                  </label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* KPIs principales */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="min-w-0 overflow-hidden bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold uppercase truncate">
                <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Ingresos</span>
              </div>
              <p className="text-sm sm:text-lg font-bold font-mono tabular-nums text-stone-900 dark:text-zinc-100 mt-1 break-all leading-tight">
                {formatMoney(totalIncome, currencySymbol)}
              </p>
            </div>

            <div className="min-w-0 overflow-hidden bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-[11px] font-bold uppercase truncate">
                <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Gastos</span>
              </div>
              <p className="text-sm sm:text-lg font-bold font-mono tabular-nums text-stone-900 dark:text-zinc-100 mt-1 break-all leading-tight">
                {formatMoney(totalExpense, currencySymbol)}
              </p>
            </div>

            <div className="min-w-0 overflow-hidden bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-3.5">
              <div className="text-stone-400 dark:text-zinc-500 text-[11px] font-bold uppercase truncate">
                Balance
              </div>
              <p
                className={`text-sm sm:text-lg font-bold font-mono tabular-nums mt-1 break-all leading-tight ${
                  netBalance >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {netBalance > 0 ? '+' : ''}
                {formatMoney(netBalance, currencySymbol)}
              </p>
            </div>
          </div>

          {/* Indicadores mindicador.cl + Controles Económicos + Gráfico de Líneas + Gráfico de Barras con Checkboxes */}
          <AnalyticsChartsAndIndicators
            categories={categories}
            filteredExpenseTransactions={filteredExpenseTransactions}
            allTransactions={transactions}
            selectedCategoryIds={selectedCategoryIds}
            onToggleCategoryId={handleToggleCategoryStat}
            onSelectAllCategories={handleSelectAllCategories}
            onClearAllCategories={handleClearAllCategories}
            indicators={indicators}
            loadingIndicators={loadingIndicators}
            onRefreshIndicators={loadIndicators}
            monthlyComparison={monthlyComparison}
            totalIncomePeriod={totalIncome}
            totalExpensePeriod={totalExpense}
            startDate={activeDateRange.start}
            endDate={activeDateRange.end}
            currencySymbol={currencySymbol}
            hapticEnabled={hapticEnabled}
          />

          {/* Análisis Estadístico Temporal por Categoría Individual */}
          <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-4 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-zinc-100">
                  Detalle Estadístico Individual por Categoría ({activeDateRange.start} al{' '}
                  {activeDateRange.end})
                </h3>
                <p className="text-xs text-stone-500 dark:text-zinc-400">
                  Promedio, desviación estándar (σ), mínimo, máximo y tendencia en el rango
                </p>
              </div>
              <select
                value={selectedStatCatId}
                onChange={(e) => setSelectedStatCatId(e.target.value)}
                className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs font-semibold text-stone-800 dark:text-zinc-200"
              >
                {categories
                  .filter((c) => !c.isDeleted)
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-800/60">
                <span className="text-[11px] text-stone-400 uppercase font-semibold">
                  Promedio (μ)
                </span>
                <p className="text-sm font-bold font-mono tabular-nums text-stone-900 dark:text-zinc-100 mt-0.5">
                  {formatMoney(categoryStats.avg, currencySymbol)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-800/60">
                <span className="text-[11px] text-stone-400 uppercase font-semibold">
                  Desv. Estándar (σ)
                </span>
                <p className="text-sm font-bold font-mono tabular-nums text-stone-900 dark:text-zinc-100 mt-0.5">
                  {formatMoney(categoryStats.stdDev, currencySymbol)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-800/60">
                <span className="text-[11px] text-stone-400 uppercase font-semibold">Mínimo</span>
                <p className="text-sm font-bold font-mono tabular-nums text-stone-900 dark:text-zinc-100 mt-0.5">
                  {formatMoney(categoryStats.min, currencySymbol)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-800/60">
                <span className="text-[11px] text-stone-400 uppercase font-semibold">Máximo</span>
                <p className="text-sm font-bold font-mono tabular-nums text-stone-900 dark:text-zinc-100 mt-0.5">
                  {formatMoney(categoryStats.max, currencySymbol)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-800/60">
                <span className="text-[11px] text-stone-400 uppercase font-semibold">
                  Tendencia ({categoryStats.variationPct >= 0 ? '+' : ''}
                  {categoryStats.variationPct.toFixed(1)}%)
                </span>
                <p className="text-sm font-bold text-stone-900 dark:text-zinc-100 mt-0.5">
                  {categoryStats.trendLabel}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN 2: PRESUPUESTOS CON ALERTAS 80% / 90% / 100% / SUPERADO */}
      {activeSubSection === 'BUDGETS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
                Presupuestos por Categoría
              </h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                Basados en tus categorías existentes · Alertas al 80%, 90%, 100% y superado
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowBudgetModal(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Nuevo Presupuesto
            </button>
          </div>

          <div className="space-y-3">
            {budgets.map((budget) => {
              const cat = catMap.get(budget.categoryId);
              const spent = transactions
                .filter(
                  (t) =>
                    t.type === TransactionType.EXPENSE &&
                    t.categoryId === budget.categoryId &&
                    t.date >= budget.startDate
                )
                .reduce((s, t) => s + t.amount, 0);

              const pct = budget.limitAmount > 0 ? (spent / budget.limitAmount) * 100 : 0;

              let alertBadge: { label: string; colorClass: string } | null = null;
              if (pct > 100) {
                alertBadge = {
                  label: '¡Presupuesto Superado! (>100%)',
                  colorClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
                };
              } else if (pct >= 100) {
                alertBadge = {
                  label: 'Alerta 100% Alcanzado',
                  colorClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
                };
              } else if (pct >= 90) {
                alertBadge = {
                  label: 'Alerta Crítica 90%',
                  colorClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
                };
              } else if (pct >= 80) {
                alertBadge = {
                  label: 'Alerta Preventiva 80%',
                  colorClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
                };
              }

              return (
                <div
                  key={budget.id}
                  className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: cat?.color || '#047857' }}
                      >
                        <CategoryIcon iconName={cat?.icon || 'MoreHorizontal'} className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-stone-900 dark:text-zinc-100">
                            {cat?.name || 'Categoría'}
                          </h4>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 font-medium">
                            {periodLabelMap[budget.period]}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-400 dark:text-zinc-500">
                          Inicio de ciclo: {budget.startDate}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic(hapticEnabled, 15);
                          onCloseBudgetPeriod(budget.id, spent);
                        }}
                        title="Reiniciar período guardando en historial"
                        className="px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-700 dark:text-zinc-300 text-xs font-semibold flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Nuevo ciclo
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteBudget(budget.id)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {alertBadge && (
                    <div
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${alertBadge.colorClass}`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {alertBadge.label}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                      <span className="text-stone-600 dark:text-zinc-400">
                        Gastado: <strong>{formatMoney(spent, currencySymbol)}</strong>
                      </span>
                      <span className="text-stone-900 dark:text-zinc-100 font-bold">
                        Límite: {formatMoney(budget.limitAmount, currencySymbol)} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-stone-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 100
                            ? 'bg-rose-600'
                            : pct >= 80
                            ? 'bg-amber-500'
                            : 'bg-emerald-600'
                        }`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Historial de períodos cerrados */}
                  {budget.history.length > 0 && (
                    <div className="pt-2 border-t border-stone-100 dark:border-zinc-800/80">
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-stone-400 mb-1.5">
                        <History className="w-3 h-3" />
                        Historial de ciclos anteriores ({budget.history.length})
                      </div>
                      <div className="space-y-1">
                        {budget.history.slice(0, 3).map((h, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-[11px] text-stone-500 dark:text-zinc-400 font-mono"
                          >
                            <span>
                              {h.periodLabel} (cierre {h.closedAt})
                            </span>
                            <span>
                              {formatMoney(h.spentAmount, currencySymbol)} /{' '}
                              {formatMoney(h.limitAmount, currencySymbol)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECCIÓN 3: PAGOS FIJOS / RECURRENTES */}
      {activeSubSection === 'RECURRING' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
                Pagos Fijos y Obligaciones Recurrentes
              </h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                Funcionan como obligaciones pendientes hasta que confirmas su pago efectivo
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowObligationModal(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Nueva Obligación
            </button>
          </div>

          <div className="space-y-3">
            {obligations.map((obl) => {
              const cat = catMap.get(obl.categoryId);
              const acc = accMap.get(obl.accountId);
              const isPaid = obl.status === ObligationStatus.PAID;

              return (
                <div
                  key={obl.id}
                  className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 mt-0.5"
                      style={{ backgroundColor: cat?.color || '#4F46E5' }}
                    >
                      <CategoryIcon iconName={cat?.icon || 'Zap'} className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-bold text-stone-900 dark:text-zinc-100">
                          {obl.name}
                        </h4>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {isPaid ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              Gasto Efectivamente Pagado
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" />
                              Obligación Pendiente
                            </>
                          )}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                        Vence: <strong className="font-mono">{obl.dueDate}</strong> · Cuenta:{' '}
                        {acc?.name || 'Principal'}
                      </p>
                      <p className="text-[11px] text-stone-400 dark:text-zinc-500 mt-0.5">
                        Regla de renovación: {renewalLabelMap[obl.renewalRule]}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 dark:border-zinc-800">
                    <span className="text-base font-bold font-mono tabular-nums text-stone-900 dark:text-zinc-100">
                      {formatMoney(obl.amount, currencySymbol)}
                    </span>

                    {!isPaid && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic(hapticEnabled, [20, 40]);
                          onPayObligation(obl);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
                      >
                        Registrar Pago
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDeleteObligation(obl.id)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECCIÓN 4: EXPORTACIÓN A EXCEL (9 HOJAS) E INFORME PDF */}
      {activeSubSection === 'EXPORT' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card Excel Multi-hoja */}
          <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
                Exportar a Excel Completo (9 Hojas)
              </h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400 leading-relaxed">
                Genera un libro Excel personalizado a nombre de{' '}
                <strong>{preferences.userName?.trim() || 'Usuario Principal'}</strong> con las 9
                hojas: <strong>Resumen</strong>, <strong>Movimientos</strong>,{' '}
                <strong>Cuentas</strong>, <strong>Transferencias</strong>,{' '}
                <strong>Deudas</strong>, <strong>Presupuestos</strong>,{' '}
                <strong>Pagos recurrentes</strong>, <strong>Categorías</strong> y{' '}
                <strong>Estadísticas (con σ y CV%)</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(hapticEnabled, 20);
                exportToMultiSheetExcel(dbState, indicators);
              }}
              className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs"
            >
              <Download className="w-4 h-4" />
              Descargar Libro Excel (.xls)
            </button>
          </div>

          {/* Card Informe PDF */}
          <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="w-11 h-11 rounded-2xl bg-stone-100 dark:bg-zinc-800 text-stone-800 dark:text-zinc-200 flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
                Guardar Informe PDF Ordenado
              </h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400 leading-relaxed">
                Descarga un documento <strong>.PDF</strong> con rango de fechas, gráficos de líneas y
                barras (incluso si los datos son cero), desviación estándar, controles económicos e
                indicadores de <strong>mindicador.cl</strong>.
              </p>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleDirectSavePdf}
                className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs"
              >
                <Download className="w-4 h-4" />
                Guardar Informe PDF Directo (.pdf)
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(hapticEnabled, 20);
                  setShowPdfPreview(true);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold flex items-center justify-center gap-2 shadow-xs"
              >
                <Calendar className="w-4 h-4" />
                Elegir Rango de Fechas y Guardar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO PRESUPUESTO */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
                Configurar Presupuesto
              </h3>
              <button
                type="button"
                onClick={() => setShowBudgetModal(false)}
                className="p-1.5 rounded-full text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBudgetSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                  Categoría Existente
                </label>
                <select
                  value={bgtCategoryId}
                  onChange={(e) => setBgtCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-sm"
                >
                  {categories
                    .filter((c) => !c.isDeleted && c.type !== TransactionType.INCOME)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                    Monto Límite ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="1"
                    required
                    placeholder="200000"
                    value={bgtLimit}
                    onChange={(e) => setBgtLimit(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                    Período
                  </label>
                  <select
                    value={bgtPeriod}
                    onChange={(e) => setBgtPeriod(e.target.value as BudgetPeriod)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-sm"
                  >
                    <option value={BudgetPeriod.WEEKLY}>Semanal</option>
                    <option value={BudgetPeriod.BIWEEKLY}>Quincenal</option>
                    <option value={BudgetPeriod.MONTHLY}>Mensual</option>
                    <option value={BudgetPeriod.YEARLY}>Anual</option>
                    <option value={BudgetPeriod.CUSTOM}>Personalizado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                  Fecha de Inicio
                </label>
                <input
                  type="date"
                  value={bgtStartDate}
                  onChange={(e) => setBgtStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-sm font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold"
              >
                Guardar Presupuesto
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NUEVA OBLIGACIÓN RECURRENTE */}
      {showObligationModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
                Nuevo Pago Fijo / Obligación
              </h3>
              <button
                type="button"
                onClick={() => setShowObligationModal(false)}
                className="p-1.5 rounded-full text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateObligationSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                  Nombre de la Obligación
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Arriendo, Colegiatura, Luz..."
                  value={oblName}
                  onChange={(e) => setOblName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                    Monto ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="1"
                    required
                    placeholder="0"
                    value={oblAmount}
                    onChange={(e) => setOblAmount(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                    Fecha Límite
                  </label>
                  <input
                    type="date"
                    value={oblDueDate}
                    onChange={(e) => setOblDueDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                    Categoría
                  </label>
                  <select
                    value={oblCategoryId}
                    onChange={(e) => setOblCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs"
                  >
                    {categories
                      .filter((c) => !c.isDeleted)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                    Cuenta Sugerida
                  </label>
                  <select
                    value={oblAccountId}
                    onChange={(e) => setOblAccountId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                  Regla de Renovación al Vencer
                </label>
                <select
                  value={oblRenewalRule}
                  onChange={(e) => setOblRenewalRule(e.target.value as RenewalRule)}
                  className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs"
                >
                  <option value={RenewalRule.ONLY_IF_PREVIOUS_PAID}>
                    Solo renovar si el anterior fue marcado como pagado
                  </option>
                  <option value={RenewalRule.ASK_BEFORE}>Preguntar antes de renovar</option>
                  <option value={RenewalRule.AUTO_CREATE}>Crear automáticamente</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold"
              >
                Guardar Obligación
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURAR Y GUARDAR INFORME PDF */}
      <FormalPdfReportModal
        isOpen={showPdfPreview}
        onClose={() => setShowPdfPreview(false)}
        dbState={dbState}
        initialStartDate={activeDateRange.start}
        initialEndDate={activeDateRange.end}
        selectedCategoryIds={selectedCategoryIds}
        indicators={indicators}
      />
    </div>
  );
};
