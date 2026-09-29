import React, { useState, useEffect } from 'react';
import {
  Account,
  AccountTransfer,
  Category,
  Transaction,
  TransactionType,
} from '../domain/models';
import { CategoryIcon } from './GastitoLogo';
import { formatMoney, triggerHaptic } from '../data/localRepository';
import { X, Check, ArrowRightLeft, Calendar, FileText, Delete } from 'lucide-react';

export type QuickEntryMode = 'EXPENSE' | 'INCOME' | 'TRANSFER';

interface QuickEntryModalProps {
  isOpen: boolean;
  initialMode: QuickEntryMode;
  preselectCategoryId?: string;
  categories: Category[];
  accounts: Account[];
  currencySymbol: string;
  hapticEnabled: boolean;
  editingTransaction?: Transaction | null;
  editingTransfer?: AccountTransfer | null;
  onClose: () => void;
  onSaveTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>, existingId?: string) => void;
  onSaveTransfer: (tr: Omit<AccountTransfer, 'id' | 'createdAt'>, existingId?: string) => void;
}

export const QuickEntryModal: React.FC<QuickEntryModalProps> = ({
  isOpen,
  initialMode,
  preselectCategoryId,
  categories,
  accounts,
  currencySymbol,
  hapticEnabled,
  editingTransaction,
  editingTransfer,
  onClose,
  onSaveTransaction,
  onSaveTransfer,
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
      setStep('DETAILS');
    } else if (editingTransfer) {
      setMode('TRANSFER');
      setSelectedAccountId(editingTransfer.fromAccountId);
      setToAccountId(editingTransfer.toAccountId);
      setAmountStr(String(editingTransfer.amount));
      setDate(editingTransfer.date);
      setDescription(editingTransfer.description);
      setStep('DETAILS');
    } else {
      setMode(initialMode);
      setAmountStr('');
      setDate(todayStr);
      setDescription('');
      setSelectedAccountId(activeAccounts[0]?.id || 'acc-efectivo-default');
      setToAccountId(activeAccounts[1]?.id || activeAccounts[0]?.id || 'acc-efectivo-default');

      if (initialMode === 'TRANSFER') {
        setStep('DETAILS');
      } else if (preselectCategoryId) {
        setSelectedCategoryId(preselectCategoryId);
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
  }, [isOpen, initialMode, preselectCategoryId, editingTransaction, editingTransfer]);

  if (!isOpen) return null;

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
    onSaveTransaction(
      {
        type: mode === 'EXPENSE' ? TransactionType.EXPENSE : TransactionType.INCOME,
        categoryId: selectedCategoryId,
        amount: Math.round(numericAmount),
        accountId: selectedAccountId,
        date: date || todayStr,
        description: description.trim(),
      },
      editingTransaction?.id
    );
    onClose();
  };

  const selectedCatObj = categories.find((c) => c.id === selectedCategoryId);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
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
        <div className="overflow-y-auto p-5 space-y-5">
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
                      ? 'Monto del gasto'
                      : mode === 'INCOME'
                      ? 'Monto del ingreso'
                      : 'Monto a transferir'}
                  </span>
                  <span>Teclado numérico nativo</span>
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
                      } min-h-[44px] rounded-xl font-mono-num text-base font-semibold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.97] transition-all flex items-center justify-center`}
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
                    Cuenta
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
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => {
                              triggerHaptic(hapticEnabled, 10);
                              setSelectedAccountId(acc.id);
                            }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap transition-colors min-h-[42px] ${
                              active
                                ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                            }`}
                          >
                            {acc.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Date and Optional Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    <Calendar size={13} />
                    <span>Fecha (cualquier día)</span>
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
                    <span>Descripción (opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ej. Almuerzo, factura, nota..."
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
                    ? 'bg-rose-600 hover:bg-rose-700'
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
                    ? `Registrar gasto ${
                        parseFloat(amountStr) > 0
                          ? formatMoney(parseFloat(amountStr), currencySymbol)
                          : ''
                      }`
                    : mode === 'INCOME'
                    ? `Registrar ingreso ${
                        parseFloat(amountStr) > 0
                          ? formatMoney(parseFloat(amountStr), currencySymbol)
                          : ''
                      }`
                    : `Transferir ${
                        parseFloat(amountStr) > 0
                          ? formatMoney(parseFloat(amountStr), currencySymbol)
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
