import React, { useState, useEffect, useMemo } from 'react';
import {
  Account,
  AccountTransfer,
  AccountType,
  Category,
  ObligationStatus,
  RecurrenceFrequency,
  RecurringObligation,
  RenewalRule,
  Transaction,
  TransactionType,
} from '../domain/models';
import { CategoryIcon } from './GastitoLogo';
import {
  calculateCreditCardMetrics,
  calculateInstallmentEndDate,
  formatMoney,
  triggerHaptic,
} from '../data/localRepository';
import {
  X,
  Check,
  ArrowRightLeft,
  Calendar,
  FileText,
  Delete,
  CreditCard,
  Layers,
  Repeat,
} from 'lucide-react';

export type QuickEntryMode = 'EXPENSE' | 'INCOME' | 'TRANSFER';
export type CardChargeType = 'SINGLE' | 'INSTALLMENTS' | 'SUBSCRIPTION';

interface QuickEntryModalProps {
  isOpen: boolean;
  initialMode: QuickEntryMode;
  preselectCategoryId?: string;
  preselectAccountId?: string;
  initialCardChargeType?: CardChargeType;
  categories: Category[];
  accounts: Account[];
  transactions?: Transaction[];
  transfers?: AccountTransfer[];
  obligations?: RecurringObligation[];
  currencySymbol: string;
  hapticEnabled: boolean;
  editingTransaction?: Transaction | null;
  editingTransfer?: AccountTransfer | null;
  onClose: () => void;
  onSaveTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>, existingId?: string) => void;
  onSaveTransfer: (tr: Omit<AccountTransfer, 'id' | 'createdAt'>, existingId?: string) => void;
  onCreateRecurringFromCard?: (obl: Omit<RecurringObligation, 'id'>) => string;
}

function addOneMonth(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    const f = new Date();
    f.setMonth(f.getMonth() + 1);
    return f.toISOString().split('T')[0];
  }
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
}

export const QuickEntryModal: React.FC<QuickEntryModalProps> = ({
  isOpen,
  initialMode,
  preselectCategoryId,
  preselectAccountId,
  initialCardChargeType = 'SINGLE',
  categories,
  accounts,
  transactions = [],
  transfers = [],
  obligations = [],
  currencySymbol,
  hapticEnabled,
  editingTransaction,
  editingTransfer,
  onClose,
  onSaveTransaction,
  onSaveTransfer,
  onCreateRecurringFromCard,
}) => {
  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const todayStr = new Date().toISOString().split('T')[0];

  const [mode, setMode] = useState<QuickEntryMode>(initialMode);
  const [step, setStep] = useState<'CATEGORY' | 'DETAILS'>('CATEGORY');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    activeAccounts[0]?.id || ''
  );
  const [toAccountId, setToAccountId] = useState<string>(
    activeAccounts[1]?.id || activeAccounts[0]?.id || ''
  );
  const [date, setDate] = useState<string>(todayStr);
  const [description, setDescription] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Opciones específicas cuando se paga con Tarjeta de Crédito (Contado, En Cuotas o Suscripción)
  const [cardChargeType, setCardChargeType] = useState<CardChargeType>('SINGLE');
  const [installmentsCount, setInstallmentsCount] = useState<number>(3);
  const [amountInputBasis, setAmountInputBasis] = useState<'TOTAL' | 'PER_INSTALLMENT'>('TOTAL');

  const availableCategories = categories.filter(
    (c) =>
      !c.isDeleted &&
      c.isActive &&
      (mode === 'EXPENSE'
        ? c.type === TransactionType.EXPENSE || c.type === 'BOTH'
        : c.type === TransactionType.INCOME || c.type === 'BOTH')
  );

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');

    if (editingTransaction) {
      const m = editingTransaction.type === TransactionType.EXPENSE ? 'EXPENSE' : 'INCOME';
      setMode(m);
      setSelectedCategoryId(editingTransaction.categoryId);
      setAmountStr(String(editingTransaction.amount));
      setSelectedAccountId(editingTransaction.accountId);
      setDate(editingTransaction.date);
      setDescription(editingTransaction.description);
      setCardChargeType('SINGLE');
      setStep('DETAILS');
    } else if (editingTransfer) {
      setMode('TRANSFER');
      setSelectedAccountId(editingTransfer.fromAccountId);
      setToAccountId(editingTransfer.toAccountId);
      setAmountStr(String(editingTransfer.amount));
      setDate(editingTransfer.date);
      setDescription(editingTransfer.description);
      setCardChargeType('SINGLE');
      setStep('DETAILS');
    } else {
      setMode(initialMode);
      setAmountStr('');
      setDate(todayStr);
      setDescription('');
      setCardChargeType(initialCardChargeType);
      setInstallmentsCount(3);
      setAmountInputBasis('TOTAL');

      const defaultAccId =
        preselectAccountId || activeAccounts[0]?.id || 'acc-efectivo-default';
      setSelectedAccountId(defaultAccId);
      setToAccountId(activeAccounts[1]?.id || activeAccounts[0]?.id || 'acc-efectivo-default');

      if (initialMode === 'TRANSFER') {
        setStep('DETAILS');
      } else if (preselectCategoryId) {
        setSelectedCategoryId(preselectCategoryId);
        setStep('DETAILS');
      } else if (preselectAccountId && initialCardChargeType !== 'SINGLE') {
        const defaultCat =
          initialCardChargeType === 'SUBSCRIPTION'
            ? categories.find((c) => c.id === 'cat-suscripciones' && !c.isDeleted)?.id
            : categories.find((c) => c.id === 'cat-cuotas-tc' && !c.isDeleted)?.id;
        const filtered = categories.filter(
          (c) =>
            !c.isDeleted &&
            c.isActive &&
            (c.type === TransactionType.EXPENSE || c.type === 'BOTH')
        );
        setSelectedCategoryId(defaultCat || filtered[0]?.id || '');
        setStep('DETAILS');
      } else {
        const filtered = categories.filter(
          (c) =>
            !c.isDeleted &&
            c.isActive &&
            (initialMode === 'EXPENSE'
              ? c.type === TransactionType.EXPENSE || c.type === 'BOTH'
              : c.type === TransactionType.INCOME || c.type === 'BOTH')
        );
        setSelectedCategoryId(filtered[0]?.id || '');
        setStep('CATEGORY');
      }
    }
  }, [
    isOpen,
    initialMode,
    preselectCategoryId,
    preselectAccountId,
    initialCardChargeType,
    editingTransaction,
    editingTransfer,
  ]);

  const selectedAccObj = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId),
    [accounts, selectedAccountId]
  );

  const isCreditCardSelected =
    mode === 'EXPENSE' &&
    !editingTransaction &&
    selectedAccObj?.type === AccountType.CREDIT;

  const creditCardMetrics = useMemo(() => {
    if (!selectedAccObj || selectedAccObj.type !== AccountType.CREDIT) return null;
    return calculateCreditCardMetrics(
      selectedAccObj,
      transactions,
      transfers,
      obligations
    );
  }, [selectedAccObj, transactions, transfers, obligations]);

  if (!isOpen) return null;

  const rawEnteredNumber = Math.round(parseFloat(amountStr) || 0);
  const validMonths = Math.max(2, Math.min(60, Math.round(installmentsCount || 3)));

  // Cálculos de cuotas cuando está seleccionada una tarjeta de crédito y modo INSTALLMENTS
  const installmentCalc = (() => {
    if (!isCreditCardSelected || cardChargeType !== 'INSTALLMENTS') {
      return {
        monthlyInstallmentAmount: rawEnteredNumber,
        totalPurchaseAmount: rawEnteredNumber,
        futureCommittedAmount: 0,
        endDateStr: date || todayStr,
      };
    }
    if (amountInputBasis === 'TOTAL') {
      const monthly = rawEnteredNumber > 0 ? Math.max(1, Math.round(rawEnteredNumber / validMonths)) : 0;
      const total = rawEnteredNumber;
      const future = monthly * Math.max(0, validMonths - 1);
      return {
        monthlyInstallmentAmount: monthly,
        totalPurchaseAmount: total,
        futureCommittedAmount: future,
        endDateStr: calculateInstallmentEndDate(date || todayStr, validMonths - 1),
      };
    } else {
      const monthly = rawEnteredNumber;
      const total = monthly * validMonths;
      const future = monthly * Math.max(0, validMonths - 1);
      return {
        monthlyInstallmentAmount: monthly,
        totalPurchaseAmount: total,
        futureCommittedAmount: future,
        endDateStr: calculateInstallmentEndDate(date || todayStr, validMonths - 1),
      };
    }
  })();

  const handleSelectCategory = (catId: string) => {
    triggerHaptic(hapticEnabled, 12);
    setSelectedCategoryId(catId);
    setStep('DETAILS');
  };

  const handleKeyPress = (key: string) => {
    triggerHaptic(hapticEnabled, 8);
    setErrorMsg('');
    if (key === 'BACK') {
      setAmountStr((prev) => prev.slice(0, -1));
      return;
    }
    if (key === 'CLEAR') {
      setAmountStr('');
      return;
    }
    if (key === '000') {
      setAmountStr((prev) => (prev === '' || prev === '0' ? '' : (prev + '000').slice(0, 12)));
      return;
    }
    if (amountStr.length >= 12) return;

    setAmountStr((prev) => (prev === '0' ? key : prev + key));
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amountStr);
    if (!numericAmount || numericAmount <= 0) {
      setErrorMsg('Ingresa un monto mayor a cero.');
      triggerHaptic(hapticEnabled, [30, 40, 30]);
      return;
    }

    if (mode === 'TRANSFER') {
      if (!selectedAccountId || !toAccountId) {
        setErrorMsg('Selecciona las cuentas de origen y destino.');
        return;
      }
      if (selectedAccountId === toAccountId) {
        setErrorMsg('La cuenta de origen y destino deben ser diferentes.');
        triggerHaptic(hapticEnabled, [30, 40, 30]);
        return;
      }
      triggerHaptic(hapticEnabled, 20);
      onSaveTransfer(
        {
          fromAccountId: selectedAccountId,
          toAccountId,
          amount: Math.round(numericAmount),
          date: date || todayStr,
          description: description.trim(),
        },
        editingTransfer?.id
      );
      onClose();
      return;
    }

    if (!selectedCategoryId) {
      setErrorMsg('Selecciona una categoría.');
      return;
    }
    if (!selectedAccountId) {
      setErrorMsg('Selecciona una cuenta.');
      return;
    }

    triggerHaptic(hapticEnabled, 20);
    const txDate = date || todayStr;
    const catObj = categories.find((c) => c.id === selectedCategoryId);
    const baseDesc = description.trim() || catObj?.name || 'Compra con tarjeta';

    // Caso 1: Compra en Cuotas con Tarjeta de Crédito (genera Cuota 1/N hoy + Gasto Fijo mensual con término)
    if (isCreditCardSelected && cardChargeType === 'INSTALLMENTS') {
      const monthlyAmt = installmentCalc.monthlyInstallmentAmount;
      const totalPurchase = installmentCalc.totalPurchaseAmount;
      const nextDueDate = addOneMonth(txDate);
      const endDateStr = installmentCalc.endDateStr;

      let createdOblId: string | undefined;
      if (onCreateRecurringFromCard) {
        createdOblId = onCreateRecurringFromCard({
          name: `${baseDesc} (${validMonths} cuotas)`,
          categoryId: selectedCategoryId,
          amount: monthlyAmt,
          isVariableAmount: false,
          isInstallmentPlan: true,
          totalInstallments: validMonths,
          paidInstallments: 1,
          installmentTotalAmount: totalPurchase,
          endDate: endDateStr,
          autoChargeCard: true,
          accountId: selectedAccountId,
          dueDate: nextDueDate,
          frequency: RecurrenceFrequency.MONTHLY,
          renewalRule: RenewalRule.AUTO_CREATE,
          notificationsEnabled: true,
          status: ObligationStatus.PENDING,
          lastPaidDate: txDate,
          lastPaidAmount: monthlyAmt,
        });
      }

      onSaveTransaction({
        type: TransactionType.EXPENSE,
        categoryId: selectedCategoryId,
        amount: monthlyAmt,
        accountId: selectedAccountId,
        date: txDate,
        description: `${baseDesc} · Cuota 1/${validMonths} (Total: ${formatMoney(
          totalPurchase,
          currencySymbol
        )})`,
        linkedObligationId: createdOblId,
        installmentInfo: {
          current: 1,
          total: validMonths,
          totalPurchaseAmount: totalPurchase,
        },
      });
      onClose();
      return;
    }

    // Caso 2: Suscripción Automática en Tarjeta de Crédito
    if (isCreditCardSelected && cardChargeType === 'SUBSCRIPTION') {
      const subAmt = Math.round(numericAmount);
      const nextDueDate = addOneMonth(txDate);
      let createdOblId: string | undefined;

      if (onCreateRecurringFromCard) {
        createdOblId = onCreateRecurringFromCard({
          name: baseDesc,
          categoryId: selectedCategoryId,
          amount: subAmt,
          isVariableAmount: false,
          isSubscription: true,
          autoChargeCard: true,
          accountId: selectedAccountId,
          dueDate: nextDueDate,
          frequency: RecurrenceFrequency.MONTHLY,
          renewalRule: RenewalRule.AUTO_CREATE,
          notificationsEnabled: true,
          status: ObligationStatus.PENDING,
          lastPaidDate: txDate,
          lastPaidAmount: subAmt,
        });
      }

      onSaveTransaction({
        type: TransactionType.EXPENSE,
        categoryId: selectedCategoryId,
        amount: subAmt,
        accountId: selectedAccountId,
        date: txDate,
        description: `Suscripción en tarjeta: ${baseDesc}`,
        linkedObligationId: createdOblId,
      });
      onClose();
      return;
    }

    // Caso 3: Gasto o Ingreso normal
    onSaveTransaction(
      {
        type: mode === 'EXPENSE' ? TransactionType.EXPENSE : TransactionType.INCOME,
        categoryId: selectedCategoryId,
        amount: Math.round(numericAmount),
        accountId: selectedAccountId,
        date: txDate,
        description: description.trim(),
      },
      editingTransaction?.id
    );
    onClose();
  };

  const selectedCatObj = categories.find((c) => c.id === selectedCategoryId);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            {!editingTransaction && !editingTransfer ? (
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMode('EXPENSE');
                    setStep('CATEGORY');
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    mode === 'EXPENSE'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  Gasto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('INCOME');
                    setStep('CATEGORY');
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    mode === 'INCOME'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  Ingreso
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('TRANSFER');
                    setStep('DETAILS');
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    mode === 'TRANSFER'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  Transferencia
                </button>
              </div>
            ) : (
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {editingTransfer
                  ? 'Editar transferencia entre cuentas'
                  : editingTransaction?.type === TransactionType.EXPENSE
                  ? 'Editar gasto'
                  : 'Editar ingreso'}
              </h3>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-4">
          {mode !== 'TRANSFER' && step === 'CATEGORY' ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Paso 1 de 2 · Selecciona una categoría para continuar al instante
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {availableCategories.map((cat) => {
                  const isSelected = cat.id === selectedCategoryId;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleSelectCategory(cat.id)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all min-h-[82px] active:scale-[0.97] ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center mb-1.5 text-white"
                        style={{ backgroundColor: cat.color }}
                      >
                        <CategoryIcon name={cat.icon} size={18} />
                      </div>
                      <span className="text-xs font-medium leading-tight line-clamp-2">
                        {cat.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <form onSubmit={handleConfirm} className="space-y-4">
              {/* Selected Category Bar (if Expense/Income) */}
              {mode !== 'TRANSFER' && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: selectedCatObj?.color || '#10B981' }}
                    >
                      <CategoryIcon name={selectedCatObj?.icon || 'Utensils'} size={18} />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Categoría</div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {selectedCatObj?.name || 'Seleccionar'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep('CATEGORY')}
                    className="px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
                  >
                    Cambiar categoría
                  </button>
                </div>
              )}

              {/* Amount Display + Native Input Fallback */}
              <div className="p-4 rounded-2xl bg-slate-900 dark:bg-slate-950 text-white border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>
                    {mode === 'EXPENSE'
                      ? isCreditCardSelected && cardChargeType === 'INSTALLMENTS'
                        ? amountInputBasis === 'TOTAL'
                          ? 'Monto total de la compra en cuotas'
                          : 'Valor de cada cuota mensual'
                        : 'Monto del gasto'
                      : mode === 'INCOME'
                      ? 'Monto del ingreso'
                      : 'Monto a transferir'}
                  </span>
                  <span>Sin centavos</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-mono-num text-slate-400">{currencySymbol}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="0"
                    value={amountStr}
                    onChange={(e) => {
                      setErrorMsg('');
                      setAmountStr(e.target.value.replace(/[^0-9]/g, ''));
                    }}
                    placeholder="0"
                    className="w-full bg-transparent text-right text-3xl sm:text-4xl font-bold font-mono-num text-white focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>

              {/* Tactile Number Pad for 1-Handed Speed */}
              <div className="grid grid-cols-4 gap-2">
                {['1', '2', '3', 'CLEAR', '4', '5', '6', 'BACK', '7', '8', '9', '000', '0', '00'].map(
                  (key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (key === '00') {
                          handleKeyPress('0');
                          handleKeyPress('0');
                        } else {
                          handleKeyPress(key);
                        }
                      }}
                      className={`${
                        key === '00' ? 'col-span-2' : ''
                      } min-h-[42px] rounded-xl font-mono-num text-base font-semibold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.97] transition-all flex items-center justify-center`}
                    >
                      {key === 'BACK' ? (
                        <Delete size={18} />
                      ) : key === 'CLEAR' ? (
                        <span className="text-xs font-sans font-semibold text-rose-600 dark:text-rose-400">
                          C
                        </span>
                      ) : (
                        key
                      )}
                    </button>
                  )
                )}
              </div>

              {/* Account Selection */}
              {mode === 'TRANSFER' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Desde cuenta (Origen)
                    </label>
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                    >
                      {activeAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Hacia cuenta (Destino)
                    </label>
                    <select
                      value={toAccountId}
                      onChange={(e) => setToAccountId(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                    >
                      {activeAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Cuenta de pago (Selecciona una Tarjeta de Crédito para pagar en Cuotas o Suscripción)
                  </label>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {activeAccounts.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => setSelectedAccountId('acc-efectivo-default')}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap transition-colors min-h-[42px] bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                      >
                        Efectivo (se creará automáticamente)
                      </button>
                    ) : (
                      activeAccounts.map((acc) => {
                        const active = acc.id === selectedAccountId;
                        const isCC = acc.type === AccountType.CREDIT;
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => {
                              triggerHaptic(hapticEnabled, 10);
                              setSelectedAccountId(acc.id);
                            }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap transition-colors min-h-[42px] flex items-center gap-1.5 ${
                              active
                                ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                            }`}
                          >
                            {isCC && <CreditCard size={14} />}
                            <span>{acc.name}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* PANEL ESPECIAL DE TARJETA DE CRÉDITO: CUPO DISPONIBLE + PAGO EN CUOTAS O SUSCRIPCIÓN */}
              {isCreditCardSelected && creditCardMetrics && (
                <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/25 border border-indigo-200 dark:border-indigo-900/60 space-y-3.5">
                  {/* Resumen de Cupo de la Tarjeta */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-indigo-900 dark:text-indigo-200">
                      <CreditCard size={15} className="text-indigo-600 dark:text-indigo-400" />
                      <span>{selectedAccObj?.name}</span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      Disponible:{' '}
                      <strong className="text-emerald-700 dark:text-emerald-400">
                        {formatMoney(creditCardMetrics.availableCredit, currencySymbol)}
                      </strong>{' '}
                      / Cupo: {formatMoney(creditCardMetrics.creditLimit, currencySymbol)}
                    </div>
                  </div>

                  {/* Selector de Modalidad de Cargo en la Tarjeta */}
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-white dark:bg-slate-900 rounded-xl border border-indigo-200/80 dark:border-indigo-900/60">
                    <button
                      type="button"
                      onClick={() => setCardChargeType('SINGLE')}
                      className={`py-2 px-2 rounded-lg text-[11px] font-bold transition-all ${
                        cardChargeType === 'SINGLE'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      1 Cuota / Contado
                    </button>
                    <button
                      type="button"
                      onClick={() => setCardChargeType('INSTALLMENTS')}
                      className={`py-2 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                        cardChargeType === 'INSTALLMENTS'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Layers size={12} />
                      En Cuotas
                    </button>
                    <button
                      type="button"
                      onClick={() => setCardChargeType('SUBSCRIPTION')}
                      className={`py-2 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                        cardChargeType === 'SUBSCRIPTION'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Repeat size={12} />
                      Suscripción
                    </button>
                  </div>

                  {/* Configuración detallada cuando se elige "En Cuotas" */}
                  {cardChargeType === 'INSTALLMENTS' && (
                    <div className="space-y-3 pt-1 border-t border-indigo-200/60 dark:border-indigo-900/50">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setAmountInputBasis('TOTAL')}
                          className={`py-1.5 px-2.5 rounded-lg text-[11px] font-semibold border transition-all ${
                            amountInputBasis === 'TOTAL'
                              ? 'bg-indigo-100 dark:bg-indigo-950/80 border-indigo-400 text-indigo-900 dark:text-indigo-200'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          Ingresé el Total Compra
                        </button>
                        <button
                          type="button"
                          onClick={() => setAmountInputBasis('PER_INSTALLMENT')}
                          className={`py-1.5 px-2.5 rounded-lg text-[11px] font-semibold border transition-all ${
                            amountInputBasis === 'PER_INSTALLMENT'
                              ? 'bg-indigo-100 dark:bg-indigo-950/80 border-indigo-400 text-indigo-900 dark:text-indigo-200'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          Ingresé Valor de 1 Cuota
                        </button>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Número de Cuotas / Meses (Gasto fijo con fecha de término):
                        </label>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {[3, 6, 12, 18, 24].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setInstallmentsCount(n)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                                installmentsCount === n
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              {n}m
                            </button>
                          ))}
                          <div className="flex items-center gap-1 ml-auto">
                            <span className="text-[11px] text-slate-500">Otra:</span>
                            <input
                              type="number"
                              min="2"
                              max="60"
                              value={installmentsCount}
                              onChange={(e) =>
                                setInstallmentsCount(
                                  Math.max(2, Math.min(60, parseInt(e.target.value, 10) || 2))
                                )
                              }
                              className="w-16 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-center"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Resumen en vivo de la compra en cuotas */}
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200/80 dark:border-indigo-900/60 text-xs space-y-1 font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Cuota fija mensual ({validMonths} meses):</span>
                          <strong className="text-indigo-700 dark:text-indigo-400">
                            {formatMoney(installmentCalc.monthlyInstallmentAmount, currencySymbol)} / mes
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Total comprometido en cupo:</span>
                          <strong className="text-slate-900 dark:text-white">
                            {formatMoney(installmentCalc.totalPurchaseAmount, currencySymbol)}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Término automático de cuotas:</span>
                          <strong className="text-emerald-700 dark:text-emerald-400">
                            {installmentCalc.endDateStr}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Explicación cuando se elige "Suscripción" */}
                  {cardChargeType === 'SUBSCRIPTION' && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 pt-1 border-t border-indigo-200/60 dark:border-indigo-900/50">
                      Se registrará el cobro de hoy y quedará guardada en <strong>Suscripciones de tu Tarjeta</strong> para cargarse automáticamente cada mes en esta misma fecha.
                    </p>
                  )}
                </div>
              )}

              {/* Date and Optional Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    <Calendar size={13} />
                    <span>Fecha del cargo</span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    <FileText size={13} />
                    <span>
                      {isCreditCardSelected && cardChargeType === 'SUBSCRIPTION'
                        ? 'Nombre de la suscripción'
                        : isCreditCardSelected && cardChargeType === 'INSTALLMENTS'
                        ? 'Detalle de la compra en cuotas'
                        : 'Descripción (opcional)'}
                    </span>
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={
                      isCreditCardSelected && cardChargeType === 'SUBSCRIPTION'
                        ? 'Ej. Netflix, Spotify, iCloud, Gimnasio...'
                        : isCreditCardSelected && cardChargeType === 'INSTALLMENTS'
                        ? 'Ej. Notebook, Refrigerador, Pasajes...'
                        : 'Ej. Almuerzo, factura, nota...'
                    }
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300">
                  {errorMsg}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className={`w-full min-h-[48px] rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 shadow-md transition-transform active:scale-[0.99] ${
                  mode === 'EXPENSE'
                    ? isCreditCardSelected && cardChargeType !== 'SINGLE'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                    : mode === 'INCOME'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-sky-600 hover:bg-sky-700'
                }`}
              >
                {mode === 'TRANSFER' ? <ArrowRightLeft size={18} /> : <Check size={18} />}
                <span>
                  {editingTransaction || editingTransfer
                    ? 'Guardar cambios'
                    : mode === 'EXPENSE'
                    ? isCreditCardSelected && cardChargeType === 'INSTALLMENTS'
                      ? `Registrar Cuota 1/${validMonths} (${formatMoney(
                          installmentCalc.monthlyInstallmentAmount,
                          currencySymbol
                        )}/mes)`
                      : isCreditCardSelected && cardChargeType === 'SUBSCRIPTION'
                      ? `Activar Suscripción en Tarjeta (${formatMoney(
                          rawEnteredNumber,
                          currencySymbol
                        )}/mes)`
                      : `Registrar gasto ${
                          rawEnteredNumber > 0
                            ? formatMoney(rawEnteredNumber, currencySymbol)
                            : ''
                        }`
                    : mode === 'INCOME'
                    ? `Registrar ingreso ${
                        rawEnteredNumber > 0
                          ? formatMoney(rawEnteredNumber, currencySymbol)
                          : ''
                      }`
                    : `Transferir ${
                        rawEnteredNumber > 0
                          ? formatMoney(rawEnteredNumber, currencySymbol)
                          : ''
                      }`}
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
