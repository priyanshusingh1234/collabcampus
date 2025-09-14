"use client";
import React from 'react';
import { isPremium } from '@/lib/premium';

interface IfPremiumProps {
  user: any;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// Usage: <IfPremium user={currentUserProfile} fallback={<UpgradeCTA />}> ...premium stuff... </IfPremium>
export function IfPremium({ user, children, fallback = null }: IfPremiumProps) {
  if (!isPremium(user)) return <>{fallback}</>;
  return <>{children}</>;
}

export default IfPremium;
