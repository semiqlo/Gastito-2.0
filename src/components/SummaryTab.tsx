import React, { useState, useMemo } from 'react';
import {
  Account,
  AccountTransfer,
  AppDatabaseState,
  Budget,
  BudgetPeriod,
  Category,
  DebtRecord,
  DebtType,
  ObligationStatus,
  RecurrenceFrequency,
  RecurringObligation,
  RenewalRule,
  Transaction,
  TransactionType,
} from '../domain/models';
import {
  calculateAccountBalance,
  formatMoney,
  triggerHaptic,
} from '../data/localRepository';
import { exportToMultiSheetExcel } from '../utils/exportManager';
import { CategoryIcon, GastitoLogo } from './GastitoLogo';
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  Plus,
  Printer,
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
    transfers,
    debts,
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

  // Modal Vista Previa PDF Formal
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfSections, setPdfSections] = useState({
    summary: true,
    accounts: true,
    categories: true,
    budgets: true,
    obligations: true,
    debts: true,
  });

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  // Filtrado de transacciones por período
  const filteredTransactions = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    return transactions.filter((tx) => {
      if (periodFilter === 'DAY') {
        return tx.date === todayStr;
      }
      if (periodFilter === 'WEEK') {
        const weekAgo = new Date();
        weekAgo.setDate(today.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().split('T')[0];
        return tx.date >= weekAgoStr && tx.date <= todayStr;
      }
      if (periodFilter === 'MONTH') {
        return tx.date.slice(0, 7) === todayStr.slice(0, 7);
      }
      if (periodFilter === 'YEAR') {
        return tx.date.slice(0, 4) === todayStr.slice(0, 4);
      }
      if (periodFilter === 'CUSTOM') {
        return tx.date >= customStart && tx.date <= customEnd;
      }
      return true;
    });
  }, [transactions, periodFilter, customStart, customEnd]);

  const totalIncome = useMemo(
    () =>
      filteredTransactions
        .filter((t) => t.type === TransactionType.INCOME)
        .reduce((s, t) => s + t.amount, 0),
    [filteredTransactions]
  );

  const totalExpense = useMemo(
    () =>
      filteredTransactions
        .filter((t) => t.type === TransactionType.EXPENSE)
        .reduce((s, t) => s + t.amount, 0),
    [filteredTransactions]
  );

  const netBalance = totalIncome - totalExpense;

  // Desglose por categoría
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, { category: Category; total: number; count: number }>();
    filteredTransactions
      .filter((t) => t.type === TransactionType.EXPENSE)
      .forEach((tx) => {
        const cat = catMap.get(tx.categoryId);
        if (!cat) return;
        const curr = map.get(cat.id) || { category: cat, total: 0, count: 0 };
        curr.total += tx.amount;
        curr.count += 1;
        map.set(cat.id, curr);
      });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredTransactions, catMap]);

  // Análisis estadístico temporal para la categoría seleccionada
  const categoryStats = useMemo(() => {
    const txs = transactions
      .filter((t) => t.categoryId === selectedStatCatId)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (txs.length === 0) {
      return {
        count: 0,
        total: 0,
        avg: 0,
        min: 0,
        max: 0,
        variationPct: 0,
        trendLabel: 'Sin datos suficientes',
      };
    }

    const amounts = txs.map((t) => t.amount);
    const total = amounts.reduce((s, v) => s + v, 0);
    const avg = total / amounts.length;
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);

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
      count: txs.length,
      total,
      avg,
      min,
      max,
      variationPct,
      trendLabel,
    };
  }, [transactions, selectedStatCatId]);

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
          {/* Selector de Período */}
          <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">
                Período de Análisis
              </span>
              <div className="flex gap-1 bg-stone-100 dark:bg-zinc-800 p-1 rounded-xl">
                {(
                  [
                    { id: 'DAY', label: 'Hoy' },
                    { id: 'WEEK', label: 'Semana' },
                    { id: 'MONTH', label: 'Mes' },
                    { id: 'YEAR', label: 'Año' },
                    { id: 'CUSTOM', label: 'Rango' },
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
            </div>

            {periodFilter === 'CUSTOM' && (
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-stone-100 dark:border-zinc-800">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-500 mb-1">
                    Desde
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
                    Hasta
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
            <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold uppercase">
                <TrendingUp className="w-3.5 h-3.5" />
                Ingresos
              </div>
              <p className="text-base sm:text-lg font-bold font-mono tabular-nums text-stone-900 dark:text-zinc-100 mt-1">
                {formatMoney(totalIncome, currencySymbol)}
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-[11px] font-bold uppercase">
                <TrendingDown className="w-3.5 h-3.5" />
                Gastos
              </div>
              <p className="text-base sm:text-lg font-bold font-mono tabular-nums text-stone-900 dark:text-zinc-100 mt-1">
                {formatMoney(totalExpense, currencySymbol)}
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-3.5">
              <div className="text-stone-400 dark:text-zinc-500 text-[11px] font-bold uppercase">
                Balance
              </div>
              <p
                className={`text-base sm:text-lg font-bold font-mono tabular-nums mt-1 ${
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

          {/* Distribución de Gastos por Categoría (Gráfico Dinámico) */}
          <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900 dark:text-zinc-100">
                Gastos por Categoría
              </h3>
              <span className="text-xs font-mono text-stone-500 dark:text-zinc-400">
                {expenseByCategory.length} categorías activas
              </span>
            </div>

            {expenseByCategory.length === 0 ? (
              <p className="text-xs text-stone-400 dark:text-zinc-500 py-6 text-center">
                No hay gastos registrados en el período seleccionado.
              </p>
            ) : (
              <div className="space-y-3">
                {expenseByCategory.map((item) => {
                  const pct =
                    totalExpense > 0 ? Math.min(100, (item.total / totalExpense) * 100) : 0;
                  return (
                    <div key={item.category.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-white"
                            style={{ backgroundColor: item.category.color }}
                          >
                            <CategoryIcon iconName={item.category.icon} className="w-3.5 h-3.5" />
                          </span>
                          <span className="font-semibold text-stone-800 dark:text-zinc-200">
                            {item.category.name}
                          </span>
                          <span className="text-[11px] text-stone-400">({item.count})</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono tabular-nums">
                          <span className="font-bold text-stone-900 dark:text-zinc-100">
                            {formatMoney(item.total, currencySymbol)}
                          </span>
                          <span className="text-[11px] text-stone-400 w-10 text-right">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-stone-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: item.category.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Análisis Estadístico Temporal por Categoría */}
          <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-4 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-zinc-100">
                  Análisis Temporal por Categoría
                </h3>
                <p className="text-xs text-stone-500 dark:text-zinc-400">
                  Promedio, mínimo, máximo, variación y tendencia histórica
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-800/60">
                <span className="text-[11px] text-stone-400 uppercase font-semibold">Promedio</span>
                <p className="text-sm font-bold font-mono tabular-nums text-stone-900 dark:text-zinc-100 mt-0.5">
                  {formatMoney(categoryStats.avg, currencySymbol)}
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

      {/* SECCIÓN 3: PAGOS FIJOS / RECURRENTES (OBLIGACIONES PENDIENTES VS GASTO PAGADO) */}
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

      {/* SECCIÓN 4: EXPORTACIÓN A EXCEL (9 HOJAS) Y PDF FORMAL */}
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
                Genera un libro Excel con hojas separadas: <strong>Resumen</strong>,{' '}
                <strong>Movimientos</strong>, <strong>Cuentas</strong>,{' '}
                <strong>Transferencias</strong>, <strong>Deudas</strong>,{' '}
                <strong>Presupuestos</strong>, <strong>Pagos recurrentes</strong>,{' '}
                <strong>Categorías</strong> y <strong>Estadísticas</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(hapticEnabled, 20);
                exportToMultiSheetExcel(dbState);
              }}
              className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs"
            >
              <Download className="w-4 h-4" />
              Descargar Libro Excel (.xls)
            </button>
          </div>

          {/* Card PDF Formal */}
          <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="w-11 h-11 rounded-2xl bg-stone-100 dark:bg-zinc-800 text-stone-800 dark:text-zinc-200 flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
                Reporte PDF Formal con Logo Gastito
              </h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400 leading-relaxed">
                Documento ejecutivo con el logo oficial de Gastito (G con doble barra vertical),
                período filtrado, saldos auditados, gráficos de categorías y secciones
                seleccionables.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(hapticEnabled, 20);
                setShowPdfPreview(true);
              }}
              className="w-full py-3 px-4 rounded-xl bg-stone-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold flex items-center justify-center gap-2 shadow-xs"
            >
              <Printer className="w-4 h-4" />
              Configurar e Imprimir PDF
            </button>
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
                    step="0.01"
                    required
                    placeholder="200.00"
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
                    step="0.01"
                    required
                    placeholder="0.00"
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

      {/* MODAL VISTA PREVIA E IMPRESIÓN PDF FORMAL */}
      {showPdfPreview && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white text-stone-900 rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4 no-print">
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { key: 'summary', label: 'Resumen' },
                    { key: 'accounts', label: 'Cuentas' },
                    { key: 'categories', label: 'Categorías' },
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
                        setPdfSections((prev) => ({ ...prev, [sec.key]: e.target.checked }))
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
                  className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir / Guardar PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowPdfPreview(false)}
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
                    GASTITO 2.0 — Estado Financiero Local
                  </h2>
                  <p className="text-xs text-stone-500">
                    Titular: {preferences.userName || 'Usuario Principal'} · Fecha de emisión:{' '}
                    {new Date().toISOString().split('T')[0]}
                  </p>
                </div>
              </div>
              <div className="text-right font-mono text-xs text-stone-500">
                100% Almacenamiento Local
              </div>
            </div>

            {pdfSections.summary && (
              <div className="grid grid-cols-3 gap-3 bg-stone-50 p-4 rounded-2xl border border-stone-200">
                <div>
                  <span className="text-[11px] uppercase text-stone-500 font-bold">
                    Ingresos del Período
                  </span>
                  <p className="text-lg font-bold font-mono text-emerald-700">
                    {formatMoney(totalIncome, currencySymbol)}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] uppercase text-stone-500 font-bold">
                    Gastos del Período
                  </span>
                  <p className="text-lg font-bold font-mono text-rose-700">
                    {formatMoney(totalExpense, currencySymbol)}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] uppercase text-stone-500 font-bold">
                    Balance Neto
                  </span>
                  <p className="text-lg font-bold font-mono text-stone-900">
                    {formatMoney(netBalance, currencySymbol)}
                  </p>
                </div>
              </div>
            )}

            {pdfSections.accounts && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Saldos por Cuenta
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

            {pdfSections.categories && expenseByCategory.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Desglose de Gastos por Categoría
                </h4>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200 text-left text-stone-500">
                      <th className="py-1.5">Categoría</th>
                      <th className="py-1.5 text-right">Movimientos</th>
                      <th className="py-1.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseByCategory.map((row) => (
                      <tr key={row.category.id} className="border-b border-stone-100">
                        <td className="py-1.5 font-semibold">{row.category.name}</td>
                        <td className="py-1.5 text-right font-mono">{row.count}</td>
                        <td className="py-1.5 text-right font-mono font-bold">
                          {formatMoney(row.total, currencySymbol)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
