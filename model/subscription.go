package model

import (
	"time"

	"github.com/clawhost/clawhost/util"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// SubscriptionPlan represents an admin-defined subscription tier.
type SubscriptionPlan struct {
	ID             string         `json:"id" gorm:"primaryKey;type:varchar(36)"`
	Name           string         `json:"name" gorm:"type:varchar(255);not null"`
	Slug           string         `json:"slug" gorm:"type:varchar(100);uniqueIndex;not null"`
	Description    string         `json:"description" gorm:"type:text"`
	PriceCents     int            `json:"price_cents" gorm:"not null"`
	Currency       string         `json:"currency" gorm:"type:varchar(10);default:'cny'"`
	AgentLimit     int            `json:"agent_limit" gorm:"not null"`
	MonthlyCredits int            `json:"monthly_credits" gorm:"not null"`
	DailyBonus     int            `json:"daily_bonus" gorm:"default:200"`
	DailyBonusCap  int            `json:"daily_bonus_cap" gorm:"default:2000"`
	Features       datatypes.JSON `json:"features" gorm:"type:jsonb"`
	SortOrder      int            `json:"sort_order" gorm:"default:0"`
	Active         bool           `json:"active" gorm:"default:true"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

func (SubscriptionPlan) TableName() string {
	return "subscription_plans"
}

func (p *SubscriptionPlan) BeforeCreate(tx *gorm.DB) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	return nil
}

// CreditPack represents a one-time purchasable credit pack.
type CreditPack struct {
	ID         string    `json:"id" gorm:"primaryKey;type:varchar(36)"`
	Name       string    `json:"name" gorm:"type:varchar(255);not null"`
	Credits    int       `json:"credits" gorm:"not null"`
	PriceCents int       `json:"price_cents" gorm:"not null"`
	Currency   string    `json:"currency" gorm:"type:varchar(10);default:'cny'"`
	Active     bool      `json:"active" gorm:"default:true"`
	SortOrder  int       `json:"sort_order" gorm:"default:0"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

func (CreditPack) TableName() string {
	return "credit_packs"
}

func (c *CreditPack) BeforeCreate(tx *gorm.DB) error {
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	return nil
}

// UserSubscription tracks a user's active subscription and credit balance.
type UserSubscription struct {
	ID                   string     `json:"id" gorm:"primaryKey;type:varchar(36)"`
	UserID               string     `json:"user_id" gorm:"type:varchar(36);uniqueIndex;not null"`
	PlanID               *string    `json:"plan_id" gorm:"type:varchar(36)"`
	Status               string     `json:"status" gorm:"type:varchar(50);default:'none'"`
	CreditsBalance       int        `json:"credits_balance" gorm:"default:0"`
	BonusCredits         int        `json:"bonus_credits" gorm:"default:0"`
	CurrentPeriodStart   *time.Time `json:"current_period_start"`
	CurrentPeriodEnd     *time.Time `json:"current_period_end"`
	StripeSubscriptionID *string    `json:"stripe_subscription_id" gorm:"type:varchar(255)"`
	StripeCustomerID     *string    `json:"stripe_customer_id" gorm:"type:varchar(255)"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

func (UserSubscription) TableName() string {
	return "user_subscriptions"
}

func (u *UserSubscription) BeforeCreate(tx *gorm.DB) error {
	if u.ID == "" {
		u.ID = uuid.New().String()
	}
	return nil
}

// CreditTransaction is an audit log entry for credit changes.
type CreditTransaction struct {
	ID           string    `json:"id" gorm:"primaryKey;type:varchar(36)"`
	UserID       string    `json:"user_id" gorm:"type:varchar(36);index;not null"`
	Type         string    `json:"type" gorm:"type:varchar(50);not null"`
	Amount       int       `json:"amount" gorm:"not null"`
	BalanceAfter int       `json:"balance_after" gorm:"not null"`
	Description  string    `json:"description" gorm:"type:text"`
	ReferenceID  *string   `json:"reference_id" gorm:"type:varchar(255)"`
	CreatedAt    time.Time `json:"created_at"`
}

func (CreditTransaction) TableName() string {
	return "credit_transactions"
}

func (c *CreditTransaction) BeforeCreate(tx *gorm.DB) error {
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	return nil
}

// --- SubscriptionPlan DB operations ---

func ListAllSubscriptionPlans() ([]*SubscriptionPlan, error) {
	var plans []*SubscriptionPlan
	if err := util.GetDB().Order("created_at DESC").Find(&plans).Error; err != nil {
		return nil, err
	}
	return plans, nil
}

func ListActiveSubscriptionPlans() ([]*SubscriptionPlan, error) {
	var plans []*SubscriptionPlan
	if err := util.GetDB().Where("active = ?", true).Order("sort_order ASC").Find(&plans).Error; err != nil {
		return nil, err
	}
	return plans, nil
}

func GetSubscriptionPlanByID(id string) (*SubscriptionPlan, error) {
	var plan SubscriptionPlan
	if err := util.GetDB().Where("id = ?", id).First(&plan).Error; err != nil {
		return nil, err
	}
	return &plan, nil
}

func GetSubscriptionPlanBySlug(slug string) (*SubscriptionPlan, error) {
	var plan SubscriptionPlan
	if err := util.GetDB().Where("slug = ?", slug).First(&plan).Error; err != nil {
		return nil, err
	}
	return &plan, nil
}

func CreateSubscriptionPlan(plan *SubscriptionPlan) error {
	return util.GetDB().Create(plan).Error
}

func UpdateSubscriptionPlan(plan *SubscriptionPlan) error {
	return util.GetDB().Save(plan).Error
}

// --- CreditPack DB operations ---

func ListAllCreditPacks() ([]*CreditPack, error) {
	var packs []*CreditPack
	if err := util.GetDB().Order("created_at DESC").Find(&packs).Error; err != nil {
		return nil, err
	}
	return packs, nil
}

func ListActiveCreditPacks() ([]*CreditPack, error) {
	var packs []*CreditPack
	if err := util.GetDB().Where("active = ?", true).Order("sort_order ASC").Find(&packs).Error; err != nil {
		return nil, err
	}
	return packs, nil
}

func CreateCreditPack(pack *CreditPack) error {
	return util.GetDB().Create(pack).Error
}

func UpdateCreditPack(pack *CreditPack) error {
	return util.GetDB().Save(pack).Error
}

// --- UserSubscription DB operations ---

func GetUserSubscription(userID string) (*UserSubscription, error) {
	var sub UserSubscription
	if err := util.GetDB().Where("user_id = ?", userID).First(&sub).Error; err != nil {
		return nil, err
	}
	return &sub, nil
}

func CreateUserSubscription(sub *UserSubscription) error {
	return util.GetDB().Create(sub).Error
}

func UpdateUserSubscription(sub *UserSubscription) error {
	return util.GetDB().Save(sub).Error
}

func GetOrCreateUserSubscription(userID string) (*UserSubscription, error) {
	var sub UserSubscription
	if err := util.GetDB().Where("user_id = ?", userID).First(&sub).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			sub = UserSubscription{
				UserID: userID,
				Status: "none",
			}
			if err := util.GetDB().Create(&sub).Error; err != nil {
				return nil, err
			}
			return &sub, nil
		}
		return nil, err
	}
	return &sub, nil
}

// --- CreditTransaction DB operations ---

func CreateCreditTransaction(tx *CreditTransaction) error {
	return util.GetDB().Create(tx).Error
}

func ListCreditTransactions(userID string, limit int) ([]*CreditTransaction, error) {
	var txns []*CreditTransaction
	if err := util.GetDB().Where("user_id = ?", userID).Order("created_at DESC").Limit(limit).Find(&txns).Error; err != nil {
		return nil, err
	}
	return txns, nil
}

// --- Migration ---

func AutoMigrateSubscription() error {
	db := util.GetDB()
	if err := db.AutoMigrate(&SubscriptionPlan{}, &CreditPack{}, &UserSubscription{}, &CreditTransaction{}); err != nil {
		return err
	}
	return seedSubscriptionData()
}

func seedSubscriptionData() error {
	db := util.GetDB()

	// Seed subscription plans if none exist
	var planCount int64
	if err := db.Model(&SubscriptionPlan{}).Count(&planCount).Error; err != nil {
		return err
	}
	if planCount == 0 {
		plans := []SubscriptionPlan{
			{
				Name:           "基础版",
				Slug:           "basic",
				Description:    "适合个人用户的基础方案",
				PriceCents:     4000,
				Currency:       "cny",
				AgentLimit:     1,
				MonthlyCredits: 2800,
				DailyBonus:     200,
				DailyBonusCap:  2000,
				Features:       datatypes.JSON([]byte(`["搭建日常多步工作流","全自动提升个人效率"]`)),
				SortOrder:      1,
				Active:         true,
			},
			{
				Name:           "专业版",
				Slug:           "pro",
				Description:    "适合专业用户的进阶方案",
				PriceCents:     8000,
				Currency:       "cny",
				AgentLimit:     3,
				MonthlyCredits: 11000,
				DailyBonus:     200,
				DailyBonusCap:  2000,
				Features:       datatypes.JSON([]byte(`["运行复杂批量任务","处理中高频业务自动化需求"]`)),
				SortOrder:      2,
				Active:         true,
			},
			{
				Name:           "旗舰版",
				Slug:           "flagship",
				Description:    "适合企业级用户的旗舰方案",
				PriceCents:     20000,
				Currency:       "cny",
				AgentLimit:     10,
				MonthlyCredits: 37400,
				DailyBonus:     200,
				DailyBonusCap:  2000,
				Features:       datatypes.JSON([]byte(`["部署 7×24 小时高负载工作流","为规模化业务提供无限潜力"]`)),
				SortOrder:      3,
				Active:         true,
			},
		}
		for i := range plans {
			if err := db.Create(&plans[i]).Error; err != nil {
				return err
			}
		}
	}

	// Seed credit packs if none exist
	var packCount int64
	if err := db.Model(&CreditPack{}).Count(&packCount).Error; err != nil {
		return err
	}
	if packCount == 0 {
		packs := []CreditPack{
			{
				Name:       "补充包",
				Credits:    8000,
				PriceCents: 4000,
				Currency:   "cny",
				Active:     true,
				SortOrder:  1,
			},
			{
				Name:       "超值包",
				Credits:    16480,
				PriceCents: 8000,
				Currency:   "cny",
				Active:     true,
				SortOrder:  2,
			},
			{
				Name:       "高频包",
				Credits:    42400,
				PriceCents: 20000,
				Currency:   "cny",
				Active:     true,
				SortOrder:  3,
			},
		}
		for i := range packs {
			if err := db.Create(&packs[i]).Error; err != nil {
				return err
			}
		}
	}

	return nil
}
