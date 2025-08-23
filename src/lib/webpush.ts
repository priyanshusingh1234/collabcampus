// Client helpers for Web Push subscription management using the existing service worker
// Stores subscription in Firestore under users/{uid}/pushSubs
import { db } from '@/lib/firebase';
import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';

export type PushSubscriptionRecord = {
  endpoint: string;
  p256dh?: string;
  auth?: string;
  createdAt?: any;
};

// Request Notification permission and subscribe via service worker
export async function subscribeToPush(vapidPublicKeyBase64Url: string): Promise<PushSubscription | null> {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return null;
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKeyBase64Url);
  return await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return true;
  return await sub.unsubscribe();
}

export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function saveSubscription(uid: string, sub: PushSubscription) {
  const json = sub.toJSON() as any;
  const endpoint: string = json.endpoint;
  const p256dh: string | undefined = json.keys?.p256dh;
  const auth: string | undefined = json.keys?.auth;
  // de-dup by endpoint
  const q = query(collection(db, 'users', uid, 'pushSubs'), where('endpoint', '==', endpoint));
  const snap = await getDocs(q);
  if (!snap.empty) return; // already stored
  await addDoc(collection(db, 'users', uid, 'pushSubs'), { endpoint, p256dh, auth, createdAt: new Date() });
}

export async function removeSubscription(uid: string, endpoint: string) {
  const q = query(collection(db, 'users', uid, 'pushSubs'), where('endpoint', '==', endpoint));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'users', uid, 'pushSubs', d.id))));
}