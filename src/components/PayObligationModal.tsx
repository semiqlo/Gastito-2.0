import React, { useState, useEffect, useMemo } from 'react';
import {
  Account,
  Category,
  RecurringObligation,
  Transaction,
} from '../domain/models';
import { formatMoney, triggerHaptic } from '../data/localRepository';
import { calculateStatisticalMetrics } from '../utils/economicIndicators';
import { CategoryIcon } from './GastitoLogo';
import {
  Calendar,
  CheckCircle2,
  SlidersHorizontal,
  Wallet,
  X,
} from 'lucide-react';

export interface PayObligationPayload {
  obligation: RecurringObligation;
  actualAmountPaid: number;
  accountId: string;
  paymentDate: string;
  notes: string;
  updateReferenceAmount: boolean;
}

interface PayObligationModalProps {
  isOpen: boolean;
  obligation: RecurringObligation | null;
  categories: Category[];
  accounts: Account[];
  transactions: Transaction[];
  currencySymbol: string;
  hapticEnabled: boolean;
  onClose: () => void;
  onConfirmPayment: (payload: PayObligationPayload) => void;
}

export const PayObligationModal: React.FC<PayObligationModalProps> = ({
  isOpen,
  obligation,
  categories,
  accounts,
  transactions,
  currencySymbol,
  hapticEnabled,
  onClose,
  onConfirmPayment,
}) => {
  const [amountStr, setAmountStr] = useState('');
  const [accountId, setAccountId] = useState('');
  const [paymentDate, setPaymentDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [updateReferenceAmount, setUpdateReferenceAmount] = useState(false);

  useEffect(() => {
    if (isOpen && obligation) {
      // Si es monto fijo, sugerimos el monto fijo; si es cuenta variable, dejamos listo para escribir o con el estimado
      const initialAmt =
        obligation.amount > 0
          ? String(Math.round(obligation.amount))
          : obligation.lastPaidAmount && obligation.lastPaidAmount > 0
          ? String(Math.round(obligation.lastPaidAmount))
          : '';
      setAmountStr(initialAmt);
      setAccountId(obligation.accountId || accounts[0]?.id || '');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setUpdateReferenceAmount(false);
    }
  }, [isOpen, obligation, accounts]);

  const historicalStats = useMemo(() => {
    if (!obligation) {
      return { count: 0, mean: 0, stdDev: 0, lastPaid: 0 };
    }
    const linkedTxs = transactions
      .filter((t) => t.linkedObligationId === obligation.id)
      .sort((a, b) => b.date.localeCompare(a.date));

    const historyAmounts =
      linkedTxs.length > 0
        ? linkedTxs.map((t) => t.amount)
        : (obligation.paymentHistory || []).map((h) => h.amountPaid);

    const metrics = calculateStatisticalMetrics(historyAmounts);
    const lastPaid =
      obligation.lastPaidAmount ??
      (linkedTxs.length > 0 ? linkedTxs[0].amount : 0);

    return {
      count: metrics.count,
      mean: metrics.mean,
      stdDev: metrics.stdDev,
      lastPaid,
    };
  }, [obligation, transactions]);

  if (!isOpen || !obligation) return null;

  const category = categories.find((c) => c.id === obligation.categoryId);
  const parsedAmount = Math.round(Number(amountStr) || 0);
  const diffFromEstimated =
    obligation.amount > 0 ? parsedAmount - obligation.amount : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0 || !accountId) return;
    triggerHaptic(hapticEnabled, [20, 40]);
    onConfirmPayment({
      obligation,
      actualAmountPaid: parsedAmount,
      accountId,
      paymentDate,
      notes: notes.trim(),
      updateReferenceAmount,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0"
              style={{ backgroundColor: category?.color || '#047857' }}
            >
              <CategoryIcon
                iconName={category?.icon || 'Zap'}
                className="w-5 h-5"
              />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                {obligation.isInstallmentPlan
                  ? `Compra en Cuotas TC (Cuota ${Math.min(
                      obligation.totalInstallments || 1,
                      (obligation.paidInstallments || 0) + 1
                    )}/${obligation.totalInstallments || 1} · Termina: ${
                      obligation.endDate || '---'
                    })`
                  : obligation.isSubscription
                  ? 'Suscripción Automática en Tarjeta de Crédito'
                  : obligation.isVariableAmount
                  ? 'Cuenta de Monto Variable (Luz, Agua, GGCC, etc.)'
                  : 'Recordatorio de Pago Fijo'}
              </span>
              <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
                {obligation.name}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumen de Referencia y Estadística Histórica de esta Cuenta */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-stone-50 dark:bg-zinc-800/60 border border-stone-200/70 dark:border-zinc-800 text-xs">
          <div className="min-w-0">
            <span className="text-[10px] text-stone-400 dark:text-zinc-500 block truncate">
              Monto Referencial
            </span>
            <span className="font-mono font-bold text-stone-800 dark:text-zinc-200">
              {obligation.amount > 0
                ? formatMoney(obligation.amount, currencySymbol)
                : 'Variable'}
            </span>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-stone-400 dark:text-zinc-500 block truncate">
              Último Pagado
            </span>
            <span className="font-mono font-bold text-stone-800 dark:text-zinc-200">
              {historicalStats.lastPaid > 0
                ? formatMoney(historicalStats.lastPaid, currencySymbol)
                : 'Sin registro'}
            </span>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-stone-400 dark:text-zinc-500 block truncate">
              Promedio (μ)
            </span>
            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
              {historicalStats.count > 0
                ? formatMoney(historicalStats.mean, currencySymbol)
                : '---'}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Input Principal: ¿Cuánto fue lo que pagaste en esta cuenta? */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/60 space-y-2">
            <label className="block text-xs font-bold text-stone-800 dark:text-zinc-100">
              ¿Cuánto fue lo que pagaste en esta cuenta? ({currencySymbol})
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400">
                {currencySymbol}
              </span>
              <input
                type="number"
                step="1"
                min="1"
                required
                autoFocus
                placeholder="Ingresa el monto exacto pagado"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="w-full pl-9 pr-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-800 text-lg font-extrabold font-mono text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            {/* Botones rápidos de sugerencia */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {obligation.amount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setAmountStr(String(Math.round(obligation.amount)))
                  }
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-[11px] font-mono font-semibold text-stone-700 dark:text-zinc-300 hover:border-emerald-500"
                >
                  Usar referencial ({formatMoney(obligation.amount, currencySymbol)})
                </button>
              )}
              {historicalStats.lastPaid > 0 &&
                historicalStats.lastPaid !== obligation.amount && (
                  <button
                    type="button"
                    onClick={() =>
                      setAmountStr(String(Math.round(historicalStats.lastPaid)))
                    }
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-[11px] font-mono font-semibold text-stone-700 dark:text-zinc-300 hover:border-emerald-500"
                  >
                    Último pago ({formatMoney(historicalStats.lastPaid, currencySymbol)})
                  </button>
                )}
            </div>

            {/* Indicador en vivo de diferencia contra el estimado */}
            {obligation.amount > 0 && parsedAmount > 0 && (
              <p className="text-[11px] font-mono text-stone-600 dark:text-zinc-400 pt-0.5">
                Diferencia vs. estimado:{' '}
                <strong
                  className={
                    diffFromEstimated > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : diffFromEstimated < 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-stone-700 dark:text-zinc-300'
                  }
                >
                  {diffFromEstimated > 0 ? '+' : ''}
                  {formatMoney(diffFromEstimated, currencySymbol)}
                </strong>{' '}
                (se reflejará en Estadísticas)
              </p>
            )}
          </div>

          {/* Selección de Cuenta y Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                <Wallet className="w-3.5 h-3.5" />
                Cuenta de Pago
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs font-semibold text-stone-800 dark:text-zinc-200"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                <Calendar className="w-3.5 h-3.5" />
                Fecha del Pago
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs font-mono text-stone-800 dark:text-zinc-200"
              />
            </div>
          </div>

          {/* Nota / Detalle de la boleta */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 dark:text-zinc-400 mb-1">
              Detalle o Lectura de Cuenta (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Boleta mes actual, consumo invierno, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs text-stone-800 dark:text-zinc-200"
            />
          </div>

          {/* Opción de actualizar el monto referencial */}
          <label className="flex items-center gap-2.5 text-xs text-stone-600 dark:text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={updateReferenceAmount}
              onChange={(e) => setUpdateReferenceAmount(e.target.checked)}
              className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-stone-400" />
              Actualizar monto referencial del recordatorio con este valor pagado
            </span>
          </label>

          {/* Botones de Acción */}
          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 text-stone-700 dark:text-zinc-300 text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={parsedAmount <= 0}
              className="flex-2 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirmar Pago ({formatMoney(parsedAmount, currencySymbol)})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
