import {
  AppDatabaseState,
  ObligationStatus,
  TransactionType,
} from '../domain/models';
import { formatMoney, triggerHaptic } from '../data/localRepository';

export type NativePermissionState =
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported';

export interface InAppNotificationPayload {
  id: string;
  title: string;
  body: string;
  tag: string;
  severity: 'info' | 'warning' | 'danger' | 'success';
  createdAt: number;
}

const NOTIFIED_KEYS_STORAGE = 'gastito_v2_notified_tags_session';

function getNotifiedSet(): Set<string> {
  try {
    const raw = sessionStorage.getItem(NOTIFIED_KEYS_STORAGE);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function markNotified(tag: string): void {
  try {
    const set = getNotifiedSet();
    set.add(tag);
    sessionStorage.setItem(NOTIFIED_KEYS_STORAGE, JSON.stringify(Array.from(set)));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Obtiene el estado actual del permiso nativo de notificaciones del navegador / sistema operativo.
 */
export function getNativeNotificationPermission(): NativePermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as NativePermissionState;
}

/**
 * Solicita explícitamente permiso nativo al usuario para mostrar notificaciones del sistema.
 */
export async function requestNativeNotificationPermission(): Promise<NativePermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    if (Notification.permission === 'granted') {
      return 'granted';
    }
    const result = await Notification.requestPermission();
    return result as NativePermissionState;
  } catch {
    return Notification.permission as NativePermissionState;
  }
}

/**
 * Dispara una notificación nativa real del sistema operativo/navegador (Web Notification API / ServiceWorker)
 * y emite simultáneamente un evento visual en la aplicación para garantizar visibilidad inmediata.
 */
export async function sendNativeNotification(options: {
  title: string;
  body: string;
  tag?: string;
  severity?: 'info' | 'warning' | 'danger' | 'success';
  hapticEnabled?: boolean;
  forceRepeat?: boolean;
}): Promise<boolean> {
  const {
    title,
    body,
    tag = `gastito-${Date.now()}`,
    severity = 'info',
    hapticEnabled = true,
    forceRepeat = false,
  } = options;

  if (!forceRepeat) {
    const notified = getNotifiedSet();
    if (notified.has(tag)) {
      return false;
    }
    markNotified(tag);
  }

  if (hapticEnabled) {
    triggerHaptic(
      true,
      severity === 'danger'
        ? [30, 50, 40]
        : severity === 'warning'
        ? [20, 40]
        : 15
    );
  }

  // Emitir evento para el banner nativo in-app (útil también cuando el navegador está en primer plano o iframe)
  if (typeof window !== 'undefined') {
    const payload: InAppNotificationPayload = {
      id: `${tag}-${Date.now()}`,
      title,
      body,
      tag,
      severity,
      createdAt: Date.now(),
    };
    window.dispatchEvent(
      new CustomEvent<InAppNotificationPayload>('gastito-native-notification', {
        detail: payload,
      })
    );
  }

  // Disparar Notificación Nativa del Sistema Operativo / Navegador si tiene permiso concedido
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg && 'showNotification' in reg) {
            await reg.showNotification(title, {
              body,
              tag,
            });
            return true;
          }
        }
      } catch {
        // Fallback al constructor estándar Notification
      }

      try {
        const n = new Notification(title, {
          body,
          tag,
        });
        setTimeout(() => {
          try {
            n.close();
          } catch {
            // Ignore close error
          }
        }, 7000);
        return true;
      } catch {
        // En algunos contextos móviles/iframe new Notification puede requerir SW; el banner in-app ya se mostró
        return true;
      }
    }
  }

  return true;
}

/**
 * Evalúa automáticamente presupuestos (80%, 90%, 100%, Superado) y pagos fijos/obligaciones
 * próximas a vencer o vencidas, disparando notificaciones nativas si están activadas.
 */
export function evaluateAndTriggerDatabaseNotifications(
  dbState: AppDatabaseState
): void {
  const { preferences, budgets, obligations, transactions, categories } =
    dbState;

  if (!preferences.notificationsEnabled) return;

  const assistant = preferences.assistantName?.trim() || 'Gastito';
  const symbol = preferences.currencySymbol || '$';
  const haptic = preferences.hapticFeedbackEnabled;
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  // 1. Evaluar Alertas de Presupuesto (80%, 90%, 100%, Superado)
  if (preferences.budgetAlertsEnabled) {
    budgets
      .filter((b) => b.isActive && b.limitAmount > 0)
      .forEach((b) => {
        const spent = transactions
          .filter(
            (t) =>
              t.type === TransactionType.EXPENSE &&
              t.categoryId === b.categoryId &&
              t.date >= b.startDate
          )
          .reduce((s, t) => s + t.amount, 0);

        const pct = (spent / b.limitAmount) * 100;
        const catName = catMap.get(b.categoryId) || 'Categoría';

        if (pct > 100) {
          sendNativeNotification({
            title: `${assistant}: ¡Presupuesto Superado! (${Math.round(pct)}%)`,
            body: `Has gastado ${formatMoney(spent, symbol)} en ${catName} (Límite: ${formatMoney(
              b.limitAmount,
              symbol
            )}).`,
            tag: `bgt-exceeded-${b.id}-${b.startDate}`,
            severity: 'danger',
            hapticEnabled: haptic,
          });
        } else if (pct >= 100) {
          sendNativeNotification({
            title: `${assistant}: Límite del 100% Alcanzado`,
            body: `Llegaste al 100% de tu presupuesto en ${catName} (${formatMoney(
              spent,
              symbol
            )}).`,
            tag: `bgt-100-${b.id}-${b.startDate}`,
            severity: 'danger',
            hapticEnabled: haptic,
          });
        } else if (pct >= 90) {
          sendNativeNotification({
            title: `${assistant}: Alerta Crítica 90% en ${catName}`,
            body: `Llevas ${formatMoney(spent, symbol)} de ${formatMoney(
              b.limitAmount,
              symbol
            )} (${Math.round(pct)}%).`,
            tag: `bgt-90-${b.id}-${b.startDate}`,
            severity: 'warning',
            hapticEnabled: haptic,
          });
        } else if (pct >= 80) {
          sendNativeNotification({
            title: `${assistant}: Alerta Preventiva 80% en ${catName}`,
            body: `Has consumido el ${Math.round(pct)}% de tu presupuesto en ${catName} (${formatMoney(
              spent,
              symbol
            )}).`,
            tag: `bgt-80-${b.id}-${b.startDate}`,
            severity: 'warning',
            hapticEnabled: haptic,
          });
        }
      });
  }

  // 2. Evaluar Recordatorios de Pagos Fijos / Obligaciones Recurrentes
  if (preferences.recurringRemindersEnabled) {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const inThreeDays = new Date();
    inThreeDays.setDate(today.getDate() + 3);
    const inThreeDaysStr = inThreeDays.toISOString().split('T')[0];

    obligations
      .filter(
        (o) => o.status !== ObligationStatus.PAID && o.notificationsEnabled
      )
      .forEach((obl) => {
        const amountDesc = obl.isVariableAmount
          ? obl.amount > 0
            ? `monto variable (estimado ${formatMoney(obl.amount, symbol)})`
            : 'monto variable (ingresa cuánto pagaste)'
          : formatMoney(obl.amount, symbol);

        if (obl.dueDate < todayStr) {
          sendNativeNotification({
            title: `${assistant}: Recordatorio Vencido — ${obl.name}`,
            body: `La cuenta "${obl.name}" (${amountDesc}) venció el ${obl.dueDate}.`,
            tag: `obl-overdue-${obl.id}-${obl.dueDate}`,
            severity: 'danger',
            hapticEnabled: haptic,
          });
        } else if (obl.dueDate === todayStr) {
          sendNativeNotification({
            title: `${assistant}: Cuenta Vence Hoy — ${obl.name}`,
            body: `Recuerda ingresar el monto pagado de "${obl.name}" (${amountDesc}) que vence hoy.`,
            tag: `obl-today-${obl.id}-${obl.dueDate}`,
            severity: 'warning',
            hapticEnabled: haptic,
          });
        } else if (obl.dueDate <= inThreeDaysStr) {
          sendNativeNotification({
            title: `${assistant}: Próximo Vencimiento — ${obl.name}`,
            body: `"${obl.name}" (${amountDesc}) vence el ${obl.dueDate}.`,
            tag: `obl-soon-${obl.id}-${obl.dueDate}`,
            severity: 'info',
            hapticEnabled: haptic,
          });
        }
      });
  }
}
