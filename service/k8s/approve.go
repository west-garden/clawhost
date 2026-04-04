package k8s

import (
	"context"
	"fmt"
)

// AutoApproveAllPending approves all pending device pairing requests for a bot.
// Uses Gateway WebSocket API for better performance (no CLI process spawn).
func AutoApproveAllPending(ctx context.Context, botID, accessToken string) error {
	// Get devices via Gateway API (faster than CLI)
	result, err := ListAgentDevicesViaGateway(ctx, botID, accessToken)
	if err != nil {
		return fmt.Errorf("failed to list devices: %w", err)
	}

	if len(result.Pending) == 0 {
		return nil
	}

	// Get endpoint for approving
	endpoint, err := GetServiceEndpoint(ctx, botID)
	if err != nil {
		return fmt.Errorf("failed to get service endpoint: %w", err)
	}

	// Create gateway client for approvals
	client, err := NewGatewayClient(ctx, endpoint, accessToken)
	if err != nil {
		return fmt.Errorf("failed to create gateway client: %w", err)
	}
	defer client.Close()

	// Approve each pending device
	for _, req := range result.Pending {
		if err := client.ApprovePairRequest(ctx, req.RequestID); err != nil {
			fmt.Printf("[AutoApprove] Failed to approve %s: %v\n", req.RequestID, err)
			continue
		}
		fmt.Printf("[AutoApprove] Approved device %s (mode: %s, ip: %s)\n", req.DeviceID, req.ClientMode, req.IP)
	}

	return nil
}
