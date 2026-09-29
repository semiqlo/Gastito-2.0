import {
  Account,
  AccountTransfer,
  AccountType,
  AppDatabaseState,
  Budget,
  BudgetPeriod,
  Category,
  DebtRecord,
  DebtType,
  ObligationStatus,
  RecurrenceFrequency,
  RecurringObligation,
  RenewalRule,
  SimplifiedDebtSettlement,
  SplitParticipant,
  ThemeMode,
  Transaction,
  TransactionType,
  UserPreferences,
} from '../domain/models';

const STORAGE_KEY = 'gastito_2_0_local_db_v1';

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-comida', name: 'Comida', icon: 'Utensils', type: TransactionType.EXPENSE, color: '#D97706', isActive: true, isDeleted: false },
  { id: 'cat-super', name: 'Supermercado', icon: 'ShoppingCart', type: TransactionType.EXPENSE, color: '#16A34A', isActive: true, isDeleted: false },
  { id: 'cat-colegiatura', name: 'Colegiatura', icon: 'GraduationCap', type: TransactionType.EXPENSE, color: '#2563EB', isActive: true, isDeleted: false },
  { id: 'cat-educacion', name: 'Educación', icon: 'BookOpen', type: TransactionType.EXPENSE, color: '#4F46E5', isActive: true, isDeleted: false },
  { id: 'cat-extra', name: 'Gastos extra', icon: 'Sparkles', type: TransactionType.EXPENSE, color: '#9333EA', isActive: true, isDeleted: false },
  { id: 'cat-transporte', name: 'Transporte', icon: 'Car', type: TransactionType.EXPENSE, color: '#0284C7', isActive: true, isDeleted: false },
  { id: 'cat-doctor', name: 'Doctor', icon: 'Stethoscope', type: TransactionType.EXPENSE, color: '#DC2626', isActive: true, isDeleted: false },
  { id: 'cat-salud', name: 'Salud', icon: 'HeartPulse', type: TransactionType.EXPENSE, color: '#E11D48', isActive: true, isDeleted: false },
  { id: 'cat-vivienda', name: 'Vivienda', icon: 'Home', type: TransactionType.EXPENSE, color: '#0D9488', isActive: true, isDeleted: false },
  { id: 'cat-arriendo', name: 'Arriendo', icon: 'Key', type: TransactionType.EXPENSE, color: '#0F766E', isActive: true, isDeleted: false },
  { id: 'cat-gastos-comunes', name: 'Gastos Comunes', icon: 'Home', type: TransactionType.EXPENSE, color: '#0891B2', isActive: true, isDeleted: false },
  { id: 'cat-luz', name: 'Luz', icon: 'Zap', type: TransactionType.EXPENSE, color: '#CA8A04', isActive: true, isDeleted: false },
  { id: 'cat-agua', name: 'Agua', icon: 'Droplets', type: TransactionType.EXPENSE, color: '#0369A1', isActive: true, isDeleted: false },
  { id: 'cat-gas', name: 'Gas', icon: 'Sparkles', type: TransactionType.EXPENSE, color: '#EA580C', isActive: true, isDeleted: false },
  { id: 'cat-internet', name: 'Internet', icon: 'Wifi', type: TransactionType.EXPENSE, color: '#6366F1', isActive: true, isDeleted: false },
  { id: 'cat-suscripciones', name: 'Suscripciones', icon: 'Film', type: TransactionType.EXPENSE, color: '#8B5CF6', isActive: true, isDeleted: false },
  { id: 'cat-cuotas-tc', name: 'Compras en Cuotas', icon: 'CreditCard', type: TransactionType.EXPENSE, color: '#4F46E5', isActive: true, isDeleted: false },
  { id: 'cat-compras-web', name: 'Compras por Internet', icon: 'Globe', type: TransactionType.EXPENSE, color: '#7C3AED', isActive: true, isDeleted: false },
  { id: 'cat-entretenimiento', name: 'Entretenimiento', icon: 'Film', type: TransactionType.EXPENSE, color: '#DB2777', isActive: true, isDeleted: false },
  { id: 'cat-mascotas', name: 'Mascotas', icon: 'PawPrint', type: TransactionType.EXPENSE, color: '#B45309', isActive: true, isDeleted: false },
  { id: 'cat-otros', name: 'Otros', icon: 'MoreHorizontal', type: 'BOTH', color: '#64748B', isActive: true, isDeleted: false },
  // Categorías de Ingreso iniciales
  { id: 'cat-sueldo', name: 'Sueldo / Nómina', icon: 'Briefcase', type: TransactionType.INCOME, color: '#15803D', isActive: true, isDeleted: false },
  { id: 'cat-ventas', name: 'Ventas y Honorarios', icon: 'TrendingUp', type: TransactionType.INCOME, color: '#047857', isActive: true, isDeleted: false },
  { id: 'cat-reembolso', name: 'Reembolsos', icon: 'RotateCcw', type: TransactionType.INCOME, color: '#0E7490', isActive: true, isDeleted: false },
];

export const DEFAULT_PREFERENCES: UserPreferences = {
  assistantName: 'Gastito',
  userName: '',
  themeMode: ThemeMode.SYSTEM,
  currencySymbol: '$',
  notificationsEnabled: true,
  budgetAlertsEnabled: true,
  recurringRemindersEnabled: true,
  hapticFeedbackEnabled: true,
};

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function getOffsetDateStr(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

export function createSeedDatabase(): AppDatabaseState {
  const today = getTodayStr();
  const yesterday = getOffsetDateStr(-1);
  const twoDaysAgo = getOffsetDateStr(-2);
  const fiveDaysAgo = getOffsetDateStr(-5);
  const lastMonthDay8 = getOffsetDateStr(-24);
  const lastMonthDay18 = getOffsetDateStr(-34);
  const twoMonthsAgoDay12 = getOffsetDateStr(-58);
  const inThreeDays = getOffsetDateStr(3);
  const inSevenDays = getOffsetDateStr(7);

  const accounts: Account[] = [
    {
      id: 'acc-banco-principal',
      name: 'Cuenta Nómina',
      type: AccountType.BANK,
      initialBalance: 1850.0,
      additionalInfo: 'Banco Principal · Débito terminar 4821',
      isArchived: false,
      createdAt: fiveDaysAgo,
    },
    {
      id: 'acc-efectivo',
      name: 'Efectivo Billetera',
      type: AccountType.CASH,
      initialBalance: 240.0,
      additionalInfo: 'Billetes para gastos rápidos',
      isArchived: false,
      createdAt: fiveDaysAgo,
    },
    {
      id: 'acc-tc',
      name: 'Tarjeta Crédito Oro',
      type: AccountType.CREDIT,
      initialBalance: 0,
      creditLimit: 2500,
      billingDay: 18,
      paymentDueDay: 5,
      additionalInfo: 'Corte día 18 · Pago límite día 5',
      isArchived: false,
      createdAt: fiveDaysAgo,
    },
  ];

  const transactions: Transaction[] = [
    {
      id: 'tx-1',
      type: TransactionType.INCOME,
      categoryId: 'cat-sueldo',
      amount: 2400.0,
      accountId: 'acc-banco-principal',
      date: fiveDaysAgo,
      description: 'Pago quincenal de nómina',
      createdAt: fiveDaysAgo,
    },
    {
      id: 'tx-2',
      type: TransactionType.EXPENSE,
      categoryId: 'cat-super',
      amount: 148.5,
      accountId: 'acc-banco-principal',
      date: twoDaysAgo,
      description: 'Compra semanal de despensa y verduras',
      createdAt: twoDaysAgo,
    },
    {
      id: 'tx-3',
      type: TransactionType.EXPENSE,
      categoryId: 'cat-comida',
      amount: 24.0,
      accountId: 'acc-efectivo',
      date: yesterday,
      description: 'Almuerzo ejecutivo',
      createdAt: yesterday,
    },
    {
      id: 'tx-4',
      type: TransactionType.EXPENSE,
      categoryId: 'cat-transporte',
      amount: 35.0,
      accountId: 'acc-efectivo',
      date: today,
      description: 'Recarga transporte y combustible',
      createdAt: today,
    },
    {
      id: 'tx-5',
      type: TransactionType.EXPENSE,
      categoryId: 'cat-internet',
      amount: 45.0,
      accountId: 'acc-tc',
      date: today,
      description: 'Plan fibra óptica 600 Mbps',
      createdAt: today,
    },
    {
      id: 'tx-6',
      type: TransactionType.EXPENSE,
      categoryId: 'cat-super',
      amount: 162.0,
      accountId: 'acc-banco-principal',
      date: lastMonthDay8,
      description: 'Supermercado mensual anterior',
      createdAt: lastMonthDay8,
    },
    {
      id: 'tx-7',
      type: TransactionType.EXPENSE,
      categoryId: 'cat-luz',
      amount: 48,
      accountId: 'acc-banco-principal',
      date: lastMonthDay18,
      description: 'Cuenta de electricidad mes pasado',
      linkedObligationId: 'obl-luz',
      createdAt: lastMonthDay18,
    },
    {
      id: 'tx-8',
      type: TransactionType.EXPENSE,
      categoryId: 'cat-super',
      amount: 155.0,
      accountId: 'acc-banco-principal',
      date: twoMonthsAgoDay12,
      description: 'Despensa hace dos meses',
      createdAt: twoMonthsAgoDay12,
    },
  ];

  const transfers: AccountTransfer[] = [
    {
      id: 'tr-1',
      fromAccountId: 'acc-banco-principal',
      toAccountId: 'acc-efectivo',
      amount: 100.0,
      date: twoDaysAgo,
      description: 'Retiro en cajero automático sin comisión',
      createdAt: twoDaysAgo,
    },
  ];

  const debts: DebtRecord[] = [
    {
      id: 'debt-1',
      type: DebtType.OWED_TO_ME,
      personName: 'Martín Morales',
      amount: 42.0,
      date: yesterday,
      description: 'Cena compartida del viernes',
      isPaid: false,
      createdAt: yesterday,
    },
    {
      id: 'debt-2',
      type: DebtType.OWED_TO_ME,
      personName: 'Martín Morales',
      amount: 18.0,
      date: today,
      description: 'Entradas de cine',
      isPaid: false,
      createdAt: today,
    },
    {
      id: 'debt-3',
      type: DebtType.I_OWE,
      personName: 'Sofía Herrera',
      amount: 65.0,
      date: twoDaysAgo,
      description: 'Regalo grupal de cumpleaños',
      isPaid: false,
      createdAt: twoDaysAgo,
    },
  ];

  const budgets: Budget[] = [
    {
      id: 'bgt-super',
      categoryId: 'cat-super',
      limitAmount: 180.0,
      period: BudgetPeriod.MONTHLY,
      startDate: fiveDaysAgo,
      isActive: true,
      history: [
        {
          periodLabel: 'Mes anterior',
          limitAmount: 180.0,
          spentAmount: 172.4,
          closedAt: fiveDaysAgo,
        },
      ],
    },
    {
      id: 'bgt-comida',
      categoryId: 'cat-comida',
      limitAmount: 120.0,
      period: BudgetPeriod.MONTHLY,
      startDate: fiveDaysAgo,
      isActive: true,
      history: [],
    },
    {
      id: 'bgt-transporte',
      categoryId: 'cat-transporte',
      limitAmount: 100.0,
      period: BudgetPeriod.MONTHLY,
      startDate: fiveDaysAgo,
      isActive: true,
      history: [],
    },
  ];

  const obligations: RecurringObligation[] = [
    {
      id: 'obl-arriendo',
      name: 'Arriendo Departamento',
      categoryId: 'cat-arriendo',
      amount: 650,
      isVariableAmount: false,
      accountId: 'acc-banco-principal',
      dueDate: inThreeDays,
      frequency: RecurrenceFrequency.MONTHLY,
      renewalRule: RenewalRule.ONLY_IF_PREVIOUS_PAID,
      notificationsEnabled: true,
      status: ObligationStatus.PENDING,
    },
    {
      id: 'obl-luz',
      name: 'Cuenta de Luz Eléctrica',
      categoryId: 'cat-luz',
      amount: 50,
      isVariableAmount: true,
      accountId: 'acc-banco-principal',
      dueDate: inSevenDays,
      frequency: RecurrenceFrequency.MONTHLY,
      renewalRule: RenewalRule.ONLY_IF_PREVIOUS_PAID,
      notificationsEnabled: true,
      status: ObligationStatus.PENDING,
      lastPaidTransactionId: 'tx-7',
      lastPaidDate: lastMonthDay18,
      lastPaidAmount: 48,
      paymentHistory: [
        {
          id: 'pay-hist-luz-1',
          date: lastMonthDay18,
          amountPaid: 48,
          estimatedAmount: 50,
          accountId: 'acc-banco-principal',
          transactionId: 'tx-7',
          notes: 'Cuenta de electricidad mes pasado',
        },
      ],
    },
    {
      id: 'obl-agua',
      name: 'Cuenta de Agua Potable',
      categoryId: 'cat-agua',
      amount: 22,
      isVariableAmount: true,
      accountId: 'acc-banco-principal',
      dueDate: inSevenDays,
      frequency: RecurrenceFrequency.MONTHLY,
      renewalRule: RenewalRule.ONLY_IF_PREVIOUS_PAID,
      notificationsEnabled: true,
      status: ObligationStatus.PENDING,
    },
    {
      id: 'obl-gastos-comunes',
      name: 'Gastos Comunes',
      categoryId: 'cat-gastos-comunes',
      amount: 85,
      isVariableAmount: true,
      accountId: 'acc-banco-principal',
      dueDate: inThreeDays,
      frequency: RecurrenceFrequency.MONTHLY,
      renewalRule: RenewalRule.ONLY_IF_PREVIOUS_PAID,
      notificationsEnabled: true,
      status: ObligationStatus.PENDING,
    },
    {
      id: 'obl-cuota-tc-1',
      name: 'Equipamiento / Tecnología (En Cuotas)',
      categoryId: 'cat-cuotas-tc',
      amount: 65,
      isVariableAmount: false,
      isInstallmentPlan: true,
      totalInstallments: 6,
      paidInstallments: 1,
      installmentTotalAmount: 390,
      endDate: calculateInstallmentEndDate(today, 5),
      autoChargeCard: true,
      accountId: 'acc-tc',
      dueDate: inSevenDays,
      frequency: RecurrenceFrequency.MONTHLY,
      renewalRule: RenewalRule.AUTO_CREATE,
      notificationsEnabled: true,
      status: ObligationStatus.PENDING,
      lastPaidDate: today,
      lastPaidAmount: 65,
    },
    {
      id: 'obl-sub-streaming',
      name: 'Spotify + Streaming Familiar',
      categoryId: 'cat-suscripciones',
      amount: 15,
      isVariableAmount: false,
      isSubscription: true,
      autoChargeCard: true,
      accountId: 'acc-tc',
      dueDate: inSevenDays,
      frequency: RecurrenceFrequency.MONTHLY,
      renewalRule: RenewalRule.AUTO_CREATE,
      notificationsEnabled: true,
      status: ObligationStatus.PENDING,
    },
  ];

  return {
    preferences: DEFAULT_PREFERENCES,
    categories: INITIAL_CATEGORIES,
    accounts,
    transactions,
    transfers,
    debts,
    budgets,
    obligations,
  };
}

/**
 * Deja el sistema completamente en blanco (sin cuentas, movimientos, transferencias,
 * deudas, presupuestos ni obligaciones), conservando únicamente el catálogo base de categorías.
 */
export function createBlankDatabase(currentPrefs?: Partial<UserPreferences>): AppDatabaseState {
  return {
    preferences: {
      ...DEFAULT_PREFERENCES,
      themeMode: currentPrefs?.themeMode ?? DEFAULT_PREFERENCES.themeMode,
      currencySymbol: currentPrefs?.currencySymbol ?? DEFAULT_PREFERENCES.currencySymbol,
    },
    categories: INITIAL_CATEGORIES,
    accounts: [],
    transactions: [],
    transfers: [],
    debts: [],
    budgets: [],
    obligations: [],
  };
}

export function loadLocalDatabase(): AppDatabaseState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = createSeedDatabase();
      saveLocalDatabase(seed);
      return seed;
    }
    const parsed = JSON.parse(raw) as AppDatabaseState;
    const savedCats = parsed.categories?.length ? [...parsed.categories] : [...INITIAL_CATEGORIES];
    const existingIds = new Set(savedCats.map((c) => c.id));
    for (const initCat of INITIAL_CATEGORIES) {
      if (!existingIds.has(initCat.id)) {
        savedCats.push(initCat);
      }
    }
    const savedAccounts = (parsed.accounts || []).map((acc) => {
      if (acc.type === AccountType.CREDIT && acc.creditLimit === undefined) {
        return {
          ...acc,
          creditLimit: 2500,
          billingDay: acc.billingDay ?? 18,
          paymentDueDay: acc.paymentDueDay ?? 5,
        };
      }
      return acc;
    });
    return {
      preferences: { ...DEFAULT_PREFERENCES, ...(parsed.preferences || {}) },
      categories: savedCats,
      accounts: savedAccounts,
      transactions: parsed.transactions || [],
      transfers: parsed.transfers || [],
      debts: parsed.debts || [],
      budgets: parsed.budgets || [],
      obligations: parsed.obligations || [],
    };
  } catch {
    const seed = createSeedDatabase();
    return seed;
  }
}

export function saveLocalDatabase(state: AppDatabaseState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Error guardando base de datos local:', e);
  }
}

/**
 * Calcula el saldo real actual de una cuenta respetando:
 * Saldo Inicial + Ingresos - Gastos - Transferencias Enviadas + Transferencias Recibidas
 * Las transferencias NUNCA se contabilizan como gasto ni ingreso global.
 */
export function calculateAccountBalance(
  account: Account,
  transactions: Transaction[],
  transfers: AccountTransfer[]
): number {
  let balance = account.initialBalance;

  for (const tx of transactions) {
    if (tx.accountId === account.id) {
      if (tx.type === TransactionType.INCOME) {
        balance += tx.amount;
      } else if (tx.type === TransactionType.EXPENSE) {
        balance -= tx.amount;
      }
    }
  }

  for (const tr of transfers) {
    if (tr.fromAccountId === account.id) {
      balance -= tr.amount;
    }
    if (tr.toAccountId === account.id) {
      balance += tr.amount;
    }
  }

  return Math.round(balance);
}

/**
 * Calcula la fecha exacta de término (YYYY-MM-DD) de una compra en cuotas
 * sumando los meses restantes a partir de la fecha base.
 */
export function calculateInstallmentEndDate(
  startDateStr: string,
  remainingMonths: number
): string {
  const d = new Date(`${startDateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setMonth(fallback.getMonth() + Math.max(0, remainingMonths));
    return fallback.toISOString().split('T')[0];
  }
  d.setMonth(d.getMonth() + Math.max(0, remainingMonths));
  return d.toISOString().split('T')[0];
}

export interface CreditCardUsageSummary {
  account: Account;
  creditLimit: number;
  billedDebt: number; // Gasto ya cargado/facturado en la tarjeta pendiente de abono
  currentMonthDirectSpent: number; // Gastos del mes actual en esta tarjeta
  futureInstallmentsCommitted: number; // Saldo comprometido en cuotas futuras por vencer
  totalUsedCredit: number; // Cupo total ocupado (facturado + cuotas futuras)
  availableCredit: number; // Cupo disponible para gastar
  usagePct: number; // % de cupo utilizado
  activeInstallments: RecurringObligation[];
  activeSubscriptions: RecurringObligation[];
  monthlyInstallmentsLoad: number; // Suma mensual de cuotas activas
  monthlySubscriptionsLoad: number; // Suma mensual de suscripciones en la tarjeta
  totalMonthlyFixedCardLoad: number; // Carga fija mensual total en la tarjeta
}

/**
 * Calcula en tiempo real el cupo total, lo gastado/facturado, el cupo comprometido en cuotas futuras,
 * cuánto cupo queda disponible para gastar y las suscripciones automáticas asociadas a una Tarjeta de Crédito.
 */
export function calculateCreditCardMetrics(
  account: Account,
  transactions: Transaction[],
  transfers: AccountTransfer[],
  obligations: RecurringObligation[]
): CreditCardUsageSummary {
  const creditLimit = Math.max(0, Math.round(account.creditLimit || 0));
  const netBalance = calculateAccountBalance(account, transactions, transfers);
  // En una tarjeta de crédito, un saldo negativo representa deuda/gasto facturado pendiente de pago
  const billedDebt = Math.max(0, Math.round(-netBalance));

  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  const currentMonthDirectSpent = Math.round(
    transactions
      .filter(
        (t) =>
          t.accountId === account.id &&
          t.type === TransactionType.EXPENSE &&
          t.date.startsWith(currentMonthPrefix)
      )
      .reduce((s, t) => s + t.amount, 0)
  );

  const activeInstallments = obligations.filter(
    (o) =>
      o.accountId === account.id &&
      Boolean(o.isInstallmentPlan) &&
      o.status !== ObligationStatus.PAID &&
      (o.paidInstallments || 0) < (o.totalInstallments || 1)
  );

  const futureInstallmentsCommitted = Math.round(
    activeInstallments.reduce((sum, obl) => {
      const total = Math.max(1, obl.totalInstallments || 1);
      const paid = Math.min(total, Math.max(0, obl.paidInstallments || 0));
      const remainingMonths = Math.max(0, total - paid);
      return sum + remainingMonths * obl.amount;
    }, 0)
  );

  const totalUsedCredit = Math.round(billedDebt + futureInstallmentsCommitted);
  const availableCredit =
    creditLimit > 0 ? Math.max(0, creditLimit - totalUsedCredit) : 0;
  const usagePct =
    creditLimit > 0 ? Math.min(100, (totalUsedCredit / creditLimit) * 100) : 0;

  const activeSubscriptions = obligations.filter(
    (o) =>
      o.accountId === account.id &&
      Boolean(o.isSubscription) &&
      o.status !== ObligationStatus.PAID
  );

  const monthlyInstallmentsLoad = Math.round(
    activeInstallments.reduce((s, o) => s + o.amount, 0)
  );
  const monthlySubscriptionsLoad = Math.round(
    activeSubscriptions.reduce((s, o) => s + o.amount, 0)
  );
  const totalMonthlyFixedCardLoad =
    monthlyInstallmentsLoad + monthlySubscriptionsLoad;

  return {
    account,
    creditLimit,
    billedDebt,
    currentMonthDirectSpent,
    futureInstallmentsCommitted,
    totalUsedCredit,
    availableCredit,
    usagePct,
    activeInstallments,
    activeSubscriptions,
    monthlyInstallmentsLoad,
    monthlySubscriptionsLoad,
    totalMonthlyFixedCardLoad,
  };
}

export function triggerHaptic(enabled: boolean, pattern: number | number[] = 15): void {
  if (!enabled) return;
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Dispositivo no soporta vibración
  }
}

export function formatMoney(amount: number, symbol = '$'): string {
  const isNegative = amount < 0;
  const absVal = Math.round(Math.abs(amount));
  const formatted = absVal.toLocaleString('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${isNegative ? '-' : ''}${symbol}${formatted}`;
}

/**
 * Algoritmo de simplificación de deudas para la herramienta de División de Gastos
 */
export function calculateDebtSimplification(
  participants: SplitParticipant[]
): {
  totalExpense: number;
  equalShare: number;
  settlements: SimplifiedDebtSettlement[];
} {
  const valid = participants.filter((p) => p.name.trim().length > 0);
  if (valid.length === 0) {
    return { totalExpense: 0, equalShare: 0, settlements: [] };
  }

  const totalExpense = Math.round(
    valid.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0)
  );
  const equalShare = Math.round(totalExpense / valid.length);

  // Balance neto: positivo = le deben dinero, negativo = debe dinero
  const balances = valid.map((p) => ({
    name: p.name.trim(),
    net: Math.round(p.amountPaid - (p.customShare ?? equalShare)),
  }));

  const debtors = balances
    .filter((b) => b.net < 0)
    .map((b) => ({ name: b.name, amount: Math.abs(b.net) }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = balances
    .filter((b) => b.net > 0)
    .map((b) => ({ name: b.name, amount: b.net }))
    .sort((a, b) => b.amount - a.amount);

  const settlements: SimplifiedDebtSettlement[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const settledAmount = Math.round(Math.min(debtor.amount, creditor.amount));

    if (settledAmount > 0) {
      settlements.push({
        from: debtor.name,
        to: creditor.name,
        amount: settledAmount,
      });
    }

    debtor.amount = Math.round(debtor.amount - settledAmount);
    creditor.amount = Math.round(creditor.amount - settledAmount);

    if (debtor.amount <= 0) i++;
    if (creditor.amount <= 0) j++;
  }

  return {
    totalExpense,
    equalShare,
    settlements,
  };
}
