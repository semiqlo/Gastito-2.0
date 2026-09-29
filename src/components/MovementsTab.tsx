import React, { useState, useMemo } from 'react';
import {
  Account,
  AccountTransfer,
  Category,
  Transaction,
  TransactionType,
} from '../domain/models';
import { formatMoney, triggerHaptic } from '../data/localRepository';
import { CategoryIcon } from './GastitoLogo';
import { QuickEntryMode } from './QuickEntryModal';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  ArrowRightLeft,
  RotateCcw,
} from 'lucide-react';

interface MovementsTabProps {
  categories: Category[];
  accounts: Account[];
  transactions: Transaction[];
  transfers: AccountTransfer[];
  currencySymbol: string;
  hapticEnabled: boolean;
  onOpenQuickEntry: (mode: QuickEntryMode) => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onEditTransfer: (tr: AccountTransfer) => void;
  onDeleteTransfer: (id: string) => void;
}

export const MovementsTab: React.FC<MovementsTabProps> = ({
  categories,
  accounts,
  transactions,
  transfers,
  currencySymbol,
  hapticEnabled,
  onOpenQuickEntry,
  onEditTransaction,
  onDeleteTransaction,
  onEditTransfer,
  onDeleteTransfer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'EXPENSE' | 'INCOME' | 'TRANSFER'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [accountFilter, setAccountFilter] = useState<string>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>('ALL');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<{
    id: string;
    kind: 'TX' | 'TR';
  } | null>(null);

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const accMap = new Map(accounts.map((a) => [a.id, a]));

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    transactions.forEach((t) => years.add(t.date.slice(0, 4)));
    transfers.forEach((tr) => years.add(tr.date.slice(0, 4)));
    years.add(new Date().getFullYear().toString());
    return Array.from(years).sort().reverse();
  }, [transactions, transfers]);

  const combinedItems = useMemo(() => {
    const items: Array<
      | { kind: 'TX'; date: string; data: Transaction }
      | { kind: 'TR'; date: string; data: AccountTransfer }
    > = [];

    if (typeFilter !== 'TRANSFER') {
      transactions.forEach((tx) => {
        if (typeFilter === 'EXPENSE' && tx.type !== TransactionType.EXPENSE) return;
        if (typeFilter === 'INCOME' && tx.type !== TransactionType.INCOME) return;
        if (categoryFilter !== 'ALL' && tx.categoryId !== categoryFilter) return;
        if (accountFilter !== 'ALL' && tx.accountId !== accountFilter) return;
        items.push({ kind: 'TX', date: tx.date, data: tx });
      });
    }

    if (typeFilter === 'ALL' || typeFilter === 'TRANSFER') {
      if (categoryFilter === 'ALL') {
        transfers.forEach((tr) => {
          if (
            accountFilter !== 'ALL' &&
            tr.fromAccountId !== accountFilter &&
            tr.toAccountId !== accountFilter
          ) {
            return;
          }
          items.push({ kind: 'TR', date: tr.date, data: tr });
        });
      }
    }

    return items
      .filter((item) => {
        if (yearFilter !== 'ALL' && !item.date.startsWith(yearFilter)) return false;
        if (monthFilter !== 'ALL' && item.date.slice(5, 7) !== monthFilter) return false;
        if (dateFrom && item.date < dateFrom) return false;
        if (dateTo && item.date > dateTo) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          if (item.kind === 'TX') {
            const catName = catMap.get(item.data.categoryId)?.name.toLowerCase() || '';
            const accName = accMap.get(item.data.accountId)?.name.toLowerCase() || '';
            const desc = item.data.description.toLowerCase();
            return catName.includes(q) || accName.includes(q) || desc.includes(q);
          } else {
            const fromName = accMap.get(item.data.fromAccountId)?.name.toLowerCase() || '';
            const toName = accMap.get(item.data.toAccountId)?.name.toLowerCase() || '';
            const desc = item.data.description.toLowerCase();
            return (
              fromName.includes(q) ||
              toName.includes(q) ||
              desc.includes(q) ||
              'transferencia'.includes(q)
            );
          }
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [
    transactions,
    transfers,
    typeFilter,
    categoryFilter,
    accountFilter,
    yearFilter,
    monthFilter,
    dateFrom,
    dateTo,
    searchQuery,
    catMap,
    accMap,
  ]);

  const filteredExpenseTotal = combinedItems.reduce((sum, item) => {
    if (item.kind === 'TX' && item.data.type === TransactionType.EXPENSE) {
      return sum + item.data.amount;
    }
    return sum;
  }, 0);

  const filteredIncomeTotal = combinedItems.reduce((sum, item) => {
    if (item.kind === 'TX' && item.data.type === TransactionType.INCOME) {
      return sum + item.data.amount;
    }
    return sum;
  }, 0);

  const resetFilters = () => {
    setSearchQuery('');
    setTypeFilter('ALL');
    setCategoryFilter('ALL');
    setAccountFilter('ALL');
    setMonthFilter('ALL');
    setYearFilter('ALL');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Panel */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white">
              Movimientos e Historial
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Búsqueda instantánea, filtros combinados y edición segura sin duplicar registros
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenQuickEntry('EXPENSE')}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap min-h-[40px]"
            >
              <Plus size={15} />
              <span>Nuevo Gasto</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenQuickEntry('INCOME')}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap min-h-[40px]"
            >
              <Plus size={15} />
              <span>Nuevo Ingreso</span>
            </button>
          </div>
        </div>

        {/* Search & Segmented Type Filter */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-6 relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por categoría, cuenta o descripción..."
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-sm text-slate-900 dark:text-white"
            />
          </div>
          <div className="lg:col-span-6 flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto">
            {(
              [
                { id: 'ALL', label: 'Todos' },
                { id: 'EXPENSE', label: 'Gastos' },
                { id: 'INCOME', label: 'Ingresos' },
                { id: 'TRANSFER', label: 'Transferencias' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id)}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  typeFilter === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Filters: Category, Account, Month, Year, Date Range */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Categoría</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full h-10 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
            >
              <option value="ALL">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.isDeleted ? '(Archivada)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Cuenta</label>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="w-full h-10 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
            >
              <option value="ALL">Todas las cuentas</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Mes</label>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full h-10 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
            >
              <option value="ALL">Cualquier mes</option>
              <option value="01">Enero</option>
              <option value="02">Febrero</option>
              <option value="03">Marzo</option>
              <option value="04">Abril</option>
              <option value="05">Mayo</option>
              <option value="06">Junio</option>
              <option value="07">Julio</option>
              <option value="08">Agosto</option>
              <option value="09">Septiembre</option>
              <option value="10">Octubre</option>
              <option value="11">Noviembre</option>
              <option value="12">Diciembre</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Año</label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full h-10 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
            >
              <option value="ALL">Todos los años</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Desde fecha</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full h-10 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Hasta fecha</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full h-10 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Summary Bar of Filtered Results */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-slate-600 dark:text-slate-400">
            <span>
              Mostrando <strong className="text-slate-900 dark:text-white font-mono-num">{combinedItems.length}</strong> registros
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Ingresos filtrados:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400 font-mono-num">
                +{formatMoney(filteredIncomeTotal, currencySymbol)}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Gastos filtrados:{' '}
              <strong className="text-rose-600 dark:text-rose-400 font-mono-num">
                -{formatMoney(filteredExpenseTotal, currencySymbol)}
              </strong>
            </span>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <RotateCcw size={13} />
            <span>Limpiar filtros</span>
          </button>
        </div>
      </section>

      {/* Movements Table / List */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {combinedItems.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              No se encontraron movimientos con los filtros actuales
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Prueba limpiando los filtros o registra un nuevo movimiento.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold"
            >
              Restablecer búsqueda
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {combinedItems.map((item) => {
              if (item.kind === 'TX') {
                const tx = item.data;
                const cat = catMap.get(tx.categoryId);
                const acc = accMap.get(tx.accountId);
                const isExpense = tx.type === TransactionType.EXPENSE;
                const isConfirming =
                  confirmDeleteId?.kind === 'TX' && confirmDeleteId.id === tx.id;

                return (
                  <div
                    key={`tx-${tx.id}`}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: cat?.color || '#64748B' }}
                      >
                        <CategoryIcon name={cat?.icon || 'CircleDollarSign'} size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {cat?.name || 'Categoría archivada'}
                            {cat?.isDeleted ? ' (Histórica)' : ''}
                          </span>
                          {tx.installmentInfo && tx.installmentInfo.total > 1 && (
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-950/70 text-violet-800 dark:text-violet-300">
                              Cuota {tx.installmentInfo.current}/{tx.installmentInfo.total}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span>{acc?.name || 'Cuenta'}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-num">{tx.date}</span>
                          {tx.description && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-slate-700 dark:text-slate-300">
                                {tx.description}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                      <div
                        className={`text-base font-bold font-mono-num whitespace-nowrap ${
                          isExpense
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isExpense ? '-' : '+'}
                        {formatMoney(tx.amount, currencySymbol)}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditTransaction(tx)}
                          className="min-h-[38px] min-w-[38px] rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Editar movimiento"
                        >
                          <Edit2 size={15} />
                        </button>
                        {isConfirming ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic(hapticEnabled, [20, 30]);
                                onDeleteTransaction(tx.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId({ id: tx.id, kind: 'TX' })}
                            className="min-h-[38px] min-w-[38px] rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            title="Eliminar movimiento"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              } else {
                const tr = item.data;
                const fromAcc = accMap.get(tr.fromAccountId);
                const toAcc = accMap.get(tr.toAccountId);
                const isConfirming =
                  confirmDeleteId?.kind === 'TR' && confirmDeleteId.id === tr.id;

                return (
                  <div
                    key={`tr-${tr.id}`}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-sky-600 flex items-center justify-center text-white shrink-0">
                        <ArrowRightLeft size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          Transferencia: {fromAcc?.name || 'Origen'} → {toAcc?.name || 'Destino'}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span>Movimiento entre cuentas (No es gasto)</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-num">{tr.date}</span>
                          {tr.description && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-slate-700 dark:text-slate-300">
                                {tr.description}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                      <div className="text-base font-bold font-mono-num text-sky-600 dark:text-sky-400 whitespace-nowrap">
                        {formatMoney(tr.amount, currencySymbol)}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditTransfer(tr)}
                          className="min-h-[38px] min-w-[38px] rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Editar transferencia"
                        >
                          <Edit2 size={15} />
                        </button>
                        {isConfirming ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic(hapticEnabled, [20, 30]);
                                onDeleteTransfer(tr.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId({ id: tr.id, kind: 'TR' })}
                            className="min-h-[38px] min-w-[38px] rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            title="Eliminar transferencia"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        )}
      </section>
    </div>
  );
};
