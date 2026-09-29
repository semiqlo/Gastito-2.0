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
  { id: 'cat-luz', name: 'Luz', icon: 'Zap', type: TransactionType.EXPENSE, color: '#CA8A04', isActive: true, isDeleted: false },
  { id: 'cat-agua', name: 'Agua', icon: 'Droplets', type: TransactionType.EXPENSE, color: '#0369A1', isActive: true, isDeleted: false },
  { id: 'cat-internet', name: 'Internet', icon: 'Wifi', type: TransactionType.EXPENSE, color: '#6366F1', isActive: true, isDeleted: false },
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
      initialBalance: 0.0,
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
      amount: 48.0,
      accountId: 'acc-banco-principal',
      date: lastMonthDay18,
      description: 'Cuenta de electricidad mes pasado',
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
      amount: 650.0,
      accountId: 'acc-banco-principal',
      dueDate: inThreeDays,
      frequency: RecurrenceFrequency.MONTHLY,
      renewalRule: RenewalRule.ONLY_IF_PREVIOUS_PAID,
      notificationsEnabled: true,
      status: ObligationStatus.PENDING,
    },
    {
      id: 'obl-luz',
      name: 'Recibo de Luz Eléctrica',
      categoryId: 'cat-luz',
      amount: 52.0,
      accountId: 'acc-banco-principal',
      dueDate: inSevenDays,
      frequency: RecurrenceFrequency.MONTHLY,
      renewalRule: RenewalRule.ASK_BEFORE,
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
    return {
      preferences: { ...DEFAULT_PREFERENCES, ...(parsed.preferences || {}) },
      categories: parsed.categories?.length ? parsed.categories : INITIAL_CATEGORIES,
      accounts: parsed.accounts || [],
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
