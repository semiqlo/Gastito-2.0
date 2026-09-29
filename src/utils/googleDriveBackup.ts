import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppDatabaseState } from '../domain/models';

export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory only (never in localStorage or sessionStorage).
let cachedAccessToken: string | null = null;

export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se pudo obtener el token de acceso de Google Drive.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Error al iniciar sesión con Google:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const googleLogout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export interface DriveBackupFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

/**
 * Lista los archivos de copia de seguridad de Gastito 2.0 creados por esta app en Google Drive
 */
export async function listDriveBackups(): Promise<DriveBackupFile[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const query = encodeURIComponent(
    "mimeType='application/json' and trashed=false and name contains 'Gastito_2.0_Backup'"
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=15`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 || res.status === 403) {
    cachedAccessToken = null;
    throw new Error('AUTH_REQUIRED');
  }

  if (!res.ok) {
    throw new Error('Error al consultar respaldos en Google Drive.');
  }

  const data = await res.json();
  return (data.files || []) as DriveBackupFile[];
}

/**
 * Crea un nuevo archivo de respaldo en Google Drive
 */
export async function createDriveBackup(
  state: AppDatabaseState
): Promise<DriveBackupFile> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const dateStr = new Date().toISOString().split('T')[0];
  const cleanUser = (state.preferences.userName || 'Usuario')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Gastito_2.0_Backup_${cleanUser}_${dateStr}.json`;

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    description: `Copia de seguridad de Gastito 2.0 (${new Date().toLocaleString('es-CL')})`,
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append(
    'file',
    new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  );

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  if (res.status === 401 || res.status === 403) {
    cachedAccessToken = null;
    throw new Error('AUTH_REQUIRED');
  }

  if (!res.ok) {
    throw new Error('No se pudo subir el respaldo a Google Drive.');
  }

  return (await res.json()) as DriveBackupFile;
}

/**
 * Actualiza (sobrescribe) un archivo de respaldo existente en Google Drive.
 * Debe llamarse únicamente después de que el usuario confirme explícitamente en la UI.
 */
export async function updateDriveBackup(
  fileId: string,
  state: AppDatabaseState
): Promise<DriveBackupFile> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,name,modifiedTime,size`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(state, null, 2),
    }
  );

  if (res.status === 401 || res.status === 403) {
    cachedAccessToken = null;
    throw new Error('AUTH_REQUIRED');
  }

  if (!res.ok) {
    throw new Error('No se pudo actualizar el respaldo en Google Drive.');
  }

  return (await res.json()) as DriveBackupFile;
}

/**
 * Descarga el contenido de un respaldo desde Google Drive
 */
export async function downloadDriveBackup(
  fileId: string
): Promise<AppDatabaseState> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (res.status === 401 || res.status === 403) {
    cachedAccessToken = null;
    throw new Error('AUTH_REQUIRED');
  }

  if (!res.ok) {
    throw new Error('No se pudo descargar el archivo desde Google Drive.');
  }

  return (await res.json()) as AppDatabaseState;
}

/**
 * Elimina un archivo de respaldo de Google Drive.
 * Debe llamarse únicamente después de que el usuario confirme explícitamente en la UI.
 */
export async function deleteDriveBackup(fileId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (res.status === 401 || res.status === 403) {
    cachedAccessToken = null;
    throw new Error('AUTH_REQUIRED');
  }

  if (!res.ok) {
    throw new Error('No se pudo eliminar el respaldo de Google Drive.');
  }
}
