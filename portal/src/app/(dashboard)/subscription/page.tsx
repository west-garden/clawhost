import { getSubscriptionPlans, getCreditPacks, getMySubscription } from "@/lib/api";
import { SubscriptionPage } from "@/components/subscription-page";
import type { SubscriptionPlan, CreditPack } from "@/types";

const FALLBACK_PLANS: SubscriptionPlan[] = [
  {
    id: "basic",
    name: "基础版",
    slug: "basic",
    description: "驱动日常自动化工作流",
    price_cents: 4000,
    currency: "cny",
    agent_limit: 1,
    monthly_credits: 2800,
    daily_bonus: 200,
    daily_bonus_cap: 2000,
    features: ["搭建日常多步工作流", "全自动提升个人效率"],
    sort_order: 1,
    active: true,
  },
  {
    id: "pro",
    name: "专业版",
    slug: "pro",
    description: "专为重度用户打造的进阶体验",
    price_cents: 8000,
    currency: "cny",
    agent_limit: 3,
    monthly_credits: 11000,
    daily_bonus: 200,
    daily_bonus_cap: 2000,
    features: ["运行复杂批量任务", "处理中高频业务自动化需求"],
    sort_order: 2,
    active: true,
  },
  {
    id: "flagship",
    name: "旗舰版",
    slug: "flagship",
    description: "满足规模化团队的极限需求",
    price_cents: 20000,
    currency: "cny",
    agent_limit: 10,
    monthly_credits: 37400,
    daily_bonus: 200,
    daily_bonus_cap: 2000,
    features: ["部署 7×24 小时高负载工作流", "为规模化业务提供无限潜力"],
    sort_order: 3,
    active: true,
  },
];

const FALLBACK_PACKS: CreditPack[] = [
  {
    id: "pack-small",
    name: "补充包",
    credits: 8000,
    price_cents: 4000,
    currency: "cny",
    active: true,
    sort_order: 1,
  },
  {
    id: "pack-medium",
    name: "超值包",
    credits: 16480,
    price_cents: 8000,
    currency: "cny",
    active: true,
    sort_order: 2,
  },
  {
    id: "pack-large",
    name: "高频包",
    credits: 42400,
    price_cents: 20000,
    currency: "cny",
    active: true,
    sort_order: 3,
  },
];

export default async function SubscriptionRoute() {
  const [plans, packs, subscription] = await Promise.all([
    getSubscriptionPlans().catch(() => []),
    getCreditPacks().catch(() => []),
    getMySubscription().catch(() => null),
  ]);

  return (
    <SubscriptionPage
      plans={plans.length > 0 ? plans : FALLBACK_PLANS}
      packs={packs.length > 0 ? packs : FALLBACK_PACKS}
      subscription={subscription}
    />
  );
}
