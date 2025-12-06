// status-line - Fast Go-based status line generator for Claude Code
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	// ANSI color codes
	colorReset  = "\033[0m"
	colorRed    = "\033[91m"
	colorBlue   = "\033[34m"
	colorCyan   = "\033[36m"
	colorGreen  = "\033[32m"
	colorYellow = "\033[33m"
	colorWhite  = "\033[97m"
	colorGray   = "\033[90m"

	// Configuration
	maxPromptLength = 50
)

// StatusLineInput is the JSON input from Claude Code
type StatusLineInput struct {
	SessionID string `json:"session_id"`
	Model     struct {
		DisplayName string `json:"display_name"`
	} `json:"model"`
}

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

func main() {
	// Read JSON input from stdin
	var input StatusLineInput
	decoder := json.NewDecoder(os.Stdin)
	if err := decoder.Decode(&input); err != nil {
		// On error, output a minimal status line
		fmt.Printf("%s[Claude]%s %sReady%s\n", colorCyan, colorReset, colorGray, colorReset)
		os.Exit(0)
	}

	// Get model name from input
	modelName := input.Model.DisplayName
	if modelName == "" {
		modelName = "Claude"
	}

	// Load global session data
	sessionData, err := loadGlobalSessionData(input.SessionID)
	if err != nil || sessionData == nil {
		// Fallback: minimal status line
		fmt.Printf("%s[%s]%s %s💭 No session data%s\n",
			colorCyan, modelName, colorReset, colorGray, colorReset)
		os.Exit(0)
	}

	// Build status line components
	var parts []string

	// Agent name (red)
	agentName := sessionData.AgentName
	if agentName == "" {
		agentName = "Agent"
	}
	parts = append(parts, fmt.Sprintf("%s[%s]%s", colorRed, agentName, colorReset))

	// Model name (blue)
	parts = append(parts, fmt.Sprintf("%s[%s]%s", colorBlue, modelName, colorReset))

	// Project name (green) - if available
	if sessionData.SourceApp != "" {
		parts = append(parts, fmt.Sprintf("%s📁 %s%s", colorGreen, sessionData.SourceApp, colorReset))
	}

	// Current prompt with icon
	if len(sessionData.Prompts) > 0 {
		currentPrompt := sessionData.Prompts[len(sessionData.Prompts)-1]
		icon := getPromptIcon(currentPrompt)
		truncated := truncatePrompt(currentPrompt, maxPromptLength)
		parts = append(parts, fmt.Sprintf("%s %s%s%s", icon, colorWhite, truncated, colorReset))
	} else {
		parts = append(parts, fmt.Sprintf("%s💭 No prompts yet%s", colorGray, colorReset))
	}

	// Join with separator and output
	fmt.Println(strings.Join(parts, " | "))
	os.Exit(0)
}

// loadGlobalSessionData loads session data from the global store
func loadGlobalSessionData(sessionID string) (*GlobalSessionData, error) {
	if sessionID == "" || sessionID == "unknown" {
		return nil, fmt.Errorf("invalid session ID")
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	sessionFile := filepath.Join(home, ".claude", "data", "sessions", sessionID+".json")
	data, err := os.ReadFile(sessionFile)
	if err != nil {
		return nil, err
	}

	var sessionData GlobalSessionData
	if err := json.Unmarshal(data, &sessionData); err != nil {
		return nil, err
	}

	return &sessionData, nil
}

// getPromptIcon returns an emoji icon based on prompt content
func getPromptIcon(prompt string) string {
	promptLower := strings.ToLower(prompt)

	// Slash command
	if strings.HasPrefix(prompt, "/") {
		return "⚡"
	}

	// Question
	if strings.Contains(prompt, "?") {
		return "❓"
	}

	// Create/build actions
	createWords := []string{"create", "write", "add", "implement", "build", "make", "generate"}
	for _, word := range createWords {
		if strings.Contains(promptLower, word) {
			return "💡"
		}
	}

	// Fix/debug actions
	fixWords := []string{"fix", "debug", "error", "issue", "bug", "problem"}
	for _, word := range fixWords {
		if strings.Contains(promptLower, word) {
			return "🐛"
		}
	}

	// Refactor/improve actions
	refactorWords := []string{"refactor", "improve", "optimize", "clean", "update"}
	for _, word := range refactorWords {
		if strings.Contains(promptLower, word) {
			return "♻️"
		}
	}

	// Test actions
	testWords := []string{"test", "spec", "verify", "check"}
	for _, word := range testWords {
		if strings.Contains(promptLower, word) {
			return "🧪"
		}
	}

	// Default
	return "💬"
}

// truncatePrompt truncates a prompt to the specified length
func truncatePrompt(prompt string, maxLength int) string {
	// Remove newlines and excessive whitespace
	prompt = strings.Join(strings.Fields(prompt), " ")

	if len(prompt) > maxLength {
		return prompt[:maxLength-3] + "..."
	}
	return prompt
}
