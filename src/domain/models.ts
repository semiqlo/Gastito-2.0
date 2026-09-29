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

export interface RecurringObligation {
  id: string;
  name: string;
  categoryId: string;
  amount: number;
  accountId: string;
  dueDate: string; // YYYY-MM-DD
  frequency: RecurrenceFrequency;
  renewalRule: RenewalRule;
  notificationsEnabled: boolean;
  status: ObligationStatus;
  lastPaidTransactionId?: string;
  lastPaidDate?: string;
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
