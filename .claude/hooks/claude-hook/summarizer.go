// summarizer.go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	// OpenAI configuration
	openaiAPIURL = "https://api.openai.com/v1/chat/completions"
	openaiModel  = "gpt-4o-mini"

	// Anthropic configuration
	anthropicAPIURL     = "https://api.anthropic.com/v1/messages"
	anthropicModel      = "claude-haiku-4-5-20251001"
	anthropicAPIVersion = "2023-06-01"

	// Shared configuration
	summarizeTimeout = 2 * time.Second
	maxTokens        = 100
	temperature      = 0.3
)

// Summarizer is the interface for LLM summarization providers
type Summarizer interface {
	Summarize(eventType string, payload map[string]interface{}) (string, error)
	Provider() string
}

// NewSummarizer creates a summarizer based on available API keys
// Priority: OpenAI > Anthropic > nil
func NewSummarizer() Summarizer {
	// Check OpenAI first (primary)
	if apiKey := os.Getenv("OPENAI_API_KEY"); apiKey != "" {
		return NewOpenAIClient(apiKey)
	}

	// Check Anthropic second (fallback)
	if apiKey := os.Getenv("ANTHROPIC_API_KEY"); apiKey != "" {
		return NewAnthropicClient(apiKey)
	}

	// No API key available
	return nil
}

// Shared HTTP client configuration
func newHTTPClient() *http.Client {
	return &http.Client{
		Timeout: summarizeTimeout,
		Transport: &http.Transport{
			MaxIdleConns:       10,
			IdleConnTimeout:    30 * time.Second,
			DisableCompression: true, // JSON is small, skip compression overhead
		},
	}
}

// buildSummaryPrompt creates the prompt for summarization (shared by all providers)
func buildSummaryPrompt(eventType string, payload map[string]interface{}) string {
	// Truncate payload if too large
	payloadJSON, _ := json.MarshalIndent(payload, "", "  ")
	payloadStr := string(payloadJSON)
	if len(payloadStr) > 1000 {
		payloadStr = payloadStr[:1000] + "..."
	}

	return fmt.Sprintf(`Generate a one-sentence summary of this Claude Code hook event payload for an engineer monitoring the system.

Event Type: %s
Payload:
%s

Requirements:
- ONE sentence only (no period at the end)
- Focus on the key action or information in the payload
- Be specific and technical
- Keep under 15 words
- Use present tense
- No quotes or formatting
- Return ONLY the summary text

Examples:
- Reads configuration file from project root
- Executes npm install to update dependencies
- Searches web for React documentation
- Edits database schema to add user table
- Agent responds with implementation plan

Generate the summary:`, eventType, payloadStr)
}

// cleanSummary removes formatting artifacts from the summary
func cleanSummary(s string) string {
	s = strings.TrimSpace(s)
	s = strings.Trim(s, `"'`)
	s = strings.TrimSuffix(s, ".")

	// Take first line only
	if idx := strings.Index(s, "\n"); idx != -1 {
		s = s[:idx]
	}

	// Truncate if too long
	if len(s) > 100 {
		s = s[:97] + "..."
	}

	return s
}
