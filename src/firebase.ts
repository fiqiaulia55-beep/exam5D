import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const firestoreDatabaseId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
export const db = firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
export const auth = getAuth(app);

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/forms.body.readonly',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
] as const;

function createGoogleProvider(
  includeWorkspaceScopes: boolean,
  loginHint?: string | null
): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  if (includeWorkspaceScopes) {
    for (const scope of WORKSPACE_SCOPES) {
      provider.addScope(scope);
    }
  }
  const params: Record<string, string> = {
    prompt: 'select_account',
  };
  if (loginHint) {
    params.login_hint = loginHint;
  }
  provider.setCustomParameters(params);
  return provider;
}

// Store Google Workspace OAuth access token strictly in memory (never localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let pendingSignInPromise: Promise<TeacherGoogleSignInResult> | null = null;

export interface TeacherGoogleSignInResult {
  user: User;
  accessToken: string | null;
  workspaceWarning?: string;
}

export function getWorkspaceAccessToken(): string | null {
  return cachedAccessToken;
}

export function clearWorkspaceAccessToken(): void {
  cachedAccessToken = null;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

function getAuthErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    return String((err as { code?: unknown }).code || '');
  }
  return '';
}

function formatGoogleAuthError(err: unknown): Error {
  const code = getAuthErrorCode(err);
  switch (code) {
    case 'auth/popup-blocked':
      return new Error(
        'Popup login Google diblokir oleh browser. Izinkan pop-up untuk situs ini lalu klik Sign in with Google kembali.'
      );
    case 'auth/popup-closed-by-user':
      return new Error(
        'Jendela login Google ditutup sebelum selesai (atau izin Drive/Form diblokir Google untuk akun Gmail ini). Gunakan tombol "Masuk Gmail / Google (Mode Firebase)" di bawah untuk masuk.'
      );
    case 'auth/cancelled-popup-request':
      return new Error('Permintaan login Google sebelumnya dibatalkan. Silakan coba klik sekali lagi.');
    case 'auth/unauthorized-domain':
      return new Error(
        `Domain (${window.location.hostname}) belum diizinkan pada Firebase Authorized Domains.`
      );
    case 'auth/operation-not-allowed':
      return new Error('Login Google belum diaktifkan pada proyek Firebase Auth.');
    case 'auth/network-request-failed':
      return new Error('Koneksi internet bermasalah saat menghubungi layanan login Google.');
    default: {
      const msg = err instanceof Error ? err.message : 'Login Google gagal.';
      return new Error(code ? `${msg} (${code})` : msg);
    }
  }
}

async function executeGoogleSignIn(
  includeWorkspaceScopes: boolean
): Promise<TeacherGoogleSignInResult> {
  const currentEmail = includeWorkspaceScopes ? auth.currentUser?.email : undefined;
  const provider = createGoogleProvider(includeWorkspaceScopes, currentEmail);

  try {
    // Single synchronous-gesture signInWithPopup prevents browser popup-blocker rejections
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken ?? null;
    return {
      user: result.user,
      accessToken: cachedAccessToken,
      workspaceWarning:
        includeWorkspaceScopes && !cachedAccessToken
          ? 'Login Google berhasil, namun token baca Google Forms/Drive belum tersedia.'
          : undefined,
    };
  } catch (err) {
    throw formatGoogleAuthError(err);
  }
}

export async function signInTeacherWithGoogle(
  includeWorkspaceScopes = true
): Promise<TeacherGoogleSignInResult> {
  if (!pendingSignInPromise) {
    pendingSignInPromise = executeGoogleSignIn(includeWorkspaceScopes).finally(() => {
      pendingSignInPromise = null;
    });
  }
  return pendingSignInPromise;
}

export async function signOutTeacher(): Promise<void> {
  cachedAccessToken = null;
  await signOut(auth);
}

export { onAuthStateChanged };
