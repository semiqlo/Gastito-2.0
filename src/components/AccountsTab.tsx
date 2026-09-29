import React, { useState } from 'react';
import {
  Account,
  AccountTransfer,
  AccountType,
  Transaction,
} from '../domain/models';
import {
  calculateAccountBalance,
  formatMoney,
  triggerHaptic,
} from '../data/localRepository';
import {
  Landmark,
  Wallet,
  CreditCard,
  CircleDollarSign,
  Plus,
  ArrowRightLeft,
  Edit2,
  Trash2,
} from 'lucide-react';

interface AccountsTabProps {
  accounts: Account[];
  transactions: Transaction[];
  transfers: AccountTransfer[];
  currencySymbol: string;
  hapticEnabled: boolean;
  onSaveAccount: (
    acc: Omit<Account, 'id' | 'createdAt' | 'isArchived'>,
    existingId?: string
  ) => void;
  onDeleteAccount: (id: string) => void;
  onOpenTransferModal: () => void;
  onEditTransfer: (tr: AccountTransfer) => void;
  onDeleteTransfer: (id: string) => void;
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  [AccountType.BANK]: 'Cuenta bancaria',
  [AccountType.CASH]: 'Efectivo',
  [AccountType.CREDIT]: 'Tarjeta de crédito',
  [AccountType.OTHER]: 'Otra',
};

export const AccountsTab: React.FC<AccountsTabProps> = ({
  accounts,
  transactions,
  transfers,
  currencySymbol,
  hapticEnabled,
  onSaveAccount,
  onDeleteAccount,
  onOpenTransferModal,
  onEditTransfer,
  onDeleteTransfer,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingAcc, setEditingAcc] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>(AccountType.BANK);
  const [initialBalance, setInitialBalance] = useState('0');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [confirmDeleteAccId, setConfirmDeleteAccId] = useState<string | null>(null);

  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const accMap = new Map(accounts.map((a) => [a.id, a]));

  const totalNetWorth = activeAccounts.reduce(
    (sum, acc) => sum + calculateAccountBalance(acc, transactions, transfers),
    0
  );

  const openNewAccountForm = () => {
    setEditingAcc(null);
    setName('');
    setType(AccountType.BANK);
    setInitialBalance('0');
    setAdditionalInfo('');
    setShowForm(true);
  };

  const openEditAccountForm = (acc: Account) => {
    setEditingAcc(acc);
    setName(acc.name);
    setType(acc.type);
    setInitialBalance(String(acc.initialBalance));
    setAdditionalInfo(acc.additionalInfo);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    triggerHaptic(hapticEnabled, 18);
    onSaveAccount(
      {
        name: name.trim(),
        type,
        initialBalance: parseFloat(initialBalance) || 0,
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
            Cuentas y Transferencias
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Patrimonio total consolidado:{' '}
            <strong className="font-mono-num text-slate-900 dark:text-white">
              {formatMoney(totalNetWorth, currencySymbol)}
            </strong>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenTransferModal}
            className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap min-h-[42px]"
          >
            <ArrowRightLeft size={15} />
            <span>Transferir entre cuentas</span>
          </button>
          <button
            type="button"
            onClick={openNewAccountForm}
            className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap min-h-[42px]"
          >
            <Plus size={15} />
            <span>Nueva cuenta</span>
          </button>
        </div>
      </section>

      {/* Account Form Modal/Drawer */}
      {showForm && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-500/40 p-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
            {editingAcc ? 'Editar cuenta' : 'Crear nueva cuenta'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Nombre de la cuenta
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Cuenta Ahorro, Billetera..."
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

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Información adicional (CLABE, fecha de corte, notas)
              </label>
              <input
                type="text"
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                placeholder="Ej. Corte día 15, terminación 9012"
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

      {/* Accounts Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {activeAccounts.map((acc) => {
          const currentBalance = calculateAccountBalance(acc, transactions, transfers);
          const isConfirming = confirmDeleteAccId === acc.id;

          return (
            <div
              key={acc.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center">
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
            </div>
          );
        })}
      </div>

      {/* Account Transfers History */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Historial de transferencias entre cuentas
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Las transferencias ajustan los saldos de origen y destino pero nunca se contabilizan como gasto.
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
