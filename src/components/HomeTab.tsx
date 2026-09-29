import React from 'react';
import {
  Account,
  AccountTransfer,
  Budget,
  Category,
  ObligationStatus,
  RecurringObligation,
  Transaction,
  TransactionType,
  UserPreferences,
} from '../domain/models';
import { calculateAccountBalance, formatMoney, triggerHaptic } from '../data/localRepository';
import { CategoryIcon } from './GastitoLogo';
import { QuickEntryMode } from './QuickEntryModal';
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowRightLeft,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Zap,
} from 'lucide-react';

interface HomeTabProps {
  preferences: UserPreferences;
  categories: Category[];
  accounts: Account[];
  transactions: Transaction[];
  transfers: AccountTransfer[];
  budgets: Budget[];
  obligations: RecurringObligation[];
  onOpenQuickEntry: (mode: QuickEntryMode, preselectCategoryId?: string) => void;
  onEditTransaction: (tx: Transaction) => void;
  onPayObligation: (obligationId: string) => void;
  onNavigateTab: (tab: 'MOVIMIENTOS' | 'CUENTAS' | 'DEUDAS' | 'RESUMEN') => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  preferences,
  categories,
  accounts,
  transactions,
  transfers,
  budgets,
  obligations,
  onOpenQuickEntry,
  onEditTransaction,
  onPayObligation,
  onNavigateTab,
}) => {
  const greetingText = preferences.userName.trim()
    ? `Hola ${preferences.userName.trim()}, ¿qué quieres ingresar?`
    : 'Saludos, ¿qué quieres ingresar?';

  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const totalAvailable = activeAccounts.reduce(
    (sum, acc) => sum + calculateAccountBalance(acc, transactions, transfers),
    0
  );

  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  const monthExpenses = transactions
    .filter((t) => t.type === TransactionType.EXPENSE && t.date.startsWith(currentMonthPrefix))
    .reduce((s, t) => s + t.amount, 0);
  const monthIncome = transactions
    .filter((t) => t.type === TransactionType.INCOME && t.date.startsWith(currentMonthPrefix))
    .reduce((s, t) => s + t.amount, 0);

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const accMap = new Map(accounts.map((a) => [a.id, a]));

  // Check budget alerts (80%, 90%, 100%, superado)
  const budgetAlerts = budgets
    .filter((b) => b.isActive && b.limitAmount > 0)
    .map((b) => {
      const spent = transactions
        .filter(
          (t) =>
            t.type === TransactionType.EXPENSE &&
            t.categoryId === b.categoryId &&
            t.date >= b.startDate
        )
        .reduce((s, t) => s + t.amount, 0);
      const pct = (spent / b.limitAmount) * 100;
      const cat = catMap.get(b.categoryId);
      let level: 'NONE' | '80' | '90' | '100' | 'EXCEEDED' = 'NONE';
      if (pct > 100) level = 'EXCEEDED';
      else if (pct >= 100) level = '100';
      else if (pct >= 90) level = '90';
      else if (pct >= 80) level = '80';
      return { budget: b, spent, pct, catName: cat?.name || 'Categoría', level };
    })
    .filter((item) => item.level !== 'NONE');

  const pendingObligations = obligations.filter(
    (o) => o.status !== ObligationStatus.PAID
  );

  const recentTransactions = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 6);

  const topExpenseCategories = categories
    .filter((c) => !c.isDeleted && c.isActive && (c.type === TransactionType.EXPENSE || c.type === 'BOTH'))
    .slice(0, 8);

  return (
    <div className="space-y-8">
      {/* Hero Greeting & 3 Primary Action Cards */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">
              <span>Asistente {preferences.assistantName || 'Gastito'}</span>
              <span aria-hidden="true">·</span>
              <span>Almacenamiento 100% local y privado</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 dark:text-white tracking-tight text-balance">
              {greetingText}
            </h1>
          </div>

          {/* Summary figures with tabular numerals */}
          <div className="flex flex-wrap items-center gap-6 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Patrimonio en cuentas</div>
              <div className="text-xl font-bold font-mono-num text-slate-900 dark:text-white">
                {formatMoney(totalAvailable, preferences.currencySymbol)}
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Ingresos del mes</div>
              <div className="text-base font-semibold font-mono-num text-emerald-600 dark:text-emerald-400">
                +{formatMoney(monthIncome, preferences.currencySymbol)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Gastos del mes</div>
              <div className="text-base font-semibold font-mono-num text-rose-600 dark:text-rose-400">
                -{formatMoney(monthExpenses, preferences.currencySymbol)}
              </div>
            </div>
          </div>
        </div>

        {/* Three Large Primary Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(preferences.hapticFeedbackEnabled, 15);
              onOpenQuickEntry('EXPENSE');
            }}
            className="group flex items-center justify-between p-5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-left transition-all active:scale-[0.99] shadow-sm"
          >
            <div>
              <div className="text-xs font-medium text-rose-100 mb-1">
                Categoría → Monto → Cuenta
              </div>
              <div className="text-xl font-bold font-display tracking-tight">
                Registrar Gasto
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
              <ArrowDownRight size={26} />
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(preferences.hapticFeedbackEnabled, 15);
              onOpenQuickEntry('INCOME');
            }}
            className="group flex items-center justify-between p-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-left transition-all active:scale-[0.99] shadow-sm"
          >
            <div>
              <div className="text-xs font-medium text-emerald-100 mb-1">
                Nómina, ventas o reembolsos
              </div>
              <div className="text-xl font-bold font-display tracking-tight">
                Registrar Ingreso
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
              <ArrowUpRight size={26} />
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(preferences.hapticFeedbackEnabled, 15);
              onOpenQuickEntry('TRANSFER');
            }}
            className="group flex items-center justify-between p-5 rounded-2xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-left transition-all active:scale-[0.99] shadow-sm"
          >
            <div>
              <div className="text-xs font-medium text-slate-300 mb-1">
                No se contabiliza como gasto
              </div>
              <div className="text-xl font-bold font-display tracking-tight">
                Movimiento entre cuentas
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
              <ArrowRightLeft size={24} />
            </div>
          </button>
        </div>

        {/* Instant 1-Tap Category Bar */}
        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <Zap size={14} className="text-amber-500" />
              <span>Acceso directo a gasto por categoría (1 toque al teclado numérico)</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {topExpenseCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  triggerHaptic(preferences.hapticFeedbackEnabled, 12);
                  onOpenQuickEntry('EXPENSE', cat.id);
                }}
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-left transition-colors min-h-[46px]"
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: cat.color }}
                >
                  <CategoryIcon name={cat.icon} size={14} />
                </div>
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                  {cat.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Alerts & Obligations Grid */}
      {(budgetAlerts.length > 0 || pendingObligations.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Native Budget Alerts */}
          {preferences.budgetAlertsEnabled && budgetAlerts.length > 0 && (
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Alertas de presupuesto activas
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('RESUMEN')}
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  Gestionar presupuestos
                </button>
              </div>
              <div className="space-y-3">
                {budgetAlerts.map(({ budget, spent, pct, catName, level }) => (
                  <div
                    key={budget.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {catName} ·{' '}
                        {level === 'EXCEEDED'
                          ? 'Presupuesto superado'
                          : `Alerta ${level}% alcanzado`}
                      </span>
                      <span className="font-mono-num font-semibold text-slate-700 dark:text-slate-300">
                        {formatMoney(spent, preferences.currencySymbol)} /{' '}
                        {formatMoney(budget.limitAmount, preferences.currencySymbol)} (
                        {pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          level === 'EXCEEDED' || level === '100'
                            ? 'bg-rose-600'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Pending Recurring Obligations */}
          {pendingObligations.length > 0 && (
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BellRing size={18} className="text-sky-600 dark:text-sky-400" />
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Obligaciones fijas pendientes ({pendingObligations.length})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('RESUMEN')}
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  Ver todas
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {pendingObligations.slice(0, 3).map((obl) => {
                  const acc = accMap.get(obl.accountId);
                  return (
                    <div
                      key={obl.id}
                      className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {obl.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Vence {obl.dueDate} · {acc?.name || 'Cuenta'} · Obligación pendiente
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold font-mono-num text-slate-900 dark:text-white">
                          {formatMoney(obl.amount, preferences.currencySymbol)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic(preferences.hapticFeedbackEnabled, 20);
                            onPayObligation(obl.id);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors min-h-[36px]"
                        >
                          <CheckCircle2 size={14} />
                          <span>Pagar</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Recent Activity & Accounts Quick Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Movements (2 cols) */}
        <section className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Últimos movimientos registrados
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('MOVIMIENTOS')}
              className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              <span>Ver historial completo</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                Aún no hay movimientos registrados.
              </p>
              <button
                type="button"
                onClick={() => onOpenQuickEntry('EXPENSE')}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold"
              >
                Registrar primer movimiento
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentTransactions.map((tx) => {
                const cat = catMap.get(tx.categoryId);
                const acc = accMap.get(tx.accountId);
                const isExpense = tx.type === TransactionType.EXPENSE;
                return (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => onEditTransaction(tx)}
                    className="w-full py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4 text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/40 rounded-lg px-2 -mx-2 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: cat?.color || '#64748B' }}
                      >
                        <CategoryIcon name={cat?.icon || 'CircleDollarSign'} size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {cat?.name || 'Categoría'}
                          {tx.description ? ` · ${tx.description}` : ''}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {acc?.name || 'Cuenta'} · {tx.date}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`text-sm font-bold font-mono-num whitespace-nowrap ${
                        isExpense
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {isExpense ? '-' : '+'}
                      {formatMoney(tx.amount, preferences.currencySymbol)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Accounts Quick Balances (1 col) */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Saldos por cuenta
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('CUENTAS')}
              className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              <span>Administrar</span>
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {activeAccounts.map((acc) => {
              const bal = calculateAccountBalance(acc, transactions, transfers);
              return (
                <div
                  key={acc.id}
                  className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {acc.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {acc.additionalInfo || acc.type}
                    </div>
                  </div>
                  <div className="text-sm font-bold font-mono-num text-slate-900 dark:text-white whitespace-nowrap">
                    {formatMoney(bal, preferences.currencySymbol)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
