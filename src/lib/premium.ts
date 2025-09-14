export const PREMIUM_PRICE = {
  currency: 'INR',
  monthly: 99,
};

// Determine premium from a user-like object (Firestore user doc or merged profile)
// No payments here—this simply trusts flags on the user document.
export function isPremium(user: any): boolean {
  if (!user) return false;
  // Legacy-compatible but stricter: only explicit flag or active subscription.
  // (Removed role/plan heuristics that caused unintended premium exposure.)
  const subActive = user?.subscription?.status === 'active';
  return user.isPremium === true || subActive === true;
}

// Ensure a user object has explicit premium defaults (non-destructive)
export function ensurePremiumDefaults<T extends Record<string, any>>(user: T | null | undefined): T | null | undefined {
  if (!user) return user;
  if (typeof user.isPremium === 'undefined') {
    (user as any).isPremium = false;
  }
  return user;
}

// Not used anymore; kept for API compatibility. Returns false by default.
export async function fetchPremiumStatus(): Promise<boolean> {
  return false;
}
