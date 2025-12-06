// session_data.go - Global session data storage for status line support
package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// GlobalSessionData stores session info for the status line
type GlobalSessionData struct {
	SessionID  string   `json:"session_id"`
	AgentName  string   `json:"agent_name,omitempty"`
	Prompts    []string `json:"prompts"`
	Model      string   `json:"model,omitempty"`
	ModelShort string   `json:"model_short,omitempty"`
	ProjectDir string   `json:"project_dir,omitempty"`
	SourceApp  string   `json:"source_app,omitempty"`
}

// globalSessionMutex protects concurrent access to session data file
var globalSessionMutex sync.Mutex

// getGlobalSessionDir returns the path to the global sessions directory
func getGlobalSessionDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".claude", "data", "sessions")
}

// getGlobalSessionFile returns the path to a session's data file
func getGlobalSessionFile(sessionID string) string {
	return filepath.Join(getGlobalSessionDir(), sessionID+".json")
}

// LoadGlobalSessionData loads session data from the global store
func LoadGlobalSessionData(sessionID string) (*GlobalSessionData, error) {
	globalSessionMutex.Lock()
	defer globalSessionMutex.Unlock()

	sessionFile := getGlobalSessionFile(sessionID)
	data, err := os.ReadFile(sessionFile)
	if err != nil {
		if os.IsNotExist(err) {
			// Return empty session data
			return &GlobalSessionData{
				SessionID: sessionID,
				Prompts:   []string{},
			}, nil
		}
		return nil, err
	}

	var sessionData GlobalSessionData
	if err := json.Unmarshal(data, &sessionData); err != nil {
		return nil, err
	}

	return &sessionData, nil
}

// SaveGlobalSessionData saves session data to the global store
func SaveGlobalSessionData(data *GlobalSessionData) error {
	globalSessionMutex.Lock()
	defer globalSessionMutex.Unlock()

	// Ensure directory exists
	sessionDir := getGlobalSessionDir()
	if err := os.MkdirAll(sessionDir, 0755); err != nil {
		return err
	}

	sessionFile := getGlobalSessionFile(data.SessionID)
	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(sessionFile, jsonData, 0644)
}

// UpdateGlobalSessionPrompt adds a prompt to the session and updates metadata
func UpdateGlobalSessionPrompt(sessionID, prompt, sourceApp, projectDir, model string) error {
	data, err := LoadGlobalSessionData(sessionID)
	if err != nil {
		data = &GlobalSessionData{
			SessionID: sessionID,
			Prompts:   []string{},
		}
	}

	// Add the new prompt
	data.Prompts = append(data.Prompts, prompt)

	// Update metadata
	if sourceApp != "" {
		data.SourceApp = sourceApp
	}
	if projectDir != "" {
		data.ProjectDir = projectDir
	}
	if model != "" {
		data.Model = model
		data.ModelShort = getModelShortName(model)
	}

	return SaveGlobalSessionData(data)
}

// SetGlobalSessionAgentName sets the agent name for a session
func SetGlobalSessionAgentName(sessionID, agentName string) error {
	data, err := LoadGlobalSessionData(sessionID)
	if err != nil {
		data = &GlobalSessionData{
			SessionID: sessionID,
			Prompts:   []string{},
		}
	}

	data.AgentName = agentName
	return SaveGlobalSessionData(data)
}

// getModelShortName returns a short display name for the model
func getModelShortName(model string) string {
	modelLower := model
	switch {
	case contains(modelLower, "opus"):
		return "Opus 4.5"
	case contains(modelLower, "sonnet"):
		return "Sonnet 4.5"
	case contains(modelLower, "haiku"):
		return "Haiku"
	default:
		return model
	}
}

// contains checks if s contains substr (case-insensitive)
func contains(s, substr string) bool {
	return len(s) >= len(substr) &&
		(s == substr ||
		 len(s) > len(substr) &&
		 (indexOf(toLower(s), toLower(substr)) >= 0))
}

// generateAndSetAgentName generates an agent name using LLM and stores it
// This runs asynchronously to avoid blocking the hook
func generateAndSetAgentName(sessionID, prompt string) {
	// Check if agent name already exists
	data, err := LoadGlobalSessionData(sessionID)
	if err == nil && data.AgentName != "" {
		return // Already has a name
	}

	// Use the summarizer to generate a name
	client := NewSummarizer()
	if client == nil {
		return // No API key available
	}

	// Create a simple payload for name generation
	namePayload := map[string]interface{}{
		"task": "Generate a single-word agent name (like a code name) for this AI assistant session. The name should be memorable and reflect the type of work being done. Return ONLY the name, nothing else.",
		"context": prompt,
	}

	name, err := client.Summarize("AgentName", namePayload)
	if err != nil {
		return
	}

	// Clean and validate the name
	name = cleanAgentName(name)
	if name == "" {
		return
	}

	// Store the name
	SetGlobalSessionAgentName(sessionID, name)
}

// cleanAgentName sanitizes the generated name
func cleanAgentName(name string) string {
	// Remove any whitespace
	name = strings.TrimSpace(name)

	// Take first word only
	if idx := strings.Index(name, " "); idx != -1 {
		name = name[:idx]
	}

	// Remove non-alphanumeric characters
	var cleaned strings.Builder
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			cleaned.WriteRune(r)
		}
	}

	result := cleaned.String()

	// Validate: must be reasonable length
	if len(result) < 2 || len(result) > 20 {
		return ""
	}

	return result
}

// toLower converts string to lowercase (simple ASCII)
func toLower(s string) string {
	b := []byte(s)
	for i, c := range b {
		if c >= 'A' && c <= 'Z' {
			b[i] = c + 32
		}
	}
	return string(b)
}

// indexOf finds substr in s
func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
