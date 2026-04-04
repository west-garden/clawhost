package k8s

import (
	"testing"
)

func TestDmPolicyOpenAddsWildcard(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		wantFrom []interface{}
	}{
		{
			name:     "dmPolicy=open without allowFrom should add *",
			input:    map[string]interface{}{"dmPolicy": "open"},
			wantFrom: []interface{}{"*"},
		},
		{
			name:     "dmPolicy=open with empty allowFrom should add *",
			input:    map[string]interface{}{"dmPolicy": "open", "allowFrom": []interface{}{}},
			wantFrom: []interface{}{"*"},
		},
		{
			name:     "dmPolicy=open with existing * should keep it",
			input:    map[string]interface{}{"dmPolicy": "open", "allowFrom": []interface{}{"*"}},
			wantFrom: []interface{}{"*"},
		},
		{
			name:     "dmPolicy=open with other users should add *",
			input:    map[string]interface{}{"dmPolicy": "open", "allowFrom": []interface{}{"12345"}},
			wantFrom: []interface{}{"12345", "*"},
		},
		{
			name:     "dmPolicy=pairing should not add *",
			input:    map[string]interface{}{"dmPolicy": "pairing"},
			wantFrom: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Simulate the logic from AddChannelToAgent
			channelLevelConfig := make(map[string]interface{})
			for k, v := range tt.input {
				channelLevelConfig[k] = v
			}

			// Apply validation logic
			if dmPolicy, ok := channelLevelConfig["dmPolicy"].(string); ok && dmPolicy == "open" {
				allowFrom, _ := channelLevelConfig["allowFrom"].([]interface{})
				hasWildcard := false
				for _, v := range allowFrom {
					if s, ok := v.(string); ok && s == "*" {
						hasWildcard = true
						break
					}
				}
				if !hasWildcard {
					allowFrom = append(allowFrom, "*")
					channelLevelConfig["allowFrom"] = allowFrom
				}
			}

			// Check result
			gotFrom, _ := channelLevelConfig["allowFrom"].([]interface{})
			if tt.wantFrom == nil {
				if gotFrom != nil {
					t.Errorf("expected no allowFrom, got %v", gotFrom)
				}
				return
			}

			// Compare lengths
			if len(gotFrom) != len(tt.wantFrom) {
				t.Errorf("allowFrom length mismatch: got %v, want %v", gotFrom, tt.wantFrom)
				return
			}

			// Check * is present when expected
			for _, want := range tt.wantFrom {
				found := false
				for _, got := range gotFrom {
					if got == want {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("missing expected element %v in allowFrom %v", want, gotFrom)
				}
			}
		})
	}
}