import {
  AppDatabaseState,
  ObligationStatus,
  RecurringObligation,
  TransactionType,
} from '../domain/models';
import { formatMoney, getTodayLocalDate, triggerHaptic } from '../data/localRepository';
import { LocalNotifications } from '@capacitor/local-notifications';

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

const NOTIFIED_KEYS_STORAGE = 'gastito_v2_notified_tags_persistent';

function getNotifiedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEYS_STORAGE);
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
    const arr = Array.from(set);
    if (arr.length > 200) {
      arr.splice(0, arr.length - 200);
    }
    localStorage.setItem(NOTIFIED_KEYS_STORAGE, JSON.stringify(arr));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Genera un ID numérico determinístico a partir del ID alfanumérico de la obligación (para Capacitor Local Notifications).
 */
export function getDeterministicNotificationId(obligationId: string): number {
  let hash = 0;
  for (let i = 0; i < obligationId.length; i++) {
    hash = (hash << 5) - hash + obligationId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2147483647;
}

/**
 * Crea el canal de notificaciones de Android con alta importancia, sonido y vibración.
 */
export async function createGastitoNotificationChannel(): Promise<void> {
  try {
    await LocalNotifications.createChannel({
      id: 'gastito_reminders',
      name: 'Recordatorios y Pagos Gastito',
      description: 'Canal para vencimientos, presupuestos y recordatorios de pagos',
      importance: 5, // High
      visibility: 1, // Public
      sound: 'default',
      vibration: true,
    });
  } catch {
    // Entorno web puro sin plugin de Capacitor
  }
}

/**
 * Inicializa el listener de clics en notificaciones de Capacitor para navegar a la sección correspondiente.
 */
export function initCapacitorNotificationActionListener(): void {
  try {
    LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
      const extra = notification.notification.extra;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('gastito-navigate-tab', {
            detail: { tab: 'RESUMEN', subSection: 'RECURRING', extra },
          })
        );
      }
    });
  } catch {
    // Ignore if not in Capacitor native environment
  }
}

/**
 * Comprueba los permisos de notificaciones exactas en Android 12+/13+.
 */
export async function checkAndroidExactAlarmSettings() {
  try {
    return await LocalNotifications.checkPermissions();
  } catch {
    return null;
  }
}

/**
 * Verifica el estado del ajuste de notificaciones exactas.
 */
export async function checkExactNotificationSetting() {
  try {
    return await LocalNotifications.checkPermissions();
  } catch {
    return null;
  }
}

/**
 * Solicita habilitar notificaciones exactas.
 */
export async function changeExactNotificationSetting() {
  try {
    return await LocalNotifications.requestPermissions();
  } catch {
    return null;
  }
}

/**
 * Obtiene el estado actual del permiso nativo de notificaciones.
 */
export function getNativeNotificationPermission(): NativePermissionState {
  if (typeof window === 'undefined') {
    return 'unsupported';
  }
  if ('Notification' in window) {
    return Notification.permission as NativePermissionState;
  }
  return 'default';
}

/**
 * Solicita explícitamente permiso nativo al usuario.
 */
export async function requestNativeNotificationPermission(): Promise<NativePermissionState> {
  try {
    const capRes = await LocalNotifications.requestPermissions();
    if (capRes.display === 'granted') {
      await createGastitoNotificationChannel();
      return 'granted';
    }
  } catch {
    // Capacitor no disponible o web puro
  }

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
 * Programa una notificación local en Capacitor para una obligación en su fecha de vencimiento a las 09:00 AM.
 */
export async function scheduleObligationNotification(obligation: RecurringObligation): Promise<void> {
  if (obligation.status === ObligationStatus.PAID || !obligation.notificationsEnabled) {
    return;
  }
  try {
    const notifId = getDeterministicNotificationId(obligation.id);
    // Cancelar primero por si ya existía con otra fecha
    await LocalNotifications.cancel({ notifications: [{ id: notifId }] });

    const dueParts = obligation.dueDate.split('-');
    if (dueParts.length === 3) {
      const year = parseInt(dueParts[0], 10);
      const month = parseInt(dueParts[1], 10) - 1;
      const day = parseInt(dueParts[2], 10);
      const scheduleDate = new Date(year, month, day, 9, 0, 0);

      // Si la fecha ya pasó hoy, programar para un minuto después o no programar
      if (scheduleDate.getTime() <= Date.now()) {
        scheduleDate.setTime(Date.now() + 60000);
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title: `Gastito: Vencimiento de Cuenta — ${obligation.name}`,
            body: `La obligación "${obligation.name}" vence hoy o está pendiente de pago.`,
            schedule: { at: scheduleDate },
            channelId: 'gastito_reminders',
            sound: 'default',
            extra: { obligationId: obligation.id, tag: `obl-${obligation.id}` },
          },
        ],
      });
    }
  } catch {
    // Entorno web puro sin plugin de Capacitor
  }
}

/**
 * Cancela la notificación programada de una obligación (al ser pagada o eliminada).
 */
export async function cancelObligationNotification(obligationId: string): Promise<void> {
  try {
    const notifId = getDeterministicNotificationId(obligationId);
    await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
  } catch {
    // Ignorar si no está en Capacitor
  }
}

/**
 * Reprograma la notificación de una obligación (al cambiar su fecha u otros detalles).
 */
export async function rescheduleObligationNotification(obligation: RecurringObligation): Promise<void> {
  await cancelObligationNotification(obligation.id);
  await scheduleObligationNotification(obligation);
}

/**
 * Obtiene las notificaciones locales pendientes programadas en Capacitor.
 */
export async function getPendingNotifications() {
  try {
    return await LocalNotifications.getPending();
  } catch {
    return { notifications: [] };
  }
}

/**
 * Reconstruye y reprograma todas las notificaciones pendientes de obligaciones al iniciar la app.
 */
export async function rebuildAllObligationNotifications(obligations: RecurringObligation[]): Promise<void> {
  try {
    await createGastitoNotificationChannel();
    for (const obl of obligations) {
      if (obl.status !== ObligationStatus.PAID && obl.notificationsEnabled) {
        await scheduleObligationNotification(obl);
      } else {
        await cancelObligationNotification(obl.id);
      }
    }
  } catch {
    // Ignorar si Capacitor no está disponible
  }
}

/**
 * Dispara una notificación nativa in-app / web real.
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
        // Fallback
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
        return true;
      }
    }
  }

  return true;
}

/**
 * Evalúa automáticamente presupuestos y obligaciones recurrentes.
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
  const todayStr = getTodayLocalDate();

  // 1. Evaluar Alertas de Presupuesto
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

  // 2. Evaluar Recordatorios de Pagos Fijos / Obligaciones Recurrentes (y programar Capacitor si procede)
  if (preferences.recurringRemindersEnabled) {
    const todayObj = new Date();
    const inThreeDaysObj = new Date();
    inThreeDaysObj.setDate(todayObj.getDate() + 3);
    const inThreeDaysStr = getTodayLocalDate(inThreeDaysObj);

    obligations.forEach((obl) => {
      // Sincronizar programación en Capacitor
      if (obl.status !== ObligationStatus.PAID && obl.notificationsEnabled) {
        scheduleObligationNotification(obl);
      } else {
        cancelObligationNotification(obl.id);
      }

      if (obl.status === ObligationStatus.PAID || !obl.notificationsEnabled) {
        return;
      }

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
