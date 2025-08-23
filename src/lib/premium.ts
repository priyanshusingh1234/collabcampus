export const PREMIUM_PRICE = {
  currency: 'INR',
  monthly: 99,
};

// Determine premium from a user-like object (Firestore user doc or merged profile)
// No payments here—this simply trusts flags on the user document.
export function isPremium(user: any): boolean {
  if (!user) return false;
  const role = (user.role || "").toString().toLowerCase();
  const plan = (user.plan || "").toString().toLowerCase();
  const subActive = Boolean(user.subscription?.status === "active");
  return Boolean(
    user.isPremium === true ||
    role === "premium" ||
    role === "pro" ||
    plan === "pro" ||
    subActive
  );
}

// Not used anymore; kept for API compatibility. Returns false by default.
export async function fetchPremiumStatus(): Promise<boolean> {
  return false;
}
