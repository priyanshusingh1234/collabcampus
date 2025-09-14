/*
  Backfill missing premium fields for user documents.
  Usage (Node environment with admin credentials):
    ts-node scripts/backfillPremiumFlags.ts

  It will:
    - Add isPremium: false if missing.
    - Normalize legacy role/plan-only "premium" or "pro" values: DOES NOT auto-upgrade; just explicit if isPremium already true or subscription active.
    - Optionally (TODO commented) could remove legacy role/plan markers—left intact for audit.
*/

import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  } else if (process.env.FIREBASE_ADMIN_PRIVATE_KEY && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
  } else {
    console.error('Missing admin credentials. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_ADMIN_* env vars.');
    process.exit(1);
  }
}

async function run() {
  const db = admin.firestore();
  const usersCol = db.collection('users');
  const snap = await usersCol.get();
  console.log(`Scanning ${snap.size} user docs...`);
  let updated = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data() as any;
    const updates: Record<string, any> = {};

    // Ensure isPremium field exists explicitly
    if (typeof data.isPremium === 'undefined') {
      updates.isPremium = false;
    }

    // Ensure subscription shape isn't granting phantom premium without status
    if (data.subscription && typeof data.subscription.status === 'undefined') {
      // Remove empty subscription objects that have no status
      // (Avoid writing null if you prefer to keep for audit)
      // updates.subscription = admin.firestore.FieldValue.delete();
    }

    if (Object.keys(updates).length) {
      await docSnap.ref.update(updates);
      updated++;
    }
  }
  console.log(`Completed. ${updated} user docs updated.`);
}

run().catch((e) => { console.error(e); process.exit(1); });
