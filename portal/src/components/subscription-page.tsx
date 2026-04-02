"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan, CreditPack, UserSubscription } from "@/types";
import { Check, Zap, CreditCard } from "lucide-react";

type Tab = "plans" | "packs";

export function SubscriptionPage({
  plans,
  packs,
  subscription,
}: {
  plans: SubscriptionPlan[];
  packs: CreditPack[];
  subscription: UserSubscription | null;
}) {
  const t = useTranslations("subscription");
  const [activeTab, setActiveTab] = useState<Tab>("plans");

  const currentPlanId = subscription?.plan?.id;
  const isSubscribed = subscription?.status === "active";

  function handlePurchase() {
    toast.info(t("comingSoon"));
  }

  function formatPrice(cents: number): string {
    return `\u00A5${(cents / 100).toFixed(0)}`;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      {/* Status banner */}
      <div className="glass-panel mb-6">
        <div className="p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500/20 to-red-700/20 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {t("currentPlan")}:{" "}
                <span className="text-red-400">
                  {isSubscribed ? subscription.plan?.name : t("freeTier")}
                </span>
              </p>
              {!isSubscribed && (
                <p className="text-xs text-white/40">{t("upgradePrompt")}</p>
              )}
            </div>
          </div>
          {isSubscribed && subscription && (
            <div className="flex items-center gap-4 text-xs text-white/50">
              <span>
                {t("creditsRemaining")}:{" "}
                <span className="text-white font-medium">
                  {subscription.credits_balance.toLocaleString()}
                </span>
              </span>
              {subscription.current_period_end && (
                <span>
                  {t("expiresAt")}:{" "}
                  <span className="text-white/70">
                    {new Date(subscription.current_period_end).toLocaleDateString()}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <h1 className="text-xl font-bold text-white mb-4">{t("title")}</h1>

      {/* Tabs */}
      <div className="flex gap-0 mb-6">
        <button
          onClick={() => setActiveTab("plans")}
          className={cn("view-tab", activeTab === "plans" && "view-tab-active")}
        >
          {t("agentPlans")}
        </button>
        <button
          onClick={() => setActiveTab("packs")}
          className={cn("view-tab", activeTab === "packs" && "view-tab-active")}
        >
          {t("creditPacks")}
        </button>
      </div>

      {/* Plans tab */}
      {activeTab === "plans" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;

            return (
              <div
                key={plan.id}
                className={cn(
                  "pricing-card",
                  isCurrent && "pricing-card-active"
                )}
              >
                <div className="pricing-card-header">
                  <h3 className="text-base font-semibold text-white mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-white/40">{plan.description}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">
                      {formatPrice(plan.price_cents)}
                    </span>
                    <span className="text-sm text-white/40">
                      {t("perMonth")}
                    </span>
                  </div>
                  <button
                    onClick={handlePurchase}
                    disabled={isCurrent}
                    className={cn(
                      "w-full mt-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                      isCurrent
                        ? "bg-white/10 text-white/40 cursor-default"
                        : "bg-gradient-to-r from-red-500 to-red-700 text-white hover:from-red-600 hover:to-red-800"
                    )}
                  >
                    {isCurrent ? t("currentBadge") : t("upgrade")}
                  </button>
                </div>
                <div className="pricing-card-body">
                  <p className="text-[10px] uppercase tracking-widest text-white/30 mb-3">
                    {t("features")}
                  </p>
                  <div className="space-y-0.5">
                    <div className="pricing-card-feature">
                      <Check className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      <span>
                        {plan.monthly_credits.toLocaleString()} {t("credits")}
                      </span>
                    </div>
                    <div className="pricing-card-feature">
                      <Check className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      <span>
                        {plan.agent_limit} {t("agents")}
                      </span>
                    </div>
                    <div className="pricing-card-feature">
                      <Check className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      <span>
                        {t("dailyBonus", {
                          amount: plan.daily_bonus,
                          cap: plan.daily_bonus_cap,
                        })}
                      </span>
                    </div>
                    <div className="pricing-card-feature">
                      <Check className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      <span>{t("topUpAnytime")}</span>
                    </div>
                    {(plan.features as string[])?.map(
                      (feature: string, i: number) => (
                        <div key={i} className="pricing-card-feature">
                          <Check className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Credit packs tab */}
      {activeTab === "packs" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {packs.map((pack) => (
            <div key={pack.id} className="pricing-card">
              <div className="pricing-card-header">
                <h3 className="text-base font-semibold text-white mb-1">
                  +{pack.credits.toLocaleString()} {t("credits")}
                </h3>
                <p className="text-xs text-white/40">{pack.name}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">
                    {formatPrice(pack.price_cents)}
                  </span>
                </div>
                <button
                  onClick={handlePurchase}
                  className="w-full mt-4 py-2.5 rounded-lg text-sm font-medium bg-gradient-to-r from-red-500 to-red-700 text-white hover:from-red-600 hover:to-red-800 transition-all"
                >
                  {t("purchase")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
