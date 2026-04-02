package v1

import (
	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

func ListSubscriptionPlans(c echo.Context) error {
	plans, err := model.ListActiveSubscriptionPlans()
	if err != nil {
		return util.InternalError(c, "failed to list plans")
	}
	return util.Success(c, plans)
}

func ListCreditPacks(c echo.Context) error {
	packs, err := model.ListActiveCreditPacks()
	if err != nil {
		return util.InternalError(c, "failed to list credit packs")
	}
	return util.Success(c, packs)
}

func GetMySubscription(c echo.Context) error {
	claims := middleware.GetUserClaimsFromContext(c)
	if claims == nil {
		return util.Unauthorized(c, "not authenticated")
	}
	sub, err := model.GetOrCreateUserSubscription(claims.UserID)
	if err != nil {
		return util.InternalError(c, "failed to get subscription")
	}
	var plan *model.SubscriptionPlan
	if sub.PlanID != nil {
		plan, _ = model.GetSubscriptionPlanByID(*sub.PlanID)
	}
	return util.Success(c, map[string]interface{}{
		"plan":               plan,
		"status":             sub.Status,
		"credits_balance":    sub.CreditsBalance,
		"bonus_credits":      sub.BonusCredits,
		"current_period_end": sub.CurrentPeriodEnd,
	})
}
