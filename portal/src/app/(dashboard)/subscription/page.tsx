import { getSubscriptionPlans, getCreditPacks, getMySubscription } from "@/lib/api";
import { SubscriptionPage } from "@/components/subscription-page";

export default async function SubscriptionRoute() {
  const [plans, packs, subscription] = await Promise.all([
    getSubscriptionPlans(),
    getCreditPacks(),
    getMySubscription().catch(() => null),
  ]);

  return (
    <SubscriptionPage
      plans={plans}
      packs={packs}
      subscription={subscription}
    />
  );
}
