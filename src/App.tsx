/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Account,
  AccountTransfer,
  AccountType,
  AppDatabaseState,
  Budget,
  Category,
  DebtRecord,
  ObligationStatus,
  RecurrenceFrequency,
  RecurringObligation,
  RenewalRule,
  ThemeMode,
  Transaction,
  TransactionType,
  UserPreferences,
} from './domain/models';
import {
  createBlankDatabase,
  createSeedDatabase,
  loadLocalDatabase,
  saveLocalDatabase,
  triggerHaptic,
} from './data/localRepository';
import { GastitoLogo } from './components/GastitoLogo';
import { HomeTab } from './components/HomeTab';
import { MovementsTab } from './components/MovementsTab';
import { AccountsTab } from './components/AccountsTab';
import { DebtsTab } from './components/DebtsTab';
import { SummaryTab } from './components/SummaryTab';
import { QuickEntryModal, QuickEntryMode } from './components/QuickEntryModal';
import { SettingsModal } from './components/SettingsModal';
import {
  BarChart3,
  Home,
  ListFilter,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';

type MainTab = 'INICIO' | 'MOVIMIENTOS' | 'CUENTAS' | 'DEUDAS' | 'RESUMEN';

function advanceDueDate(dateStr: string, freq: RecurrenceFrequency): string {
  const d = new Date(`${dateStr}T12:00:00`);
  if (freq === RecurrenceFrequency.WEEKLY) d.setDate(d.getDate() + 7);
  else if (freq === RecurrenceFrequency.BIWEEKLY) d.setDate(d.getDate() + 14);
  else if (freq === RecurrenceFrequency.MONTHLY) d.setMonth(d.getMonth() + 1);
  else if (freq === RecurrenceFrequency.YEARLY) d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
}

export default function App() {
  const [dbState, setDbState] = useState<AppDatabaseState>(() => loadLocalDatabase());
  const [activeTab, setActiveTab] = useState<MainTab>('INICIO');

  // Quick Entry Modal State
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [quickEntryMode, setQuickEntryMode] = useState<QuickEntryMode>('EXPENSE');
  const [preselectCatId, setPreselectCatId] = useState<string | undefined>(undefined);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editingTr, setEditingTr] = useState<AccountTransfer | null>(null);

  // Settings Modal
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Persist locally on every state update
  useEffect(() => {
    saveLocalDatabase(dbState);
  }, [dbState]);

  // Apply Light / Dark / System Theme
  useEffect(() => {
    const root = document.documentElement;
    const mode = dbState.preferences.themeMode;

    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    if (mode === ThemeMode.DARK) {
      applyTheme(true);
    } else if (mode === ThemeMode.LIGHT) {
      applyTheme(false);
    } else {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(media.matches);
      const listener = (e: MediaQueryListEvent) => applyTheme(e.matches);
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [dbState.preferences.themeMode]);

  const handleOpenQuickEntry = (mode: QuickEntryMode, categoryId?: string) => {
    setEditingTx(null);
    setEditingTr(null);
    setQuickEntryMode(mode);
    setPreselectCatId(categoryId);
    setQuickEntryOpen(true);
  };

  // 1. Movimientos (sin duplicar registros al editar)
  const handleSaveTransaction = (
    txData: Omit<Transaction, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    setDbState((prev) => {
      if (existingId) {
        return {
          ...prev,
          transactions: prev.transactions.map((t) =>
            t.id === existingId ? { ...t, ...txData, id: existingId } : t
          ),
        };
      }
      const newTx: Transaction = {
        ...txData,
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
      };
      const needsAutoAccount =
        prev.accounts.length === 0 ||
        !prev.accounts.some((a) => a.id === newTx.accountId);
      const updatedAccounts = needsAutoAccount
        ? [
            ...prev.accounts,
            {
              id: newTx.accountId || 'acc-efectivo-default',
              name: 'Efectivo',
              type: AccountType.CASH,
              initialBalance: 0,
              additionalInfo: 'Cuenta creada automáticamente',
              isArchived: false,
              createdAt: new Date().toISOString().split('T')[0],
            },
          ]
        : prev.accounts;
      return {
        ...prev,
        accounts: updatedAccounts,
        transactions: [newTx, ...prev.transactions],
      };
    });
    setEditingTx(null);
  };

  const handleDeleteTransaction = (id: string) => {
    setDbState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));
  };

  // 2. Transferencias entre cuentas (nunca son gastos)
  const handleSaveTransfer = (
    trData: Omit<AccountTransfer, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    setDbState((prev) => {
      if (existingId) {
        return {
          ...prev,
          transfers: prev.transfers.map((tr) =>
            tr.id === existingId ? { ...tr, ...trData, id: existingId } : tr
          ),
        };
      }
      const newTr: AccountTransfer = {
        ...trData,
        id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
      };
      return {
        ...prev,
        transfers: [newTr, ...prev.transfers],
      };
    });
    setEditingTr(null);
  };

  const handleDeleteTransfer = (id: string) => {
    setDbState((prev) => ({
      ...prev,
      transfers: prev.transfers.filter((tr) => tr.id !== id),
    }));
  };

  // 3. Cuentas
  const handleSaveAccount = (
    accData: Omit<Account, 'id' | 'createdAt' | 'isArchived'>,
    existingId?: string
  ) => {
    setDbState((prev) => {
      if (existingId) {
        return {
          ...prev,
          accounts: prev.accounts.map((a) =>
            a.id === existingId ? { ...a, ...accData, id: existingId } : a
          ),
        };
      }
      const newAcc: Account = {
        ...accData,
        id: `acc-${Date.now()}`,
        isArchived: false,
        createdAt: new Date().toISOString().split('T')[0],
      };
      return {
        ...prev,
        accounts: [...prev.accounts, newAcc],
      };
    });
  };

  const handleDeleteAccount = (id: string) => {
    setDbState((prev) => ({
      ...prev,
      accounts: prev.accounts.filter((a) => a.id !== id),
    }));
  };

  // 4. Deudas y División de Gastos
  const handleAddDebt = (
    debtData: Omit<DebtRecord, 'id' | 'createdAt' | 'isPaid'>,
    existingId?: string
  ) => {
    if (existingId) {
      setDbState((prev) => ({
        ...prev,
        debts: prev.debts.map((d) =>
          d.id === existingId ? { ...d, ...debtData, id: existingId } : d
        ),
      }));
      return;
    }
    const newDebt: DebtRecord = {
      ...debtData,
      id: `debt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      isPaid: false,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setDbState((prev) => ({
      ...prev,
      debts: [newDebt, ...prev.debts],
    }));
  };

  const handleToggleDebtPaid = (id: string) => {
    setDbState((prev) => ({
      ...prev,
      debts: prev.debts.map((d) =>
        d.id === id
          ? {
              ...d,
              isPaid: !d.isPaid,
              paidAt: !d.isPaid ? new Date().toISOString().split('T')[0] : undefined,
            }
          : d
      ),
    }));
  };

  const handleDeleteDebt = (id: string) => {
    setDbState((prev) => ({
      ...prev,
      debts: prev.debts.filter((d) => d.id !== id),
    }));
  };

  const handleConvertSplitToDebts = (
    newDebts: Array<Omit<DebtRecord, 'id' | 'createdAt' | 'isPaid'>>
  ) => {
    const today = new Date().toISOString().split('T')[0];
    const records: DebtRecord[] = newDebts.map((d, idx) => ({
      ...d,
      id: `debt-split-${Date.now()}-${idx}`,
      isPaid: false,
      createdAt: today,
    }));
    setDbState((prev) => ({
      ...prev,
      debts: [...records, ...prev.debts],
    }));
  };

  // 5. Presupuestos
  const handleSaveBudget = (
    budgetData: Omit<Budget, 'id' | 'history'>,
    existingId?: string
  ) => {
    setDbState((prev) => {
      if (existingId) {
        return {
          ...prev,
          budgets: prev.budgets.map((b) =>
            b.id === existingId ? { ...b, ...budgetData } : b
          ),
        };
      }
      const newBgt: Budget = {
        ...budgetData,
        id: `bgt-${Date.now()}`,
        history: [],
      };
      return {
        ...prev,
        budgets: [...prev.budgets, newBgt],
      };
    });
  };

  const handleCloseBudgetPeriod = (budgetId: string, spentAmount: number) => {
    const today = new Date().toISOString().split('T')[0];
    setDbState((prev) => ({
      ...prev,
      budgets: prev.budgets.map((b) => {
        if (b.id !== budgetId) return b;
        return {
          ...b,
          startDate: today,
          history: [
            {
              periodLabel: `Ciclo desde ${b.startDate}`,
              limitAmount: b.limitAmount,
              spentAmount,
              closedAt: today,
            },
            ...b.history,
          ],
        };
      }),
    }));
  };

  const handleDeleteBudget = (budgetId: string) => {
    setDbState((prev) => ({
      ...prev,
      budgets: prev.budgets.filter((b) => b.id !== budgetId),
    }));
  };

  // 6. Pagos Fijos / Obligaciones Recurrentes
  const handleSaveObligation = (
    oblData: Omit<RecurringObligation, 'id'>,
    existingId?: string
  ) => {
    setDbState((prev) => {
      if (existingId) {
        return {
          ...prev,
          obligations: prev.obligations.map((o) =>
            o.id === existingId ? { ...o, ...oblData } : o
          ),
        };
      }
      const newObl: RecurringObligation = {
        ...oblData,
        id: `obl-${Date.now()}`,
      };
      return {
        ...prev,
        obligations: [...prev.obligations, newObl],
      };
    });
  };

  const handlePayObligationById = (obligationId: string) => {
    const target = dbState.obligations.find((o) => o.id === obligationId);
    if (!target) return;
    handlePayObligation(target);
  };

  const handlePayObligation = (obligation: RecurringObligation) => {
    const today = new Date().toISOString().split('T')[0];
    const txId = `tx-obl-${Date.now()}`;
    const newTx: Transaction = {
      id: txId,
      type: TransactionType.EXPENSE,
      categoryId: obligation.categoryId,
      amount: obligation.amount,
      accountId: obligation.accountId,
      date: today,
      description: `Pago de obligación fija: ${obligation.name}`,
      linkedObligationId: obligation.id,
      createdAt: new Date().toISOString(),
    };

    setDbState((prev) => {
      const updatedObligations = prev.obligations.map((o) => {
        if (o.id !== obligation.id) return o;
        if (
          o.renewalRule === RenewalRule.AUTO_CREATE ||
          o.renewalRule === RenewalRule.ONLY_IF_PREVIOUS_PAID
        ) {
          return {
            ...o,
            dueDate: advanceDueDate(o.dueDate, o.frequency),
            status: ObligationStatus.PENDING,
            lastPaidTransactionId: txId,
            lastPaidDate: today,
          };
        }
        return {
          ...o,
          status: ObligationStatus.PAID,
          lastPaidTransactionId: txId,
          lastPaidDate: today,
        };
      });

      return {
        ...prev,
        transactions: [newTx, ...prev.transactions],
        obligations: updatedObligations,
      };
    });
  };

  const handleDeleteObligation = (obligationId: string) => {
    setDbState((prev) => ({
      ...prev,
      obligations: prev.obligations.filter((o) => o.id !== obligationId),
    }));
  };

  // 7. Configuración y Categorías (Soft-Delete sin borrar historial)
  const handleUpdatePreferences = (prefs: Partial<UserPreferences>) => {
    setDbState((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, ...prefs },
    }));
  };

  const handleSaveCategory = (
    catData: Omit<Category, 'id' | 'isDeleted'>,
    existingId?: string
  ) => {
    setDbState((prev) => {
      if (existingId) {
        return {
          ...prev,
          categories: prev.categories.map((c) =>
            c.id === existingId ? { ...c, ...catData } : c
          ),
        };
      }
      const newCat: Category = {
        ...catData,
        id: `cat-${Date.now()}`,
        isDeleted: false,
      };
      return {
        ...prev,
        categories: [...prev.categories, newCat],
      };
    });
  };

  const handleToggleCategoryActive = (categoryId: string) => {
    setDbState((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === categoryId ? { ...c, isActive: !c.isActive } : c
      ),
    }));
  };

  const handleSoftDeleteCategory = (categoryId: string) => {
    setDbState((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === categoryId ? { ...c, isDeleted: true, isActive: false } : c
      ),
    }));
  };

  const navItems: { id: MainTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'INICIO', label: 'Inicio', icon: Home },
    { id: 'MOVIMIENTOS', label: 'Movimientos', icon: ListFilter },
    { id: 'CUENTAS', label: 'Cuentas', icon: Wallet },
    { id: 'DEUDAS', label: 'Deudas', icon: Users },
    { id: 'RESUMEN', label: 'Resumen', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-[#FAF8F5] dark:bg-[#0C0D0E] text-stone-900 dark:text-zinc-100 flex flex-col selection:bg-emerald-600 selection:text-white">
      {/* Top App Bar Nativa */}
      <header className="sticky top-0 z-30 bg-[#FAF8F5]/90 dark:bg-[#0C0D0E]/90 backdrop-blur-md border-b border-stone-200/80 dark:border-zinc-800/80">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GastitoLogo size={38} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight font-display text-stone-900 dark:text-white">
                  {dbState.preferences.assistantName || 'Gastito'}
                </h1>
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                  2.0 Local
                </span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                Finanzas personales 100 % en tu dispositivo
              </p>
            </div>
          </div>

          {/* Acción Derecha: Icono Configuración ⚙️ únicamente */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(dbState.preferences.hapticFeedbackEnabled, 15);
                setSettingsOpen(true);
              }}
              aria-label="Configuración"
              className="w-10 h-10 rounded-xl bg-stone-200/70 dark:bg-zinc-800 hover:bg-stone-300/70 dark:hover:bg-zinc-700 flex items-center justify-center text-stone-700 dark:text-zinc-200 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Principal de la Pestaña Activa */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pt-5 pb-28">
        {activeTab === 'INICIO' && (
          <HomeTab
            preferences={dbState.preferences}
            categories={dbState.categories}
            accounts={dbState.accounts}
            transactions={dbState.transactions}
            transfers={dbState.transfers}
            budgets={dbState.budgets}
            obligations={dbState.obligations}
            onOpenQuickEntry={handleOpenQuickEntry}
            onEditTransaction={(tx) => {
              setEditingTr(null);
              setEditingTx(tx);
              setQuickEntryOpen(true);
            }}
            onPayObligation={handlePayObligationById}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'MOVIMIENTOS' && (
          <MovementsTab
            categories={dbState.categories}
            accounts={dbState.accounts}
            transactions={dbState.transactions}
            transfers={dbState.transfers}
            currencySymbol={dbState.preferences.currencySymbol}
            hapticEnabled={dbState.preferences.hapticFeedbackEnabled}
            onOpenQuickEntry={(mode) => handleOpenQuickEntry(mode)}
            onEditTransaction={(tx) => {
              setEditingTr(null);
              setEditingTx(tx);
              setQuickEntryOpen(true);
            }}
            onDeleteTransaction={handleDeleteTransaction}
            onEditTransfer={(tr) => {
              setEditingTx(null);
              setEditingTr(tr);
              setQuickEntryOpen(true);
            }}
            onDeleteTransfer={handleDeleteTransfer}
          />
        )}

        {activeTab === 'CUENTAS' && (
          <AccountsTab
            accounts={dbState.accounts}
            transactions={dbState.transactions}
            transfers={dbState.transfers}
            currencySymbol={dbState.preferences.currencySymbol}
            hapticEnabled={dbState.preferences.hapticFeedbackEnabled}
            onSaveAccount={handleSaveAccount}
            onDeleteAccount={handleDeleteAccount}
            onOpenTransferModal={() => handleOpenQuickEntry('TRANSFER')}
            onEditTransfer={(tr) => {
              setEditingTx(null);
              setEditingTr(tr);
              setQuickEntryOpen(true);
            }}
            onDeleteTransfer={handleDeleteTransfer}
          />
        )}

        {activeTab === 'DEUDAS' && (
          <DebtsTab
            debts={dbState.debts}
            userName={dbState.preferences.userName}
            currencySymbol={dbState.preferences.currencySymbol}
            hapticEnabled={dbState.preferences.hapticFeedbackEnabled}
            onAddDebt={handleAddDebt}
            onToggleDebtPaid={handleToggleDebtPaid}
            onDeleteDebt={handleDeleteDebt}
            onConvertSplitToDebts={handleConvertSplitToDebts}
          />
        )}

        {activeTab === 'RESUMEN' && (
          <SummaryTab
            dbState={dbState}
            onSaveBudget={handleSaveBudget}
            onCloseBudgetPeriod={handleCloseBudgetPeriod}
            onDeleteBudget={handleDeleteBudget}
            onSaveObligation={handleSaveObligation}
            onPayObligation={handlePayObligation}
            onDeleteObligation={handleDeleteObligation}
          />
        )}
      </main>

      {/* Bottom Navigation con exactamente 5 pestañas */}
      <nav
        aria-label="Navegación principal"
        className="fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-stone-200/80 dark:border-zinc-800"
      >
        <div className="max-w-3xl mx-auto px-2 h-16 grid grid-cols-5 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  triggerHaptic(dbState.preferences.hapticFeedbackEnabled, 10);
                  setActiveTab(item.id);
                }}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl transition-all ${
                  isSelected
                    ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                    : 'text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-zinc-200 font-medium'
                }`}
              >
                <div
                  className={`px-4 py-1 rounded-full transition-colors ${
                    isSelected ? 'bg-emerald-100/80 dark:bg-emerald-950/80' : ''
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modal de Registro Ultrarrápido (Gasto / Ingreso / Transferencia) */}
      <QuickEntryModal
        isOpen={quickEntryOpen}
        initialMode={quickEntryMode}
        preselectCategoryId={preselectCatId}
        categories={dbState.categories}
        accounts={dbState.accounts}
        currencySymbol={dbState.preferences.currencySymbol}
        hapticEnabled={dbState.preferences.hapticFeedbackEnabled}
        editingTransaction={editingTx}
        editingTransfer={editingTr}
        onClose={() => {
          setQuickEntryOpen(false);
          setEditingTx(null);
          setEditingTr(null);
          setPreselectCatId(undefined);
        }}
        onSaveTransaction={handleSaveTransaction}
        onSaveTransfer={handleSaveTransfer}
      />

      {/* Modal de Configuración (⚙️ Arriba a la derecha) */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        dbState={dbState}
        onUpdatePreferences={handleUpdatePreferences}
        onSaveCategory={handleSaveCategory}
        onToggleCategoryActive={handleToggleCategoryActive}
        onSoftDeleteCategory={handleSoftDeleteCategory}
        onRestoreBackup={(newState) => setDbState(newState)}
        onResetDatabase={() => setDbState(createSeedDatabase())}
        onClearAllData={() => setDbState(createBlankDatabase(dbState.preferences))}
      />
    </div>
  );
}
