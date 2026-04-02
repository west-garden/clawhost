package v1

import (
	"time"

	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

func AdminCreatePlan(c echo.Context) error {
	var plan model.SubscriptionPlan
	if err := c.Bind(&plan); err != nil {
		return util.BadRequest(c, "invalid request body")
	}
	if plan.Name == "" || plan.Slug == "" {
		return util.BadRequest(c, "name and slug are required")
	}
	if err := model.CreateSubscriptionPlan(&plan); err != nil {
		return util.InternalError(c, "failed to create plan")
	}
	return util.Success(c, plan)
}

func AdminUpdatePlan(c echo.Context) error {
	id := c.Param("id")
	plan, err := model.GetSubscriptionPlanByID(id)
	if err != nil {
		return util.NotFound(c, "plan not found")
	}
	if err := c.Bind(plan); err != nil {
		return util.BadRequest(c, "invalid request body")
	}
	plan.ID = id
	if err := model.UpdateSubscriptionPlan(plan); err != nil {
		return util.InternalError(c, "failed to update plan")
	}
	return util.Success(c, plan)
}

func AdminCreateCreditPack(c echo.Context) error {
	var pack model.CreditPack
	if err := c.Bind(&pack); err != nil {
		return util.BadRequest(c, "invalid request body")
	}
	if pack.Name == "" || pack.Credits == 0 {
		return util.BadRequest(c, "name and credits are required")
	}
	if err := model.CreateCreditPack(&pack); err != nil {
		return util.InternalError(c, "failed to create credit pack")
	}
	return util.Success(c, pack)
}

func AdminUpdateCreditPack(c echo.Context) error {
	id := c.Param("id")
	var pack model.CreditPack
	if err := util.GetDB().Where("id = ?", id).First(&pack).Error; err != nil {
		return util.NotFound(c, "credit pack not found")
	}
	if err := c.Bind(&pack); err != nil {
		return util.BadRequest(c, "invalid request body")
	}
	pack.ID = id
	if err := model.UpdateCreditPack(&pack); err != nil {
		return util.InternalError(c, "failed to update credit pack")
	}
	return util.Success(c, pack)
}

func AdminGrantSubscription(c echo.Context) error {
	var req struct {
		UserID       string `json:"user_id"`
		PlanSlug     string `json:"plan_slug"`
		Credits      int    `json:"credits"`
		DurationDays int    `json:"duration_days"`
	}
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}
	if req.UserID == "" {
		return util.BadRequest(c, "user_id is required")
	}
	sub, err := model.GetOrCreateUserSubscription(req.UserID)
	if err != nil {
		return util.InternalError(c, "failed to get subscription")
	}
	if req.PlanSlug != "" {
		plan, err := model.GetSubscriptionPlanBySlug(req.PlanSlug)
		if err != nil {
			return util.NotFound(c, "plan not found")
		}
		sub.PlanID = &plan.ID
		sub.Status = "active"
		days := req.DurationDays
		if days == 0 {
			days = 30
		}
		now := time.Now()
		end := now.AddDate(0, 0, days)
		sub.CurrentPeriodStart = &now
		sub.CurrentPeriodEnd = &end
		sub.CreditsBalance += plan.MonthlyCredits
		refID := plan.ID
		model.CreateCreditTransaction(&model.CreditTransaction{
			UserID:       req.UserID,
			Type:         "subscription_grant",
			Amount:       plan.MonthlyCredits,
			BalanceAfter: sub.CreditsBalance,
			Description:  "Subscription grant: " + plan.Name,
			ReferenceID:  &refID,
		})
	}
	if req.Credits > 0 {
		sub.CreditsBalance += req.Credits
		model.CreateCreditTransaction(&model.CreditTransaction{
			UserID:       req.UserID,
			Type:         "admin_adjust",
			Amount:       req.Credits,
			BalanceAfter: sub.CreditsBalance,
			Description:  "Admin credit grant",
		})
	}
	if err := model.UpdateUserSubscription(sub); err != nil {
		return util.InternalError(c, "failed to update subscription")
	}
	return util.Success(c, sub)
}
