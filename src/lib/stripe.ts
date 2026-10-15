import "server-only";
import Stripe from "stripe";

// Stripe Connect : chaque pharmacie relie son propre compte Stripe (compte Standard,
// KYC géré par Stripe). Les empreintes bancaires et débits de caution (phase 3) se feront
// directement sur le compte de la pharmacie ; la plateforme ne porte jamais l'argent des patients.

const secretKey = process.env.STRIPE_SECRET_KEY;

export const stripe: Stripe | null = secretKey ? new Stripe(secretKey) : null;

export function isStripeConfigured(): boolean {
  return !!stripe;
}

export function stripeMode(): "test" | "live" | null {
  if (!secretKey) return null;
  return secretKey.startsWith("sk_live") ? "live" : "test";
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3100").replace(/\/$/, "");
}

export type ConnectStatus = {
  accountId: string;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsDue: number;
  email: string | null;
  businessName: string | null;
};

// État du compte connecté, lu en direct chez Stripe
export async function getConnectStatus(accountId: string): Promise<ConnectStatus | null> {
  if (!stripe) return null;
  try {
    const a = await stripe.accounts.retrieve(accountId);
    return {
      accountId,
      detailsSubmitted: !!a.details_submitted,
      chargesEnabled: !!a.charges_enabled,
      payoutsEnabled: !!a.payouts_enabled,
      requirementsDue: a.requirements?.currently_due?.length ?? 0,
      email: a.email ?? null,
      businessName: a.business_profile?.name ?? a.settings?.dashboard?.display_name ?? null,
    };
  } catch {
    return null;
  }
}
