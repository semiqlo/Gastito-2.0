import React, { useState } from 'react';
import {
  Account,
  AccountTransfer,
  AccountType,
  Category,
  RecurringObligation,
  Transaction,
} from '../domain/models';
import {
  calculateAccountBalance,
  calculateCreditCardMetrics,
  formatMoney,
  triggerHaptic,
} from '../data/localRepository';
import { CardChargeType } from './QuickEntryModal';
import { CategoryIcon } from './GastitoLogo';
import {
  Landmark,
  Wallet,
  CreditCard,
  CircleDollarSign,
  Plus,
  ArrowRightLeft,
  Edit2,
  Trash2,
  Layers,
  Repeat,
  CalendarClock,
  CheckCircle2,
} from 'lucide-react';

interface AccountsTabProps {
  accounts: Account[];
  categories?: Category[];
  transactions: Transaction[];
  transfers: AccountTransfer[];
  obligations?: RecurringObligation[];
  currencySymbol: string;
  hapticEnabled: boolean;
  onSaveAccount: (
    acc: Omit<Account, 'id' | 'createdAt' | 'isArchived'>,
    existingId?: string
  ) => void;
  onDeleteAccount: (id: string) => void;
  onOpenTransferModal: () => void;
  onOpenCardActionModal?: (accountId: string, chargeType: CardChargeType) => void;
  onPayObligation?: (obligation: RecurringObligation) => void;
  onDeleteObligation?: (obligationId: string) => void;
  onEditTransfer: (tr: AccountTransfer) => void;
  onDeleteTransfer: (id: string) => void;
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  [AccountType.BANK]: 'Cuenta bancaria / Débito',
  [AccountType.CASH]: 'Efectivo',
  [AccountType.CREDIT]: 'Tarjeta de crédito',
  [AccountType.OTHER]: 'Otra cuenta',
};

export const AccountsTab: React.FC<AccountsTabProps> = ({
  accounts,
  categories = [],
  transactions,
  transfers,
  obligations = [],
  currencySymbol,
  hapticEnabled,
  onSaveAccount,
  onDeleteAccount,
  onOpenTransferModal,
  onOpenCardActionModal,
  onPayObligation,
  onDeleteObligation,
  onEditTransfer,
  onDeleteTransfer,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingAcc, setEditingAcc] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>(AccountType.BANK);
  const [initialBalance, setInitialBalance] = useState('0');
  const [creditLimit, setCreditLimit] = useState('1500000');
  const [billingDay, setBillingDay] = useState('18');
  const [paymentDueDay, setPaymentDueDay] = useState('5');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [confirmDeleteAccId, setConfirmDeleteAccId] = useState<string | null>(null);

  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const creditCardAccounts = activeAccounts.filter(
    (a) => a.type === AccountType.CREDIT
  );
  const accMap = new Map(accounts.map((a) => [a.id, a]));
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const totalNetWorth = activeAccounts.reduce(
    (sum, acc) => sum + calculateAccountBalance(acc, transactions, transfers),
    0
  );

  const openNewAccountForm = (presetType: AccountType = AccountType.BANK) => {
    setEditingAcc(null);
    setName('');
    setType(presetType);
    setInitialBalance('0');
    setCreditLimit('1500000');
    setBillingDay('18');
    setPaymentDueDay('5');
    setAdditionalInfo('');
    setShowForm(true);
  };

  const openEditAccountForm = (acc: Account) => {
    setEditingAcc(acc);
    setName(acc.name);
    setType(acc.type);
    setInitialBalance(String(Math.round(acc.initialBalance || 0)));
    setCreditLimit(String(Math.round(acc.creditLimit || 1500000)));
    setBillingDay(String(acc.billingDay || 18));
    setPaymentDueDay(String(acc.paymentDueDay || 5));
    setAdditionalInfo(acc.additionalInfo);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    triggerHaptic(hapticEnabled, 18);
    const isCC = type === AccountType.CREDIT;
    onSaveAccount(
      {
        name: name.trim(),
        type,
        initialBalance: Math.round(parseFloat(initialBalance) || 0),
        creditLimit: isCC ? Math.max(0, Math.round(parseFloat(creditLimit) || 0)) : undefined,
        billingDay: isCC ? Math.min(31, Math.max(1, parseInt(billingDay, 10) || 18)) : undefined,
        paymentDueDay: isCC
          ? Math.min(31, Math.max(1, parseInt(paymentDueDay, 10) || 5))
          : undefined,
        additionalInfo: additionalInfo.trim(),
      },
      editingAcc?.id
    );
    setShowForm(false);
  };

  const renderAccountIcon = (accType: AccountType) => {
    switch (accType) {
      case AccountType.BANK:
        return <Landmark size={20} />;
      case AccountType.CASH:
        return <Wallet size={20} />;
      case AccountType.CREDIT:
        return <CreditCard size={20} />;
      default:
        return <CircleDollarSign size={20} />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white">
            Cuentas, Tarjetas de Crédito y Transferencias
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Patrimonio líquido consolidado:{' '}
            <strong className="font-mono-num text-slate-900 dark:text-white">
              {formatMoney(totalNetWorth, currencySymbol)}
            </strong>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenTransferModal}
            className="px-3.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap min-h-[40px]"
          >
            <ArrowRightLeft size={15} />
            <span>Transferir / Pagar TC</span>
          </button>
          <button
            type="button"
            onClick={() => openNewAccountForm(AccountType.CREDIT)}
            className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap min-h-[40px]"
          >
            <CreditCard size={15} />
            <span>Nueva Tarjeta Crédito</span>
          </button>
          <button
            type="button"
            onClick={() => openNewAccountForm(AccountType.BANK)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap min-h-[40px]"
          >
            <Plus size={15} />
            <span>Nueva Cuenta</span>
          </button>
        </div>
      </section>

      {/* Account Form Modal/Drawer */}
      {showForm && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-500/40 p-6 shadow-lg">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
            {editingAcc ? 'Editar cuenta o tarjeta de crédito' : 'Crear nueva cuenta o tarjeta'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Nombre de la cuenta o tarjeta
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Tarjeta Crédito Visa, Cuenta Rut..."
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Tipo de cuenta
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
              >
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {type === AccountType.CREDIT ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-400 mb-1">
                    Cupo Total Autorizado de la Tarjeta ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    placeholder="Ej. 1500000"
                    className="w-full h-11 px-3 rounded-xl border border-indigo-300 dark:border-indigo-800 bg-white dark:bg-slate-950 text-sm font-mono-num font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Día Facturación (1-31)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={billingDay}
                      onChange={(e) => setBillingDay(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-mono-num text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Día Pago Límite (1-31)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={paymentDueDay}
                      onChange={(e) => setPaymentDueDay(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-mono-num text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Saldo base inicial ({currencySymbol})
                </label>
                <input
                  type="number"
                  step="1"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-mono-num text-slate-900 dark:text-white"
                />
              </div>
            )}

            <div className={type === AccountType.CREDIT ? 'sm:col-span-2' : ''}>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Información adicional ( últimos 4 dígitos, banco, notas)
              </label>
              <input
                type="text"
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                placeholder="Ej. Corte día 18, terminación 4821"
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                {editingAcc ? 'Guardar cambios' : 'Crear cuenta'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* SECCIÓN NOTORIA DE TARJETAS DE CRÉDITO: CUPO TOTAL, CUPO UTILIZADO, DISPONIBLE PARA GASTAR, CUOTAS Y SUSCRIPCIONES */}
      {creditCardAccounts.length > 0 && (
        <section className="space-y-5">
          {creditCardAccounts.map((ccAcc) => {
            const cc = calculateCreditCardMetrics(
              ccAcc,
              transactions,
              transfers,
              obligations
            );

            return (
              <div
                key={ccAcc.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-indigo-500/30 dark:border-indigo-500/40 p-6 space-y-5 shadow-xs"
              >
                {/* Encabezado de la Tarjeta de Crédito */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <CreditCard size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          Control de Tarjeta de Crédito y Cupo
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        {ccAcc.name}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {ccAcc.additionalInfo ||
                          `Facturación día ${ccAcc.billingDay || 18} · Pago día ${
                            ccAcc.paymentDueDay || 5
                          }`}
                      </p>
                    </div>
                  </div>

                  {/* Acciones rápidas de la Tarjeta de Crédito */}
                  <div className="flex flex-wrap items-center gap-2">
                    {onOpenCardActionModal && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic(hapticEnabled, 15);
                            onOpenCardActionModal(ccAcc.id, 'INSTALLMENTS');
                          }}
                          className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"
                        >
                          <Layers size={14} />
                          <span>+ Compra en Cuotas</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic(hapticEnabled, 15);
                            onOpenCardActionModal(ccAcc.id, 'SUBSCRIPTION');
                          }}
                          className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5"
                        >
                          <Repeat size={14} />
                          <span>+ Suscripción</span>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditAccountForm(ccAcc)}
                      className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Edit2 size={13} />
                      <span>Ajustar Cupo</span>
                    </button>
                  </div>
                </div>

                {/* 4 Recuadros Notorios de Cupo Total, Gastado/Comprometido, Disponible para Gastar y Carga Fija */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="min-w-0 overflow-hidden p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60">
                    <span className="text-[11px] font-bold uppercase text-emerald-800 dark:text-emerald-300 block truncate">
                      Disponible para Gastar
                    </span>
                    <p className="text-lg sm:text-xl font-extrabold font-mono-num text-emerald-700 dark:text-emerald-400 mt-1 break-all leading-tight">
                      {formatMoney(cc.availableCredit, currencySymbol)}
                    </p>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {(100 - cc.usagePct).toFixed(0)}% del cupo libre
                    </span>
                  </div>

                  <div className="min-w-0 overflow-hidden p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60">
                    <span className="text-[11px] font-bold uppercase text-rose-800 dark:text-rose-300 block truncate">
                      Cupo Utilizado Total
                    </span>
                    <p className="text-lg sm:text-xl font-extrabold font-mono-num text-rose-600 dark:text-rose-400 mt-1 break-all leading-tight">
                      {formatMoney(cc.totalUsedCredit, currencySymbol)}
                    </p>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      Facturado: {formatMoney(cc.billedDebt, currencySymbol)} + Cuotas:{' '}
                      {formatMoney(cc.futureInstallmentsCommitted, currencySymbol)}
                    </span>
                  </div>

                  <div className="min-w-0 overflow-hidden p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 block truncate">
                      Cupo Total Autorizado
                    </span>
                    <p className="text-lg sm:text-xl font-extrabold font-mono-num text-slate-900 dark:text-white mt-1 break-all leading-tight">
                      {formatMoney(cc.creditLimit, currencySymbol)}
                    </p>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Uso actual: {cc.usagePct.toFixed(1)}%
                    </span>
                  </div>

                  <div className="min-w-0 overflow-hidden p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900/50">
                    <span className="text-[11px] font-bold uppercase text-indigo-700 dark:text-indigo-300 block truncate">
                      Cargo Automático Mensual
                    </span>
                    <p className="text-lg sm:text-xl font-extrabold font-mono-num text-indigo-700 dark:text-indigo-400 mt-1 break-all leading-tight">
                      {formatMoney(cc.totalMonthlyFixedCardLoad, currencySymbol)}/mes
                    </p>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {cc.activeInstallments.length} en cuotas · {cc.activeSubscriptions.length}{' '}
                      suscripciones
                    </span>
                  </div>
                </div>

                {/* Barra Visual de Uso del Cupo de la Tarjeta */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-600 dark:text-slate-400">
                      Ocupación del cupo de tarjeta ({cc.usagePct.toFixed(1)}%)
                    </span>
                    <span className="text-slate-900 dark:text-white font-bold">
                      Gastado {formatMoney(cc.totalUsedCredit, currencySymbol)} de{' '}
                      {formatMoney(cc.creditLimit, currencySymbol)}
                    </span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
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
                </div>

                {/* Grid de Compras en Cuotas Activas y Suscripciones Automáticas en esta Tarjeta */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {/* Columna 1: Compras en Cuotas Activas (con fecha de término) */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Layers size={14} className="text-indigo-600" />
                        <span>
                          Compras en Cuotas Activas ({cc.activeInstallments.length})
                        </span>
                      </h3>
                      <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {formatMoney(cc.monthlyInstallmentsLoad, currencySymbol)}/mes
                      </span>
                    </div>

                    {cc.activeInstallments.length === 0 ? (
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500">
                        Sin compras en cuotas activas en esta tarjeta.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {cc.activeInstallments.map((inst) => {
                          const totalM = Math.max(1, inst.totalInstallments || 1);
                          const paidM = Math.min(
                            totalM,
                            Math.max(0, inst.paidInstallments || 0)
                          );
                          const remM = Math.max(0, totalM - paidM);
                          const remDebt = remM * inst.amount;
                          const progPct = (paidM / totalM) * 100;

                          return (
                            <div
                              key={inst.id}
                              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {inst.name}
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                    Cuota <strong>{paidM}</strong> de{' '}
                                    <strong>{totalM}</strong> · Quedan{' '}
                                    <strong>{remM} meses</strong>
                                    {inst.endDate ? ` · Termina ${inst.endDate}` : ''}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-xs font-bold font-mono text-indigo-700 dark:text-indigo-400 block">
                                    {formatMoney(inst.amount, currencySymbol)}/mes
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-400">
                                    Restan: {formatMoney(remDebt, currencySymbol)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-indigo-600 rounded-full"
                                    style={{ width: `${progPct}%` }}
                                  />
                                </div>
                                {onPayObligation && remM > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => onPayObligation(inst)}
                                    className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 shrink-0"
                                  >
                                    <CheckCircle2 size={11} />
                                    <span>Cargar cuota {paidM + 1}</span>
                                  </button>
                                )}
                                {onDeleteObligation && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteObligation(inst.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600"
                                    title="Eliminar plan en cuotas"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Columna 2: Suscripciones Automáticas en esta Tarjeta */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Repeat size={14} className="text-purple-600" />
                        <span>
                          Suscripciones Automáticas en Tarjeta ({cc.activeSubscriptions.length})
                        </span>
                      </h3>
                      <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">
                        {formatMoney(cc.monthlySubscriptionsLoad, currencySymbol)}/mes
                      </span>
                    </div>

                    {cc.activeSubscriptions.length === 0 ? (
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500">
                        No hay suscripciones asociadas a esta tarjeta. Usa “+ Suscripción” para tenerlas a la vista.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {cc.activeSubscriptions.map((sub) => {
                          const cat = catMap.get(sub.categoryId);
                          return (
                            <div
                              key={sub.id}
                              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
                                  style={{ backgroundColor: cat?.color || '#8B5CF6' }}
                                >
                                  <CategoryIcon
                                    name={cat?.icon || 'Film'}
                                    size={15}
                                  />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {sub.name}
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                    <CalendarClock size={11} />
                                    <span>
                                      Cargo automático: <strong>{sub.dueDate}</strong>
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs font-bold font-mono text-purple-700 dark:text-purple-400">
                                  {formatMoney(sub.amount, currencySymbol)}/mes
                                </span>
                                {onPayObligation && (
                                  <button
                                    type="button"
                                    onClick={() => onPayObligation(sub)}
                                    className="px-2 py-1 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold"
                                  >
                                    Cobrar hoy
                                  </button>
                                )}
                                {onDeleteObligation && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteObligation(sub.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600"
                                    title="Eliminar suscripción"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Accounts Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {activeAccounts.map((acc) => {
          const currentBalance = calculateAccountBalance(acc, transactions, transfers);
          const isConfirming = confirmDeleteAccId === acc.id;
          const isCC = acc.type === AccountType.CREDIT;
          const ccMetrics = isCC
            ? calculateCreditCardMetrics(acc, transactions, transfers, obligations)
            : null;

          return (
            <div
              key={acc.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                      isCC
                        ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {renderAccountIcon(acc.type)}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditAccountForm(acc)}
                      className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Editar cuenta"
                    >
                      <Edit2 size={15} />
                    </button>
                    {activeAccounts.length > 1 && (
                      <>
                        {isConfirming ? (
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteAccount(acc.id);
                              setConfirmDeleteAccId(null);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-semibold"
                          >
                            Confirmar archivar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteAccId(acc.id)}
                            className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            title="Archivar cuenta"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {ACCOUNT_TYPE_LABELS[acc.type]}
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {acc.name}
                </h3>
                {acc.additionalInfo && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {acc.additionalInfo}
                  </p>
                )}
              </div>

              {isCC && ccMetrics ? (
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Disponible para gastar
                    </span>
                    <span className="text-lg font-bold font-mono-num text-emerald-600 dark:text-emerald-400">
                      {formatMoney(ccMetrics.availableCredit, currencySymbol)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-xs font-mono text-slate-500">
                    <span>Utilizado / Cupo:</span>
                    <span>
                      {formatMoney(ccMetrics.totalUsedCredit, currencySymbol)} /{' '}
                      {formatMoney(ccMetrics.creditLimit, currencySymbol)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Saldo actual</span>
                  <span
                    className={`text-xl font-bold font-mono-num ${
                      currentBalance < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {formatMoney(currentBalance, currencySymbol)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Account Transfers History */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Historial de transferencias y pagos de tarjetas
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Las transferencias ajustan los saldos de origen y destino (o liberan cupo de tu tarjeta) sin duplicarse como gasto.
            </p>
          </div>
        </div>

        {transfers.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No hay transferencias registradas entre cuentas.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {transfers.map((tr) => {
              const fromAcc = accMap.get(tr.fromAccountId);
              const toAcc = accMap.get(tr.toAccountId);
              return (
                <div
                  key={tr.id}
                  className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-sky-600/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                      <ArrowRightLeft size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {fromAcc?.name || 'Cuenta'} → {toAcc?.name || 'Cuenta'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {tr.date} {tr.description ? `· ${tr.description}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold font-mono-num text-sky-600 dark:text-sky-400">
                      {formatMoney(tr.amount, currencySymbol)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onEditTransfer(tr)}
                      className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Editar transferencia"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTransfer(tr.id)}
                      className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      title="Eliminar transferencia"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
