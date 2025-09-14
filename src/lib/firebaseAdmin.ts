// Unified Firebase accessor that prefers Admin SDK but gracefully falls back to Web SDK
// so pages/routes that import getAdminDb don't crash in environments without admin creds.
import * as admin from 'firebase-admin';

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

let triedAdminInit = false;
let compatDb: any = null; // Firestore via compat API
let compatAuth: any = null;

function tryInitAdmin() {
  if (triedAdminInit) return admin.apps.length > 0;
  triedAdminInit = true;
  try {
    if (!admin.apps.length) {
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId,
        });
      } else if (process.env.FIREBASE_ADMIN_PRIVATE_KEY && process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: projectId as string,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
            privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
          }),
        });
      }
    }
  } catch {
    // swallow; we'll fallback
  }
  return admin.apps.length > 0;
}

function initClientIfNeeded() {
  if (compatDb) return;
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (!cfg.projectId) {
    throw new Error('Firebase is not configured (missing NEXT_PUBLIC_FIREBASE_PROJECT_ID)');
  }
  // Use compat API to mimic admin-like chainable methods (.collection().where().get())
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const compatApp = require('firebase/compat/app');
  // Ensure firestore/auth side-effects registered
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('firebase/compat/firestore');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('firebase/compat/auth');
  if (!compatApp.apps.length) {
    compatApp.initializeApp(cfg);
  }
  const app = compatApp.app();
  compatDb = app.firestore();
  compatAuth = app.auth();
}

export function getAdminDb() {
  if (tryInitAdmin()) return admin.firestore();
  initClientIfNeeded();
  return compatDb;
}

export function getAdminAuth() {
  if (tryInitAdmin()) return admin.auth();
  initClientIfNeeded();
  return compatAuth;
}
