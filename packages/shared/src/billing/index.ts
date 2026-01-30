// Billing Plans and Limits
export const BILLING_PLANS = {
  free: {
    name: "Free",
    price: 0,
    priceYearly: 0,
    limits: {
      interactions: 500,
      replays: 100,
      storageGb: 1,
      teamMembers: 2,
    },
    features: [
      "500 interactions/month",
      "100 session replays",
      "1 GB storage",
      "2 team members",
      "7-day data retention",
      "Email support",
    ],
  },
  pro: {
    name: "Pro",
    price: 49,
    priceYearly: 470, // ~20% discount
    limits: {
      interactions: 10000,
      replays: 1000,
      storageGb: 10,
      teamMembers: 10,
    },
    features: [
      "10,000 interactions/month",
      "1,000 session replays",
      "10 GB storage",
      "10 team members",
      "365-day data retention",
      "Priority support",
      "Custom integrations",
      "Advanced analytics",
    ],
  },
} as const;

// Use 'free' | 'pro' to match the Prisma enum
export type BillingPlanKey = keyof typeof BILLING_PLANS;

export interface PlanLimits {
  interactions: number;
  replays: number;
  storageGb: number;
  teamMembers: number;
}

export interface UsageData {
  interactions: number;
  replays: number;
  storageBytes: number;
  teamMembers: number;
}

export function getPlanLimits(plan: BillingPlanKey): PlanLimits {
  return BILLING_PLANS[plan].limits;
}

export function isWithinLimit(
  usage: UsageData,
  plan: BillingPlanKey,
  metric: keyof PlanLimits
): boolean {
  const limits = getPlanLimits(plan);
  switch (metric) {
    case "interactions":
      return usage.interactions < limits.interactions;
    case "replays":
      return usage.replays < limits.replays;
    case "storageGb":
      return usage.storageBytes < limits.storageGb * 1024 * 1024 * 1024;
    case "teamMembers":
      return usage.teamMembers < limits.teamMembers;
    default:
      return true;
  }
}

export function getUsagePercentage(
  usage: UsageData,
  plan: BillingPlanKey,
  metric: keyof PlanLimits
): number {
  const limits = getPlanLimits(plan);
  switch (metric) {
    case "interactions":
      return Math.min(100, (usage.interactions / limits.interactions) * 100);
    case "replays":
      return Math.min(100, (usage.replays / limits.replays) * 100);
    case "storageGb":
      const storageGb = usage.storageBytes / (1024 * 1024 * 1024);
      return Math.min(100, (storageGb / limits.storageGb) * 100);
    case "teamMembers":
      return Math.min(100, (usage.teamMembers / limits.teamMembers) * 100);
    default:
      return 0;
  }
}

export function formatUsage(
  usage: UsageData,
  plan: BillingPlanKey,
  metric: keyof PlanLimits
): string {
  const limits = getPlanLimits(plan);
  switch (metric) {
    case "interactions":
      return `${usage.interactions.toLocaleString()} / ${limits.interactions.toLocaleString()}`;
    case "replays":
      return `${usage.replays.toLocaleString()} / ${limits.replays.toLocaleString()}`;
    case "storageGb":
      const storageGb = usage.storageBytes / (1024 * 1024 * 1024);
      return `${storageGb.toFixed(1)} GB / ${limits.storageGb} GB`;
    case "teamMembers":
      return `${usage.teamMembers} / ${limits.teamMembers}`;
    default:
      return "";
  }
}
