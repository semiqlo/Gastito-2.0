import React, { useState, useRef } from 'react';
import {
  AppDatabaseState,
  Category,
  ThemeMode,
  TransactionType,
  UserPreferences,
} from '../domain/models';
import { AVAILABLE_CATEGORY_ICONS, CategoryIcon } from './GastitoLogo';
import {
  exportDatabaseBackupJson,
  exportToMultiSheetExcel,
} from '../utils/exportManager';
import { triggerHaptic } from '../data/localRepository';
import {
  getNativeNotificationPermission,
  NativePermissionState,
  requestNativeNotificationPermission,
  sendNativeNotification,
} from '../utils/nativeNotificationManager';
import { GoogleDriveBackupSection } from './GoogleDriveBackupSection';
import {
  AlertTriangle,
  Bell,
  Check,
  Database,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Monitor,
  Moon,
  Plus,
  RotateCcw,
  Sun,
  Tag,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dbState: AppDatabaseState;
  onUpdatePreferences: (prefs: Partial<UserPreferences>) => void;
  onSaveCategory: (cat: Omit<Category, 'id' | 'isDeleted'>, existingId?: string) => void;
  onToggleCategoryActive: (categoryId: string) => void;
  onSoftDeleteCategory: (categoryId: string) => void;
  onRestoreBackup: (newState: AppDatabaseState) => void;
  onResetDatabase: () => void;
  onClearAllData: () => void;
}

const PRESET_COLORS = [
  '#047857',
  '#16A34A',
  '#0284C7',
  '#2563EB',
  '#4F46E5',
  '#7C3AED',
  '#9333EA',
  '#DB2777',
  '#E11D48',
  '#DC2626',
  '#D97706',
  '#CA8A04',
  '#64748B',
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  dbState,
  onUpdatePreferences,
  onSaveCategory,
  onToggleCategoryActive,
  onSoftDeleteCategory,
  onRestoreBackup,
  onResetDatabase,
  onClearAllData,
}) => {
  const { preferences, categories } = dbState;
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'CATEGORIES' | 'NOTIFICATIONS' | 'DATA'>(
    'GENERAL'
  );

  // Estado formulario de categoría
  const [editingCatId, setEditingCatId] = useState<string | undefined>(undefined);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<TransactionType | 'BOTH'>(TransactionType.EXPENSE);
  const [catIcon, setCatIcon] = useState<string>('Utensils');
  const [catColor, setCatColor] = useState<string>('#047857');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [nativePerm, setNativePerm] = useState<NativePermissionState>(() =>
    getNativeNotificationPermission()
  );
  const [notifFeedback, setNotifFeedback] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleRequestNativePermission = async () => {
    triggerHaptic(preferences.hapticFeedbackEnabled, 15);
    const result = await requestNativeNotificationPermission();
    setNativePerm(result);
    if (result === 'granted') {
      onUpdatePreferences({
        notificationsEnabled: true,
        budgetAlertsEnabled: true,
        recurringRemindersEnabled: true,
      });
      await sendNativeNotification({
        title: `${preferences.assistantName || 'Gastito'}: Notificaciones Nativas Activas`,
        body: 'El permiso fue concedido correctamente. Recibirás alertas de presupuestos y pagos fijos.',
        tag: `perm-granted-${Date.now()}`,
        severity: 'success',
        hapticEnabled: preferences.hapticFeedbackEnabled,
        forceRepeat: true,
      });
      setNotifFeedback('Permiso concedido y notificaciones nativas activadas.');
    } else if (result === 'denied') {
      setNotifFeedback(
        'El permiso de notificaciones está bloqueado en la configuración del navegador.'
      );
    } else {
      setNotifFeedback('Solicitud de permiso cerrada sin confirmar.');
    }
    setTimeout(() => setNotifFeedback(null), 4000);
  };

  const handleTestNativeNotification = async () => {
    triggerHaptic(preferences.hapticFeedbackEnabled, [15, 30]);
    if (getNativeNotificationPermission() === 'default') {
      const res = await requestNativeNotificationPermission();
      setNativePerm(res);
    }
    await sendNativeNotification({
      title: `${preferences.assistantName || 'Gastito'} — Prueba de Alerta Nativa`,
      body: `Hola ${
        preferences.userName?.trim() || 'Usuario'
      }, las notificaciones nativas de presupuestos y pagos fijos están funcionando correctamente.`,
      tag: `test-notif-${Date.now()}`,
      severity: 'info',
      hapticEnabled: preferences.hapticFeedbackEnabled,
      forceRepeat: true,
    });
    setNotifFeedback('Notificación nativa de prueba enviada.');
    setTimeout(() => setNotifFeedback(null), 3500);
  };

  const visibleCategories = categories.filter((c) => !c.isDeleted);

  const startEditCategory = (cat: Category) => {
    setEditingCatId(cat.id);
    setCatName(cat.name);
    setCatType(cat.type);
    setCatIcon(cat.icon);
    setCatColor(cat.color);
  };

  const resetCategoryForm = () => {
    setEditingCatId(undefined);
    setCatName('');
    setCatType(TransactionType.EXPENSE);
    setCatIcon('Utensils');
    setCatColor('#047857');
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    triggerHaptic(preferences.hapticFeedbackEnabled, 15);
    onSaveCategory(
      {
        name: catName.trim(),
        type: catType,
        icon: catIcon,
        color: catColor,
        isActive: true,
      },
      editingCatId
    );
    resetCategoryForm();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result)) as AppDatabaseState;
        if (parsed && Array.isArray(parsed.categories) && Array.isArray(parsed.accounts)) {
          onRestoreBackup(parsed);
          setImportStatus('Copia de seguridad restaurada correctamente.');
          setTimeout(() => setImportStatus(null), 3500);
        } else {
          setImportStatus('El archivo JSON no tiene el formato de Gastito 2.0.');
        }
      } catch {
        setImportStatus('Error al leer el archivo JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200/80 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-stone-900 dark:text-zinc-100">
              Configuración de Gastito 2.0
            </h2>
            <p className="text-xs text-stone-500 dark:text-zinc-400">
              100 % Local · Room Database & DataStore
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-300 hover:bg-stone-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas de Configuración */}
        <div className="grid grid-cols-4 gap-1 p-2 bg-stone-100 dark:bg-zinc-800/70 border-b border-stone-200/60 dark:border-zinc-800">
          {(
            [
              { id: 'GENERAL', label: 'Perfil y Tema', icon: User },
              { id: 'CATEGORIES', label: 'Categorías', icon: Tag },
              { id: 'NOTIFICATIONS', label: 'Alertas', icon: Bell },
              { id: 'DATA', label: 'Datos y Backup', icon: Database },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                    : 'text-stone-600 dark:text-zinc-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Contenido */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'GENERAL' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1">
                    Nombre del Asistente
                  </label>
                  <input
                    type="text"
                    value={preferences.assistantName}
                    onChange={(e) => onUpdatePreferences({ assistantName: e.target.value })}
                    placeholder="Gastito"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-sm text-stone-900 dark:text-zinc-100"
                  />
                  <p className="text-[11px] text-stone-400 mt-1">Por defecto: “Gastito”</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1">
                    Tu Nombre (Saludo Dinámico)
                  </label>
                  <input
                    type="text"
                    value={preferences.userName}
                    onChange={(e) => onUpdatePreferences({ userName: e.target.value })}
                    placeholder="Ej. Carlos (vacío por defecto)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-sm text-stone-900 dark:text-zinc-100"
                  />
                  <p className="text-[11px] text-stone-400 mt-1">
                    {preferences.userName.trim()
                      ? `Vista previa: “Hola ${preferences.userName.trim()}, ¿qué quieres ingresar?”`
                      : 'Vista previa: “Saludos, ¿qué quieres ingresar?”'}
                  </p>
                </div>
              </div>

              {/* Tema Claro / Oscuro / Sistema */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-2">
                  Tema de la Aplicación
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      { mode: ThemeMode.LIGHT, label: 'Claro', icon: Sun },
                      { mode: ThemeMode.DARK, label: 'Oscuro', icon: Moon },
                      { mode: ThemeMode.SYSTEM, label: 'Seguir Sistema', icon: Monitor },
                    ] as const
                  ).map((item) => {
                    const Icon = item.icon;
                    const active = preferences.themeMode === item.mode;
                    return (
                      <button
                        key={item.mode}
                        type="button"
                        onClick={() => onUpdatePreferences({ themeMode: item.mode })}
                        className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                          active
                            ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                            : 'border-stone-200 dark:border-zinc-800 text-stone-600 dark:text-zinc-400'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Símbolo de Moneda */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1">
                  Símbolo de Moneda Local
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {['$', '€', '¥', '¢', '£'].map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => onUpdatePreferences({ currencySymbol: sym })}
                      className={`py-2.5 px-3 rounded-xl text-sm font-mono font-bold border flex items-center justify-center transition-colors ${
                        preferences.currencySymbol === sym
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-stone-50 dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-zinc-300'
                      }`}
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'CATEGORIES' && (
            <div className="space-y-4">
              {/* Formulario Crear / Editar Categoría */}
              <form
                onSubmit={handleCategorySubmit}
                className="p-4 rounded-2xl bg-stone-50 dark:bg-zinc-800/60 border border-stone-200/80 dark:border-zinc-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                    {editingCatId ? 'Editar Categoría' : 'Crear Nueva Categoría'}
                  </span>
                  {editingCatId && (
                    <button
                      type="button"
                      onClick={resetCategoryForm}
                      className="text-xs text-stone-500 hover:underline"
                    >
                      Cancelar edición
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    placeholder="Nombre de categoría..."
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-sm"
                  />
                  <select
                    value={catType}
                    onChange={(e) => setCatType(e.target.value as TransactionType | 'BOTH')}
                    className="px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-xs font-semibold"
                  >
                    <option value={TransactionType.EXPENSE}>Gasto</option>
                    <option value={TransactionType.INCOME}>Ingreso</option>
                    <option value="BOTH">Ambos (Gasto e Ingreso)</option>
                  </select>
                </div>

                {/* Selección de Icono */}
                <div>
                  <span className="block text-[11px] font-semibold text-stone-500 mb-1.5">
                    Icono Personalizable
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
                    {AVAILABLE_CATEGORY_ICONS.map((iconName) => (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setCatIcon(iconName)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${
                          catIcon === iconName
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-white dark:bg-zinc-900 border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-zinc-300'
                        }`}
                      >
                        <CategoryIcon iconName={iconName} className="w-4 h-4" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selección de Color */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setCatColor(color)}
                        className={`w-6 h-6 rounded-full border-2 ${
                          catColor === color ? 'border-stone-900 dark:border-white scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>

                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {editingCatId ? 'Actualizar' : 'Guardar'}
                  </button>
                </div>
              </form>

              <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                Regla de integridad: Eliminar una categoría realiza un borrado seguro (soft-delete)
                que <strong>nunca elimina los movimientos históricos asociados</strong>.
              </p>

              {/* Lista de Categorías */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {visibleCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                      cat.isActive
                        ? 'bg-white dark:bg-zinc-900 border-stone-200/80 dark:border-zinc-800'
                        : 'bg-stone-100/60 dark:bg-zinc-800/30 border-stone-200/40 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                        style={{ backgroundColor: cat.color }}
                      >
                        <CategoryIcon iconName={cat.icon} className="w-4 h-4" />
                      </span>
                      <div>
                        <p className="text-xs font-bold text-stone-900 dark:text-zinc-100">
                          {cat.name}
                        </p>
                        <span className="text-[10px] text-stone-400 uppercase font-semibold">
                          {cat.type === 'BOTH'
                            ? 'Gasto e Ingreso'
                            : cat.type === TransactionType.EXPENSE
                            ? 'Gasto'
                            : 'Ingreso'}{' '}
                          · {cat.isActive ? 'Activa' : 'Desactivada'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onToggleCategoryActive(cat.id)}
                        title={cat.isActive ? 'Desactivar categoría' : 'Activar categoría'}
                        className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-800"
                      >
                        {cat.isActive ? (
                          <Eye className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-stone-400" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditCategory(cat)}
                        className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-800"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSoftDeleteCategory(cat.id)}
                        title="Eliminar sin borrar movimientos históricos"
                        className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'NOTIFICATIONS' && (
            <div className="space-y-3.5">
              {/* Tarjeta de Permiso Nativo del Sistema / Navegador */}
              <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-stone-900 dark:text-zinc-100">
                        Permiso de Notificaciones Nativas del Dispositivo
                      </h4>
                      <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                        Autoriza al sistema para mostrar alertas emergentes de presupuestos y vencimientos
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                      nativePerm === 'granted'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : nativePerm === 'denied'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {nativePerm === 'granted'
                      ? 'Permiso Concedido'
                      : nativePerm === 'denied'
                      ? 'Permiso Bloqueado'
                      : nativePerm === 'default'
                      ? 'Requiere Autorización'
                      : 'Modo Integrado Activo'}
                  </span>
                </div>

                {notifFeedback && (
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{notifFeedback}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {nativePerm !== 'granted' && (
                    <button
                      type="button"
                      onClick={handleRequestNativePermission}
                      className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      Solicitar Permiso y Activar Notificaciones
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleTestNativeNotification}
                    className="px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 hover:border-emerald-600 text-stone-800 dark:text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Bell className="w-3.5 h-3.5 text-emerald-600" />
                    Enviar Notificación Nativa de Prueba
                  </button>
                </div>
              </div>

              {(
                [
                  {
                    key: 'notificationsEnabled',
                    title: 'Notificaciones Nativas del Sistema',
                    desc: 'Activar el motor general de notificaciones en el dispositivo',
                  },
                  {
                    key: 'budgetAlertsEnabled',
                    title: 'Alertas de Presupuesto (80 %, 90 %, 100 %, Superado)',
                    desc: 'Avisar automáticamente cuando una categoría se acerque o supere su límite',
                  },
                  {
                    key: 'recurringRemindersEnabled',
                    title: 'Recordatorios de Pagos Fijos / Obligaciones',
                    desc: 'Notificar cuando una obligación esté próxima a vencer, venza hoy o esté atrasada',
                  },
                  {
                    key: 'hapticFeedbackEnabled',
                    title: 'Respuesta Háptica Nativa (Haptic Feedback)',
                    desc: 'Vibración sutil al confirmar movimientos, cambiar pestañas y marcar deudas',
                  },
                ] as const
              ).map((item) => {
                const checked = preferences[item.key];
                return (
                  <label
                    key={item.key}
                    className="p-4 rounded-2xl border border-stone-200/80 dark:border-zinc-800 flex items-center justify-between gap-4 cursor-pointer hover:bg-stone-50/50 dark:hover:bg-zinc-800/40"
                  >
                    <div>
                      <p className="text-sm font-bold text-stone-900 dark:text-zinc-100">
                        {item.title}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-zinc-400">{item.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={async (e) => {
                        const nextVal = e.target.checked;
                        onUpdatePreferences({ [item.key]: nextVal });
                        if (
                          nextVal &&
                          item.key !== 'hapticFeedbackEnabled' &&
                          getNativeNotificationPermission() === 'default'
                        ) {
                          const perm = await requestNativeNotificationPermission();
                          setNativePerm(perm);
                        }
                      }}
                      className="w-5 h-5 accent-emerald-700 rounded-md"
                    />
                  </label>
                );
              })}
            </div>
          )}

          {activeTab === 'DATA' && (
            <div className="space-y-3.5">
              {importStatus && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  {importStatus}
                </div>
              )}

              {/* Respaldo en la nube con Google Drive */}
              <GoogleDriveBackupSection
                dbState={dbState}
                onRestoreBackup={onRestoreBackup}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => exportDatabaseBackupJson(dbState)}
                  className="p-4 rounded-2xl border border-stone-200 dark:border-zinc-800 hover:border-emerald-600 text-left space-y-1 transition-all"
                >
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                    <Download className="w-4 h-4" />
                    Crear Copia de Seguridad (.JSON)
                  </div>
                  <p className="text-xs text-stone-500 dark:text-zinc-400">
                    Descarga toda tu base de datos local para guardarla o migrar de teléfono.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-4 rounded-2xl border border-stone-200 dark:border-zinc-800 hover:border-emerald-600 text-left space-y-1 transition-all"
                >
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                    <Upload className="w-4 h-4" />
                    Restaurar / Importar Copia (.JSON)
                  </div>
                  <p className="text-xs text-stone-500 dark:text-zinc-400">
                    Selecciona un archivo de respaldo de Gastito 2.0 desde tu dispositivo.
                  </p>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => exportToMultiSheetExcel(dbState)}
                  className="p-4 rounded-2xl border border-stone-200 dark:border-zinc-800 hover:border-emerald-600 text-left space-y-1 transition-all"
                >
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                    <FileSpreadsheet className="w-4 h-4" />
                    Exportar a Excel (9 Hojas)
                  </div>
                  <p className="text-xs text-stone-500 dark:text-zinc-400">
                    Descarga inmediata en formato hoja de cálculo multi-pestaña.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onResetDatabase();
                    setImportStatus('Datos de demostración restaurados correctamente.');
                    setTimeout(() => setImportStatus(null), 3000);
                  }}
                  className="p-4 rounded-2xl border border-stone-200 dark:border-zinc-800 hover:border-amber-500 text-left space-y-1 transition-all"
                >
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                    <RotateCcw className="w-4 h-4" />
                    Restaurar Datos de Demostración
                  </div>
                  <p className="text-xs text-stone-500 dark:text-zinc-400">
                    Reinicia la base de datos local con datos de ejemplo y las 17 categorías base.
                  </p>
                </button>
              </div>

              {/* Eliminar todos los datos (Dejar en blanco el sistema) */}
              <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs">
                      <Trash2 className="w-4 h-4" />
                      Eliminar Todos los Datos (Dejar el Sistema en Blanco)
                    </div>
                    <p className="text-xs text-stone-600 dark:text-zinc-400">
                      Borra absolutamente todos los movimientos, cuentas, transferencias, deudas,
                      presupuestos y pagos fijos para empezar desde cero.
                    </p>
                  </div>
                </div>

                {!confirmWipe ? (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(preferences.hapticFeedbackEnabled, 15);
                      setConfirmWipe(true);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Dejar en Blanco el Sistema
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-rose-300 dark:border-rose-800 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-400">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      ¿Confirmas eliminar todos los registros y dejar el sistema en blanco?
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic(preferences.hapticFeedbackEnabled, [30, 50]);
                          onClearAllData();
                          setConfirmWipe(false);
                          setImportStatus('El sistema ha quedado completamente en blanco.');
                          setTimeout(() => setImportStatus(null), 3500);
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                      >
                        Sí, eliminar todo
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmWipe(false)}
                        className="py-2 px-4 rounded-xl bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 text-xs font-bold"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
