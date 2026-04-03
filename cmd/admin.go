package cmd

import (
	"fmt"
	"log"

	"github.com/clawhost/clawhost/model"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var adminCmd = &cobra.Command{
	Use:   "admin",
	Short: "Admin management commands",
}

var promoteCmd = &cobra.Command{
	Use:   "promote [email]",
	Short: "Promote a user to admin role",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		email := args[0]
		token, _ := cmd.Flags().GetString("token")

		if err := initConfig(); err != nil {
			log.Fatalf("init config failed: %v", err)
		}

		// Verify admin token
		adminToken := viper.GetString("api.admin_token")
		if adminToken == "" {
			log.Fatal("api.admin_token not configured")
		}
		if token != adminToken {
			log.Fatal("invalid admin token")
		}

		if err := model.PromoteUserToAdmin(email); err != nil {
			log.Fatalf("failed to promote user: %v", err)
		}

		fmt.Printf("User %s promoted to admin\n", email)
	},
}

var createAdminCmd = &cobra.Command{
	Use:   "create [email]",
	Short: "Create a new admin user",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		email := args[0]
		token, _ := cmd.Flags().GetString("token")
		password, _ := cmd.Flags().GetString("password")
		name, _ := cmd.Flags().GetString("name")

		if password == "" {
			log.Fatal("--password is required")
		}
		if name == "" {
			name = email
		}

		if err := initConfig(); err != nil {
			log.Fatalf("init config failed: %v", err)
		}

		// Verify admin token
		adminToken := viper.GetString("api.admin_token")
		if adminToken == "" {
			log.Fatal("api.admin_token not configured")
		}
		if token != adminToken {
			log.Fatal("invalid admin token")
		}

		// Check if user already exists
		if _, err := model.GetUserByEmail(email); err == nil {
			log.Fatalf("user %s already exists", email)
		}

		user := &model.User{
			Email: email,
			Name:  name,
			Role:  "admin",
		}
		if err := user.SetPassword(password); err != nil {
			log.Fatalf("failed to set password: %v", err)
		}
		if err := model.CreateUser(user); err != nil {
			log.Fatalf("failed to create user: %v", err)
		}

		fmt.Printf("Admin user %s created\n", email)
	},
}

func init() {
	promoteCmd.Flags().String("token", "", "Admin token (required)")
	promoteCmd.MarkFlagRequired("token")
	adminCmd.AddCommand(promoteCmd)

	createAdminCmd.Flags().String("token", "", "Admin token (required)")
	createAdminCmd.Flags().String("password", "", "Password for the new admin (required)")
	createAdminCmd.Flags().String("name", "", "Display name (defaults to email)")
	createAdminCmd.MarkFlagRequired("token")
	createAdminCmd.MarkFlagRequired("password")
	adminCmd.AddCommand(createAdminCmd)

	rootCmd.AddCommand(adminCmd)
}
