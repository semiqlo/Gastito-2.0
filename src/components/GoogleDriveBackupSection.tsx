import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { AppDatabaseState } from '../domain/models';
import {
  initGoogleAuth,
  googleSignIn,
  googleLogout,
  listDriveBackups,
  createDriveBackup,
  updateDriveBackup,
  downloadDriveBackup,
  deleteDriveBackup,
  DriveBackupFile,
} from '../utils/googleDriveBackup';
import { triggerHaptic } from '../data/localRepository';
import {
  AlertTriangle,
  Check,
  Cloud,
  CloudDownload,
  CloudUpload,
  LogOut,
  RefreshCw,
  Trash2,
} from 'lucide-react';

interface GoogleDriveBackupSectionProps {
  dbState: AppDatabaseState;
  onRestoreBackup: (newState: AppDatabaseState) => void;
}

export const GoogleDriveBackupSection: React.FC<GoogleDriveBackupSectionProps> = ({
  dbState,
  onRestoreBackup,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<DriveBackupFile[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Confirmación obligatoria antes de sobrescribir, restaurar o eliminar en Google Drive
  const [pendingAction, setPendingAction] = useState<{
    type: 'OVERWRITE' | 'DELETE' | 'RESTORE';
    file: DriveBackupFile;
  } | null>(null);

  const haptic = dbState.preferences.hapticFeedbackEnabled;

  const fetchBackups = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const list = await listDriveBackups();
      setFiles(list);
    } catch (err: any) {
      if (err?.message === 'AUTH_REQUIRED') {
        setNeedsAuth(true);
      } else {
        setErrorMsg('No se pudieron listar los respaldos de Google Drive.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (loggedUser) => {
        setUser(loggedUser);
        setNeedsAuth(false);
        fetchBackups();
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
        setFiles([]);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      triggerHaptic(haptic, 15);
      const result = await googleSignIn();
      if (!result || result.cancelled) {
        setStatusMsg('Inicio de sesión cancelado (se cerró la ventana de Google).');
        setTimeout(() => setStatusMsg(null), 4000);
        return;
      }
      if (result.errorMessage) {
        setErrorMsg(result.errorMessage);
        return;
      }
      if (result.user) {
        setUser(result.user);
        setNeedsAuth(false);
        await fetchBackups();
        setStatusMsg('Cuenta de Google enlazada correctamente.');
        setTimeout(() => setStatusMsg(null), 3500);
      }
    } catch {
      setErrorMsg('No se pudo conectar con Google. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await googleLogout();
    setUser(null);
    setNeedsAuth(true);
    setFiles([]);
  };

  const handleCreateNewBackup = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      triggerHaptic(haptic, 20);
      await createDriveBackup(dbState);
      await fetchBackups();
      setStatusMsg('Nuevo respaldo guardado en tu Google Drive.');
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (err: any) {
      if (err?.message === 'AUTH_REQUIRED') setNeedsAuth(true);
      else setErrorMsg('No se pudo subir el respaldo a Google Drive.');
    } finally {
      setIsLoading(false);
    }
  };

  const executeConfirmedAction = async () => {
    if (!pendingAction) return;
    const { type, file } = pendingAction;
    setPendingAction(null);
    setIsLoading(true);
    setErrorMsg(null);

    try {
      triggerHaptic(haptic, [20, 40]);
      if (type === 'OVERWRITE') {
        await updateDriveBackup(file.id, dbState);
        await fetchBackups();
        setStatusMsg(`Respaldo "${file.name}" actualizado en Google Drive.`);
      } else if (type === 'DELETE') {
        await deleteDriveBackup(file.id);
        await fetchBackups();
        setStatusMsg(`Respaldo "${file.name}" eliminado de Google Drive.`);
      } else if (type === 'RESTORE') {
        const downloaded = await downloadDriveBackup(file.id);
        if (downloaded && Array.isArray(downloaded.categories)) {
          onRestoreBackup(downloaded);
          setStatusMsg(`Datos restaurados desde "${file.name}".`);
        } else {
          setErrorMsg('El archivo de Google Drive no tiene un formato válido.');
        }
      }
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (err: any) {
      if (err?.message === 'AUTH_REQUIRED') setNeedsAuth(true);
      else setErrorMsg('Ocurrió un error al procesar la operación en Google Drive.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center">
            <Cloud className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-stone-900 dark:text-zinc-100">
              Respaldo en la Nube — Google Drive
            </h4>
            <p className="text-[11px] text-stone-500 dark:text-zinc-400">
              Enlaza tu cuenta de Google para respaldar o restaurar tus datos además del almacenamiento local
            </p>
          </div>
        </div>

        {!needsAuth && user && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-stone-600 dark:text-zinc-300 truncate max-w-[180px]">
              {user.email || user.displayName}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 rounded-lg bg-stone-200/70 dark:bg-zinc-800 text-stone-600 dark:text-zinc-300 hover:text-rose-600 text-xs flex items-center gap-1"
              title="Desvincular cuenta de Google"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {statusMsg && (
        <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5">
          <Check className="w-4 h-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {needsAuth ? (
        <div className="pt-1">
          <button
            type="button"
            disabled={isLoading}
            onClick={handleLogin}
            className="gsi-material-button inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-stone-300 dark:border-zinc-700 hover:bg-stone-50 dark:hover:bg-zinc-800 text-stone-800 dark:text-zinc-100 text-xs font-bold shadow-xs transition-all"
          >
            <div className="gsi-material-button-icon w-4 h-4 shrink-0">
              <svg
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                className="w-4 h-4 block"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
                <path fill="none" d="M0 0h48v48H0z" />
              </svg>
            </div>
            <span className="gsi-material-button-contents">
              {isLoading ? 'Conectando con Google...' : 'Sign in with Google (Vincular Google Drive)'}
            </span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={handleCreateNewBackup}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              <CloudUpload className="w-4 h-4" />
              Subir Nuevo Respaldo a Google Drive
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={fetchBackups}
              className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-zinc-300 text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar lista
            </button>
          </div>

          {/* Diálogo de Confirmación Explícita para operaciones mutables/destructivas */}
          {pendingAction && (
            <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border-2 border-amber-500 space-y-2.5 shadow-md">
              <div className="flex items-start gap-2 text-xs font-bold text-stone-900 dark:text-zinc-100">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  {pendingAction.type === 'OVERWRITE' &&
                    `¿Confirmas sobrescribir el archivo "${pendingAction.file.name}" en Google Drive con tus datos actuales?`}
                  {pendingAction.type === 'DELETE' &&
                    `¿Confirmas eliminar permanentemente el archivo "${pendingAction.file.name}" de tu Google Drive?`}
                  {pendingAction.type === 'RESTORE' &&
                    `¿Confirmas restaurar los datos desde "${pendingAction.file.name}"? Esto reemplazará tus registros actuales.`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={executeConfirmedAction}
                  className={`px-3.5 py-1.5 rounded-lg text-white text-xs font-bold ${
                    pendingAction.type === 'DELETE'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-700 hover:bg-emerald-800'
                  }`}
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setPendingAction(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 text-xs font-bold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Lista de respaldos en Google Drive */}
          {files.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-zinc-400">
              Aún no tienes respaldos de Gastito 2.0 guardados en tu Google Drive.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {files.map((f) => (
                <div
                  key={f.id}
                  className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-stone-800 dark:text-zinc-200 truncate">
                      {f.name}
                    </p>
                    <p className="text-[10px] text-stone-400 font-mono">
                      Modificado: {new Date(f.modifiedTime).toLocaleString('es-CL')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPendingAction({ type: 'RESTORE', file: f })}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1"
                      title="Restaurar este respaldo"
                    >
                      <CloudDownload className="w-3.5 h-3.5" />
                      Restaurar
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingAction({ type: 'OVERWRITE', file: f })}
                      className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 text-[11px] font-semibold"
                      title="Actualizar este respaldo con los datos actuales"
                    >
                      Actualizar
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingAction({ type: 'DELETE', file: f })}
                      className="p-1 rounded-lg text-stone-400 hover:text-rose-600"
                      title="Eliminar de Google Drive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
