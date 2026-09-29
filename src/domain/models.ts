export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
}

export enum AccountType {
  BANK = 'BANK',
  CASH = 'CASH',
  CREDIT = 'CREDIT',
  OTHER = 'OTHER',
}

export enum DebtType {
  OWED_TO_ME = 'OWED_TO_ME', // "Me deben"
  I_OWE = 'I_OWE',           // "Debo"
}

export enum BudgetPeriod {
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM',
}

export enum RecurrenceFrequency {
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export enum RenewalRule {
  AUTO_CREATE = 'AUTO_CREATE',
  ASK_BEFORE = 'ASK_BEFORE',
  ONLY_IF_PREVIOUS_PAID = 'ONLY_IF_PREVIOUS_PAID',
}

export enum ObligationStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
}

export enum ThemeMode {
  LIGHT = 'LIGHT',
  DARK = 'DARK',
  SYSTEM = 'SYSTEM',
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  type: TransactionType | 'BOTH';
  color: string;
  isActive: boolean;
  isDeleted: boolean; // Soft-delete to preserve historical movements
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  creditLimit?: number; // Cupo total autorizado para tarjetas de crédito
  billingDay?: number; // Día de corte / facturación mensual (1-31)
  paymentDueDay?: number; // Día de pago mensual (1-31)
  additionalInfo: string;
  isArchived: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  categoryId: string;
  amount: number;
  accountId: string;
  date: string; // YYYY-MM-DD
  description: string;
  linkedObligationId?: string;
  installmentInfo?: {
    current: number;
    total: number;
    totalPurchaseAmount: number;
  };
  createdAt: string;
}

export interface AccountTransfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  description: string;
  createdAt: string;
}

export interface DebtRecord {
  id: string;
  type: DebtType;
  personName: string;
  amount: number;
  date: string; // YYYY-MM-DD
  description: string;
  isPaid: boolean;
  paidAt?: string;
  createdAt: string;
}

export interface SplitParticipant {
  id: string;
  name: string;
  amountPaid: number;
  customShare?: number;
}

export interface SimplifiedDebtSettlement {
  from: string;
  to: string;
  amount: number;
}

export interface Budget {
  id: string;
  categoryId: string;
  limitAmount: number;
  period: BudgetPeriod;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  history: {
    periodLabel: string;
    limitAmount: number;
    spentAmount: number;
    closedAt: string;
  }[];
}

export interface ObligationPaymentRecord {
  id: string;
  date: string; // YYYY-MM-DD
  amountPaid: number;
  estimatedAmount: number;
  accountId: string;
  transactionId: string;
  notes?: string;
}

export interface RecurringObligation {
  id: string;
  name: string;
  categoryId: string;
  amount: number; // Monto fijo, cuota mensual o monto estimado/referencial
  isVariableAmount?: boolean; // true para cuentas como Luz, Agua, Gastos Comunes cuyo monto varía mes a mes
  isInstallmentPlan?: boolean; // true cuando es una compra en cuotas con tarjeta de crédito con meses definidos
  totalInstallments?: number; // Cantidad total de cuotas/meses (ej. 3, 6, 12, 24)
  paidInstallments?: number; // Cuotas ya pagadas/cargadas (ej. 1 de 6)
  installmentTotalAmount?: number; // Monto total original de la compra en cuotas
  endDate?: string; // Fecha de término automática (YYYY-MM-DD) al cumplir las cuotas
  isSubscription?: boolean; // true para suscripciones (Spotify, Netflix, Gimnasio, iCloud, etc.)
  autoChargeCard?: boolean; // true si se carga automáticamente a la tarjeta/cuenta en su fecha de cobro
  accountId: string;
  dueDate: string; // YYYY-MM-DD
  frequency: RecurrenceFrequency;
  renewalRule: RenewalRule;
  notificationsEnabled: boolean;
  status: ObligationStatus;
  lastPaidTransactionId?: string;
  lastPaidDate?: string;
  lastPaidAmount?: number;
  paymentHistory?: ObligationPaymentRecord[];
}

export interface UserPreferences {
  assistantName: string;
  userName: string;
  themeMode: ThemeMode;
  currencySymbol: string;
  notificationsEnabled: boolean;
  budgetAlertsEnabled: boolean;
  recurringRemindersEnabled: boolean;
  hapticFeedbackEnabled: boolean;
}

export interface AppDatabaseState {
  preferences: UserPreferences;
  categories: Category[];
  accounts: Account[];
  transactions: Transaction[];
  transfers: AccountTransfer[];
  debts: DebtRecord[];
  budgets: Budget[];
  obligations: RecurringObligation[];
}
