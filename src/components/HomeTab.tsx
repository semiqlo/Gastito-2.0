import React from 'react';
import {
  Account,
  AccountTransfer,
  AccountType,
  Budget,
  Category,
  ObligationStatus,
  RecurringObligation,
  Transaction,
  TransactionType,
  UserPreferences,
} from '../domain/models';
import {
  calculateAccountBalance,
  calculateCreditCardMetrics,
  formatMoney,
  triggerHaptic,
} from '../data/localRepository';
import { CategoryIcon } from './GastitoLogo';
import { CardChargeType, QuickEntryMode } from './QuickEntryModal';
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowRightLeft,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Layers,
  Repeat,
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
  onOpenCardAction?: (accountId: string, chargeType: CardChargeType) => void;
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
  onOpenCardAction,
  onEditTransaction,
  onPayObligation,
  onNavigateTab,
}) => {
  const greetingText = preferences.userName.trim()
    ? `Hola ${preferences.userName.trim()}, ¿qué quieres ingresar?`
    : 'Saludos, ¿qué quieres ingresar?';

  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const creditCards = activeAccounts.filter((a) => a.type === AccountType.CREDIT);
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

          {/* Summary figures: Patrimonio on top, Ingresos & Gastos side-by-side below */}
          <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800 space-y-2.5">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 min-w-0 overflow-hidden">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Patrimonio en cuentas
              </div>
              <div className="text-lg sm:text-xl font-bold font-mono-num text-slate-900 dark:text-white break-all text-right max-w-full">
                {formatMoney(totalAvailable, preferences.currencySymbol)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="min-w-0 overflow-hidden p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 flex flex-col justify-between">
                <div className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                  Ingresos del mes
                </div>
                <div className="text-sm sm:text-base font-bold font-mono-num text-emerald-600 dark:text-emerald-400 mt-1 break-all leading-tight">
                  +{formatMoney(monthIncome, preferences.currencySymbol)}
                </div>
              </div>

              <div className="min-w-0 overflow-hidden p-3 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 flex flex-col justify-between">
                <div className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                  Gastos del mes
                </div>
                <div className="text-sm sm:text-base font-bold font-mono-num text-rose-600 dark:text-rose-400 mt-1 break-all leading-tight">
                  -{formatMoney(monthExpenses, preferences.currencySymbol)}
                </div>
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

      {/* REGISTRO NOTORIO DE TARJETAS DE CRÉDITO: CUPO TOTAL, LO GASTADO, DISPONIBLE PARA GASTAR, CUOTAS Y SUSCRIPCIONES */}
      {creditCards.length > 0 && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-indigo-500/25 dark:border-indigo-500/35 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <CreditCard size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Tarjetas de Crédito: Cupo Disponible, Cuotas y Suscripciones
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Control en tiempo real de lo que vas gastando, cuánto cupo tienes disponible, tus compras en cuotas con fecha de término y tus suscripciones automáticas
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('CUENTAS')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>Administrar tarjetas y cupo</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="space-y-4">
            {creditCards.map((ccAcc) => {
              const cc = calculateCreditCardMetrics(
                ccAcc,
                transactions,
                transfers,
                obligations
              );

              return (
                <div
                  key={ccAcc.id}
                  className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {ccAcc.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {ccAcc.additionalInfo ||
                          `Facturación día ${ccAcc.billingDay || 18} · Pago día ${
                            ccAcc.paymentDueDay || 5
                          }`}
                      </p>
                    </div>

                    {onOpenCardAction && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic(preferences.hapticFeedbackEnabled, 15);
                            onOpenCardAction(ccAcc.id, 'INSTALLMENTS');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"
                        >
                          <Layers size={13} />
                          <span>+ Pagar en Cuotas</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic(preferences.hapticFeedbackEnabled, 15);
                            onOpenCardAction(ccAcc.id, 'SUBSCRIPTION');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5"
                        >
                          <Repeat size={13} />
                          <span>+ Suscripción</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 3 Cifras Principales: Disponible para gastar, Gastado/Ocupado y Cupo Total */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="min-w-0 overflow-hidden p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50">
                      <span className="text-[11px] font-bold uppercase text-emerald-800 dark:text-emerald-300 block truncate">
                        Disponible para Gastar
                      </span>
                      <span className="text-base sm:text-lg font-extrabold font-mono-num text-emerald-700 dark:text-emerald-400 block mt-0.5 break-all">
                        {formatMoney(cc.availableCredit, preferences.currencySymbol)}
                      </span>
                    </div>

                    <div className="min-w-0 overflow-hidden p-3 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/50">
                      <span className="text-[11px] font-bold uppercase text-rose-800 dark:text-rose-300 block truncate">
                        Gastado / Comprometido
                      </span>
                      <span className="text-base sm:text-lg font-extrabold font-mono-num text-rose-600 dark:text-rose-400 block mt-0.5 break-all">
                        {formatMoney(cc.totalUsedCredit, preferences.currencySymbol)}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        Facturado: {formatMoney(cc.billedDebt, preferences.currencySymbol)} · Cuotas:{' '}
                        {formatMoney(cc.futureInstallmentsCommitted, preferences.currencySymbol)}
                      </span>
                    </div>

                    <div className="min-w-0 overflow-hidden p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 block truncate">
                        Cupo Total Tarjeta
                      </span>
                      <span className="text-base sm:text-lg font-extrabold font-mono-num text-slate-900 dark:text-white block mt-0.5 break-all">
                        {formatMoney(cc.creditLimit, preferences.currencySymbol)}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        Ocupado: {cc.usagePct.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Barra de Cupo */}
                  <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        cc.usagePct >= 85
                          ? 'bg-rose-600'
                          : cc.usagePct >= 60
                          ? 'bg-amber-500'
                          : 'bg-indigo-600'
                      }`}
                      style={{ width: `${Math.min(100, cc.usagePct)}%` }}
                    />
                  </div>

                  {/* Resumen a la vista de Cuotas Activas y Suscripciones en esta Tarjeta */}
                  {(cc.activeInstallments.length > 0 ||
                    cc.activeSubscriptions.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {/* Cuotas activas */}
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-indigo-700 dark:text-indigo-400">
                          <span className="flex items-center gap-1">
                            <Layers size={13} />
                            Compras en Cuotas ({cc.activeInstallments.length})
                          </span>
                          <span className="font-mono">
                            {formatMoney(
                              cc.monthlyInstallmentsLoad,
                              preferences.currencySymbol
                            )}
                            /mes
                          </span>
                        </div>
                        {cc.activeInstallments.length === 0 ? (
                          <p className="text-[11px] text-slate-400">
                            Sin compras en cuotas activas.
                          </p>
                        ) : (
                          cc.activeInstallments.map((inst) => {
                            const tot = Math.max(1, inst.totalInstallments || 1);
                            const pd = Math.min(tot, Math.max(0, inst.paidInstallments || 0));
                            const rem = Math.max(0, tot - pd);
                            return (
                              <div
                                key={inst.id}
                                className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-slate-100 dark:border-slate-800/80"
                              >
                                <div className="min-w-0">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                                    {inst.name}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-500">
                                    Cuota {pd}/{tot} · Quedan {rem}m
                                    {inst.endDate ? ` · Fin ${inst.endDate}` : ''}
                                  </span>
                                </div>
                                <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0">
                                  {formatMoney(inst.amount, preferences.currencySymbol)}/m
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Suscripciones a la vista */}
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-purple-700 dark:text-purple-400">
                          <span className="flex items-center gap-1">
                            <Repeat size={13} />
                            Suscripciones en Tarjeta ({cc.activeSubscriptions.length})
                          </span>
                          <span className="font-mono">
                            {formatMoney(
                              cc.monthlySubscriptionsLoad,
                              preferences.currencySymbol
                            )}
                            /mes
                          </span>
                        </div>
                        {cc.activeSubscriptions.length === 0 ? (
                          <p className="text-[11px] text-slate-400">
                            Sin suscripciones registradas en esta tarjeta.
                          </p>
                        ) : (
                          cc.activeSubscriptions.map((sub) => (
                            <div
                              key={sub.id}
                              className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-slate-100 dark:border-slate-800/80"
                            >
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                                  {sub.name}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500">
                                  Cargo automático: {sub.dueDate}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0">
                                {formatMoney(sub.amount, preferences.currencySymbol)}/m
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

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

          {/* Pending Recurring Obligations & Variable Bills */}
          {pendingObligations.length > 0 && (
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BellRing size={18} className="text-sky-600 dark:text-sky-400" />
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Recordatorios de cuentas y pagos ({pendingObligations.length})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('RESUMEN')}
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  Gestionar / + Nuevo
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {pendingObligations.slice(0, 5).map((obl) => {
                  const acc = accMap.get(obl.accountId);
                  const isVar = Boolean(obl.isVariableAmount);
                  return (
                    <div
                      key={obl.id}
                      className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {obl.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Vence {obl.dueDate} · {acc?.name || 'Cuenta'} ·{' '}
                          {isVar ? 'Monto variable (ingresar al pagar)' : 'Monto fijo'}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">
                            {isVar ? 'Estimado' : 'Monto'}
                          </span>
                          <span className="text-sm font-bold font-mono-num text-slate-900 dark:text-white">
                            {obl.amount > 0
                              ? formatMoney(obl.amount, preferences.currencySymbol)
                              : obl.lastPaidAmount && obl.lastPaidAmount > 0
                              ? formatMoney(obl.lastPaidAmount, preferences.currencySymbol)
                              : 'Variable'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic(preferences.hapticFeedbackEnabled, 20);
                            onPayObligation(obl.id);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors min-h-[36px]"
                        >
                          <CheckCircle2 size={14} />
                          <span>{isVar ? 'Ingresar Pago' : 'Pagar'}</span>
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
