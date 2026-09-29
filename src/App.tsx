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
  formatMoney,
  getTodayLocalDate,
  loadLocalDatabase,
  saveLocalDatabase,
  triggerHaptic,
} from './data/localRepository';
import {
  evaluateAndTriggerDatabaseNotifications,
  getNativeNotificationPermission,
  InAppNotificationPayload,
  NativePermissionState,
  requestNativeNotificationPermission,
  sendNativeNotification,
} from './utils/nativeNotificationManager';
import { GastitoLogo } from './components/GastitoLogo';
import { HomeTab } from './components/HomeTab';
import { MovementsTab } from './components/MovementsTab';
import { AccountsTab } from './components/AccountsTab';
import { DebtsTab } from './components/DebtsTab';
import { SummaryTab } from './components/SummaryTab';
import {
  QuickEntryModal,
  QuickEntryMode,
  CardChargeType,
} from './components/QuickEntryModal';
import {
  PayObligationModal,
  PayObligationPayload,
} from './components/PayObligationModal';
import { SettingsModal } from './components/SettingsModal';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  Home,
  ListFilter,
  Settings,
  Users,
  Wallet,
  X,
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
  const [preselectAccId, setPreselectAccId] = useState<string | undefined>(undefined);
  const [initialCardChargeType, setInitialCardChargeType] =
    useState<CardChargeType>('SINGLE');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editingTr, setEditingTr] = useState<AccountTransfer | null>(null);

  // Settings Modal
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Modal para confirmar el monto efectivamente pagado en una cuenta / recordatorio (Luz, Agua, Gastos Comunes, Arriendo, etc.)
  const [payingObligation, setPayingObligation] =
    useState<RecurringObligation | null>(null);

  // Native Notifications State
  const [nativePerm, setNativePerm] = useState<NativePermissionState>(() =>
    getNativeNotificationPermission()
  );
  const [dismissedPermBanner, setDismissedPermBanner] = useState(false);
  const [activeToasts, setActiveToasts] = useState<InAppNotificationPayload[]>([]);

  // Listen for native notification events to show floating banner
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<InAppNotificationPayload>;
      if (!custom.detail) return;
      const item = custom.detail;
      setActiveToasts((prev) => [item, ...prev.slice(0, 2)]);
      setTimeout(() => {
        setActiveToasts((prev) => prev.filter((t) => t.id !== item.id));
      }, 6500);
    };
    window.addEventListener('gastito-native-notification', handler);
    return () => window.removeEventListener('gastito-native-notification', handler);
  }, []);

  // Persist locally on every state update & evaluate notification rules
  useEffect(() => {
    saveLocalDatabase(dbState);
    evaluateAndTriggerDatabaseNotifications(dbState);
  }, [dbState]);

  // Generación automática de cuotas fijas mensuales (con fecha de término) y suscripciones automáticas en Tarjeta de Crédito al llegar su fecha de cobro
  useEffect(() => {
    const todayStr = getTodayLocalDate();
    const dueAutoObligations = dbState.obligations.filter((o) => {
      if (o.status === ObligationStatus.PAID) return false;
      if (!o.autoChargeCard && !o.isSubscription) return false;
      if (o.amount <= 0) return false;
      if (o.dueDate > todayStr) return false;
      if (o.lastPaidDate === o.dueDate) return false;
      // Protección contra duplicados si ya existe una transacción para esta obligación en esta misma fecha
      const alreadyExists = dbState.transactions.some(
        (t) => t.linkedObligationId === o.id && t.date === o.dueDate
      );
      if (alreadyExists) return false;
      if (
        o.isInstallmentPlan &&
        o.totalInstallments &&
        (o.paidInstallments || 0) >= o.totalInstallments
      ) {
        return false;
      }
      return true;
    });

    if (dueAutoObligations.length === 0) return;

    setDbState((prev) => {
      const newTransactions: Transaction[] = [];
      const updatedObligations = prev.obligations.map((o) => {
        const isDue = dueAutoObligations.some((d) => d.id === o.id);
        if (!isDue) return o;

        const isInst = Boolean(o.isInstallmentPlan && o.totalInstallments);
        const nextPaidCount = isInst ? (o.paidInstallments || 0) + 1 : undefined;
        const totalInst = o.totalInstallments || 1;
        const completedAllInstallments = isInst && (nextPaidCount || 0) >= totalInst;

        const txId = `tx-auto-${o.id}-${o.dueDate}-${Date.now()}`;
        const desc = isInst
          ? `${o.name} (Cuota automática ${nextPaidCount}/${totalInst})`
          : `Cargo automático suscripción: ${o.name}`;

        const autoTx: Transaction = {
          id: txId,
          type: TransactionType.EXPENSE,
          categoryId: o.categoryId,
          amount: Math.round(o.amount),
          accountId: o.accountId,
          date: o.dueDate,
          description: desc,
          linkedObligationId: o.id,
          installmentInfo:
            isInst && nextPaidCount
              ? {
                  current: nextPaidCount,
                  total: totalInst,
                  totalPurchaseAmount:
                    o.installmentTotalAmount || Math.round(o.amount) * totalInst,
                }
              : undefined,
          createdAt: new Date().toISOString(),
        };
        newTransactions.push(autoTx);

        const paymentRec = {
          id: `pay-auto-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          date: o.dueDate,
          amountPaid: Math.round(o.amount),
          estimatedAmount: Math.round(o.amount),
          accountId: o.accountId,
          transactionId: txId,
          notes: isInst
            ? `Cuota ${nextPaidCount}/${totalInst}`
            : 'Cargo automático a tarjeta',
        };

        const nextDue = advanceDueDate(o.dueDate, o.frequency);
        const pastEndDate = Boolean(o.endDate && nextDue > o.endDate);
        const shouldFinish = completedAllInstallments || pastEndDate;

        return {
          ...o,
          dueDate: shouldFinish ? o.dueDate : nextDue,
          status: shouldFinish ? ObligationStatus.PAID : ObligationStatus.PENDING,
          paidInstallments: nextPaidCount ?? o.paidInstallments,
          lastPaidTransactionId: txId,
          lastPaidDate: o.dueDate,
          lastPaidAmount: Math.round(o.amount),
          paymentHistory: [paymentRec, ...(o.paymentHistory || [])],
        };
      });

      if (newTransactions.length === 0) return prev;
      return {
        ...prev,
        transactions: [...newTransactions, ...prev.transactions],
        obligations: updatedObligations,
      };
    });
  }, [dbState.obligations]);

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
    setPreselectAccId(undefined);
    setInitialCardChargeType('SINGLE');
    setQuickEntryOpen(true);
  };

  const handleOpenCardAction = (accountId: string, chargeType: CardChargeType) => {
    setEditingTx(null);
    setEditingTr(null);
    setQuickEntryMode('EXPENSE');
    setPreselectAccId(accountId);
    setInitialCardChargeType(chargeType);
    if (chargeType === 'SUBSCRIPTION') {
      const subCat = dbState.categories.find((c) => c.id === 'cat-suscripciones' && !c.isDeleted);
      setPreselectCatId(subCat?.id);
    } else if (chargeType === 'INSTALLMENTS') {
      const instCat = dbState.categories.find((c) => c.id === 'cat-cuotas-tc' && !c.isDeleted);
      setPreselectCatId(instCat?.id);
    } else {
      setPreselectCatId(undefined);
    }
    setQuickEntryOpen(true);
  };

  const handleCreateRecurringFromCard = (
    oblData: Omit<RecurringObligation, 'id'>
  ): string => {
    const newId = `obl-card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newObl: RecurringObligation = {
      ...oblData,
      id: newId,
    };
    setDbState((prev) => ({
      ...prev,
      obligations: [newObl, ...prev.obligations],
    }));
    return newId;
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
    setPayingObligation(target);
  };

  const handlePayObligation = (obligation: RecurringObligation) => {
    setPayingObligation(obligation);
  };

  const handleConfirmObligationPayment = (payload: PayObligationPayload) => {
    const {
      obligation,
      actualAmountPaid,
      accountId,
      paymentDate,
      notes,
      updateReferenceAmount,
    } = payload;

    const txId = `tx-obl-${Date.now()}`;
    const isInst = Boolean(obligation.isInstallmentPlan && obligation.totalInstallments);
    const nextInstallmentNum = isInst
      ? Math.min(obligation.totalInstallments || 1, (obligation.paidInstallments || 0) + 1)
      : undefined;

    const descBase = isInst
      ? `${obligation.name} (Cuota ${nextInstallmentNum}/${obligation.totalInstallments})`
      : obligation.isSubscription
      ? `Suscripción TC: ${obligation.name}`
      : obligation.isVariableAmount
      ? `Pago cuenta variable: ${obligation.name}`
      : `Pago recordatorio fijo: ${obligation.name}`;

    const newTx: Transaction = {
      id: txId,
      type: TransactionType.EXPENSE,
      categoryId: obligation.categoryId,
      amount: Math.round(actualAmountPaid),
      accountId: accountId || obligation.accountId,
      date: paymentDate,
      description: notes ? `${descBase} (${notes})` : descBase,
      linkedObligationId: obligation.id,
      installmentInfo:
        isInst && nextInstallmentNum
          ? {
              current: nextInstallmentNum,
              total: obligation.totalInstallments || 1,
              totalPurchaseAmount:
                obligation.installmentTotalAmount ||
                Math.round(actualAmountPaid) * (obligation.totalInstallments || 1),
            }
          : undefined,
      createdAt: new Date().toISOString(),
    };

    const paymentRecord = {
      id: `pay-${Date.now()}`,
      date: paymentDate,
      amountPaid: Math.round(actualAmountPaid),
      estimatedAmount: obligation.amount,
      accountId: accountId || obligation.accountId,
      transactionId: txId,
      notes: notes || undefined,
    };

    setDbState((prev) => {
      const updatedObligations = prev.obligations.map((o) => {
        if (o.id !== obligation.id) return o;
        const nextHistory = [paymentRecord, ...(o.paymentHistory || [])];
        const nextRefAmount = updateReferenceAmount
          ? Math.round(actualAmountPaid)
          : o.amount;

        const nextPaidInst =
          o.isInstallmentPlan && o.totalInstallments
            ? (o.paidInstallments || 0) + 1
            : o.paidInstallments;
        const finishedInstallments = Boolean(
          o.isInstallmentPlan &&
            o.totalInstallments &&
            (nextPaidInst || 0) >= o.totalInstallments
        );

        if (finishedInstallments) {
          return {
            ...o,
            amount: nextRefAmount,
            status: ObligationStatus.PAID,
            paidInstallments: nextPaidInst,
            lastPaidTransactionId: txId,
            lastPaidDate: paymentDate,
            lastPaidAmount: Math.round(actualAmountPaid),
            paymentHistory: nextHistory,
          };
        }

        if (
          o.renewalRule === RenewalRule.AUTO_CREATE ||
          o.renewalRule === RenewalRule.ONLY_IF_PREVIOUS_PAID
        ) {
          const nextDue = advanceDueDate(o.dueDate, o.frequency);
          const pastEndDate = Boolean(o.endDate && nextDue > o.endDate);
          return {
            ...o,
            amount: nextRefAmount,
            dueDate: pastEndDate ? o.dueDate : nextDue,
            status: pastEndDate ? ObligationStatus.PAID : ObligationStatus.PENDING,
            paidInstallments: nextPaidInst,
            lastPaidTransactionId: txId,
            lastPaidDate: paymentDate,
            lastPaidAmount: Math.round(actualAmountPaid),
            paymentHistory: nextHistory,
          };
        }
        return {
          ...o,
          amount: nextRefAmount,
          status: ObligationStatus.PAID,
          paidInstallments: nextPaidInst,
          lastPaidTransactionId: txId,
          lastPaidDate: paymentDate,
          lastPaidAmount: Math.round(actualAmountPaid),
          paymentHistory: nextHistory,
        };
      });

      return {
        ...prev,
        transactions: [newTx, ...prev.transactions],
        obligations: updatedObligations,
      };
    });

    if (dbState.preferences.notificationsEnabled) {
      sendNativeNotification({
        title: `${dbState.preferences.assistantName || 'Gastito'}: Cuenta Pagada`,
        body: `Se registró el pago de "${obligation.name}" por ${formatMoney(
          actualAmountPaid,
          dbState.preferences.currencySymbol
        )} y se actualizó la estadística.`,
        tag: `paid-obl-${obligation.id}-${Date.now()}`,
        severity: 'success',
        hapticEnabled: dbState.preferences.hapticFeedbackEnabled,
        forceRepeat: true,
      });
    }
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

      {/* Floating Native Notification Banners */}
      {activeToasts.length > 0 && (
        <div className="fixed top-20 right-4 left-4 sm:left-auto sm:w-96 z-50 space-y-2 pointer-events-none">
          {activeToasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto p-3.5 rounded-2xl border shadow-xl backdrop-blur-md flex items-start justify-between gap-3 transition-all ${
                toast.severity === 'danger'
                  ? 'bg-rose-950/95 border-rose-700 text-white'
                  : toast.severity === 'warning'
                  ? 'bg-amber-950/95 border-amber-700 text-white'
                  : toast.severity === 'success'
                  ? 'bg-emerald-950/95 border-emerald-700 text-white'
                  : 'bg-stone-900/95 border-stone-700 text-white'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                {toast.severity === 'danger' || toast.severity === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold leading-snug">{toast.title}</p>
                  <p className="text-[11px] text-stone-200 mt-0.5 leading-relaxed">
                    {toast.body}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setActiveToasts((prev) => prev.filter((t) => t.id !== toast.id))
                }
                className="p-1 rounded-lg text-stone-300 hover:text-white shrink-0"
                aria-label="Cerrar notificación"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Contenido Principal de la Pestaña Activa */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pt-5 pb-28">
        {/* Banner de Solicitud de Permiso de Notificaciones Nativas */}
        {dbState.preferences.notificationsEnabled &&
          nativePerm === 'default' &&
          !dismissedPermBanner && (
            <div className="mb-5 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/70 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-stone-900 dark:text-zinc-100">
                    Activar Permiso de Notificaciones Nativas
                  </p>
                  <p className="text-[11px] text-stone-600 dark:text-zinc-400">
                    Autoriza las notificaciones en tu dispositivo para recibir alertas de presupuestos y vencimientos de pagos fijos.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    triggerHaptic(dbState.preferences.hapticFeedbackEnabled, 15);
                    const perm = await requestNativeNotificationPermission();
                    setNativePerm(perm);
                    if (perm === 'granted') {
                      sendNativeNotification({
                        title: `${
                          dbState.preferences.assistantName || 'Gastito'
                        }: Notificaciones Activadas`,
                        body: 'Las alertas nativas de presupuestos y pagos fijos están listas.',
                        tag: `perm-banner-${Date.now()}`,
                        severity: 'success',
                        hapticEnabled: dbState.preferences.hapticFeedbackEnabled,
                        forceRepeat: true,
                      });
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors"
                >
                  Permitir Notificaciones
                </button>
                <button
                  type="button"
                  onClick={() => setDismissedPermBanner(true)}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200"
                  aria-label="Ocultar aviso"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
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
            onOpenCardAction={handleOpenCardAction}
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
            categories={dbState.categories}
            transactions={dbState.transactions}
            transfers={dbState.transfers}
            obligations={dbState.obligations}
            currencySymbol={dbState.preferences.currencySymbol}
            hapticEnabled={dbState.preferences.hapticFeedbackEnabled}
            onSaveAccount={handleSaveAccount}
            onDeleteAccount={handleDeleteAccount}
            onOpenTransferModal={() => handleOpenQuickEntry('TRANSFER')}
            onOpenCardActionModal={handleOpenCardAction}
            onPayObligation={handlePayObligation}
            onDeleteObligation={handleDeleteObligation}
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

      {/* Modal de Registro Ultrarrápido (Gasto / Ingreso / Transferencia / Cuotas TC / Suscripciones TC) */}
      <QuickEntryModal
        isOpen={quickEntryOpen}
        initialMode={quickEntryMode}
        preselectCategoryId={preselectCatId}
        preselectAccountId={preselectAccId}
        initialCardChargeType={initialCardChargeType}
        categories={dbState.categories}
        accounts={dbState.accounts}
        transactions={dbState.transactions}
        transfers={dbState.transfers}
        obligations={dbState.obligations}
        currencySymbol={dbState.preferences.currencySymbol}
        hapticEnabled={dbState.preferences.hapticFeedbackEnabled}
        editingTransaction={editingTx}
        editingTransfer={editingTr}
        onClose={() => {
          setQuickEntryOpen(false);
          setEditingTx(null);
          setEditingTr(null);
          setPreselectCatId(undefined);
          setPreselectAccId(undefined);
          setInitialCardChargeType('SINGLE');
        }}
        onSaveTransaction={handleSaveTransaction}
        onSaveTransfer={handleSaveTransfer}
        onCreateRecurringFromCard={handleCreateRecurringFromCard}
      />

      {/* Modal para ingresar el monto exacto pagado en cuentas variables (Luz, Agua, GGCC) o pagos fijos */}
      <PayObligationModal
        isOpen={Boolean(payingObligation)}
        obligation={payingObligation}
        categories={dbState.categories}
        accounts={dbState.accounts}
        transactions={dbState.transactions}
        currencySymbol={dbState.preferences.currencySymbol}
        hapticEnabled={dbState.preferences.hapticFeedbackEnabled}
        onClose={() => setPayingObligation(null)}
        onConfirmPayment={handleConfirmObligationPayment}
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
