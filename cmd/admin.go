package cmd

import (
	"fmt"
	"log"

	"github.com/clawhost/clawhost/model"
	"github.com/spf13/cobra"
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

		if err := initConfig(); err != nil {
			log.Fatalf("init config failed: %v", err)
		}

		if err := model.PromoteUserToAdmin(email); err != nil {
			log.Fatalf("failed to promote user: %v", err)
		}

		fmt.Printf("User %s promoted to admin\n", email)
	},
}

func init() {
	adminCmd.AddCommand(promoteCmd)
	rootCmd.AddCommand(adminCmd)
}
