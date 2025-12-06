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
	openaiModel  = "gpt-5-nano-2025-08-07"

	// Anthropic configuration
	anthropicAPIURL     = "https://api.anthropic.com/v1/messages"
	anthropicModel      = "claude-haiku-4-5-20251001"
	anthropicAPIVersion = "2023-06-01"

	// Shared configuration
	summarizeTimeout = 5 * time.Second // GPT-5-nano with minimal reasoning
	maxTokens        = 100             // Sufficient with minimal reasoning effort
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
	// Extract the most relevant fields for summarization based on event type
	summaryPayload := extractRelevantFields(eventType, payload)

	payloadJSON, _ := json.MarshalIndent(summaryPayload, "", "  ")
	payloadStr := string(payloadJSON)
	if len(payloadStr) > 1000 {
		payloadStr = payloadStr[:1000] + "..."
	}

	return fmt.Sprintf(`Summarize what the AI agent is DOING, not the hook system.

Tool/Action: %s
Details:
%s

IMPORTANT: Describe the ACTUAL ACTION being performed (file being read, command being run, search query, etc.)
DO NOT mention hooks, events, settings.json, or the monitoring system itself.

Requirements:
- ONE sentence, under 12 words
- Start with a verb (Reads, Edits, Searches, Runs, Creates, etc.)
- Be specific: include filenames, commands, or search terms
- Present tense, no period at end

Examples:
- Reads main.go to understand hook implementation
- Runs "npm install" to update dependencies
- Searches web for "React hooks documentation"
- Edits settings.json to update PreToolUse config
- Creates new session_data.go file

Summary:`, getActionDescription(eventType, payload), payloadStr)
}

// extractRelevantFields pulls out the most important fields for summarization
func extractRelevantFields(eventType string, payload map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})

	// Always include tool_name if present
	if toolName, ok := payload["tool_name"].(string); ok {
		result["tool"] = toolName
	}

	// Extract tool_input which contains the actual action details
	if toolInput, ok := payload["tool_input"].(map[string]interface{}); ok {
		// For Bash: include command
		if cmd, ok := toolInput["command"].(string); ok {
			// Truncate long commands
			if len(cmd) > 200 {
				cmd = cmd[:200] + "..."
			}
			result["command"] = cmd
		}
		// For Read/Write/Edit: include file_path
		if path, ok := toolInput["file_path"].(string); ok {
			result["file"] = path
		}
		// For Grep/Glob: include pattern
		if pattern, ok := toolInput["pattern"].(string); ok {
			result["pattern"] = pattern
		}
		// For WebSearch: include query
		if query, ok := toolInput["query"].(string); ok {
			result["query"] = query
		}
		// For WebFetch: include url
		if url, ok := toolInput["url"].(string); ok {
			result["url"] = url
		}
		// For Edit: include old_string snippet
		if oldStr, ok := toolInput["old_string"].(string); ok {
			if len(oldStr) > 100 {
				oldStr = oldStr[:100] + "..."
			}
			result["editing"] = oldStr
		}
	}

	// For UserPromptSubmit: include the prompt
	if prompt, ok := payload["prompt"].(string); ok {
		if len(prompt) > 200 {
			prompt = prompt[:200] + "..."
		}
		result["prompt"] = prompt
	}

	// For Notification: include message
	if message, ok := payload["message"].(string); ok {
		result["message"] = message
	}

	return result
}

// getActionDescription returns a human-readable description of the event type
func getActionDescription(eventType string, payload map[string]interface{}) string {
	if toolName, ok := payload["tool_name"].(string); ok {
		return toolName
	}

	switch eventType {
	case "PreToolUse", "PostToolUse":
		return "Tool execution"
	case "UserPromptSubmit":
		return "User prompt"
	case "Notification":
		return "Notification"
	case "Stop":
		return "Agent response"
	default:
		return eventType
	}
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

// ============================================================================
// OpenAI Client Implementation
// ============================================================================

// OpenAIClient handles communication with OpenAI API
type OpenAIClient struct {
	apiKey     string
	apiURL     string
	httpClient *http.Client
}

// OpenAI API types
type OpenAIRequest struct {
	Model                string            `json:"model"`
	Messages             []OpenAIMessage   `json:"messages"`
	MaxCompletionTokens  int               `json:"max_completion_tokens"`
	ReasoningEffort      string            `json:"reasoning_effort,omitempty"` // "minimal", "low", "medium", "high", or "none"
}

type OpenAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type OpenAIResponse struct {
	Choices []OpenAIChoice `json:"choices"`
	Error   *OpenAIError   `json:"error,omitempty"`
}

type OpenAIChoice struct {
	Message OpenAIMessage `json:"message"`
}

type OpenAIError struct {
	Message string `json:"message"`
	Type    string `json:"type"`
}

// NewOpenAIClient creates a new OpenAI client
func NewOpenAIClient(apiKey string) *OpenAIClient {
	return &OpenAIClient{
		apiKey:     apiKey,
		apiURL:     openaiAPIURL,
		httpClient: newHTTPClient(),
	}
}

// Provider returns the provider name
func (c *OpenAIClient) Provider() string {
	return "openai"
}

// Summarize generates a summary using OpenAI
func (c *OpenAIClient) Summarize(eventType string, payload map[string]interface{}) (string, error) {
	start := time.Now()
	defer func() {
		fmt.Fprintf(os.Stderr, "[summarizer:openai] latency=%dms\n", time.Since(start).Milliseconds())
	}()

	prompt := buildSummaryPrompt(eventType, payload)

	reqBody := OpenAIRequest{
		Model:               openaiModel,
		MaxCompletionTokens: maxTokens,
		ReasoningEffort:     "minimal", // Minimize reasoning tokens, maximize output tokens
		Messages: []OpenAIMessage{
			{Role: "user", Content: prompt},
		},
	}

	reqData, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", c.apiURL, bytes.NewReader(reqData))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	var apiResp OpenAIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	if apiResp.Error != nil {
		return "", fmt.Errorf("API error: %s - %s", apiResp.Error.Type, apiResp.Error.Message)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	if len(apiResp.Choices) == 0 {
		return "", fmt.Errorf("empty response choices")
	}

	return cleanSummary(apiResp.Choices[0].Message.Content), nil
}

// ============================================================================
// Anthropic Client Implementation
// ============================================================================

// AnthropicClient handles communication with Anthropic API
type AnthropicClient struct {
	apiKey     string
	apiURL     string
	httpClient *http.Client
}

// Anthropic API types
type AnthropicRequest struct {
	Model       string             `json:"model"`
	MaxTokens   int                `json:"max_tokens"`
	Temperature float64            `json:"temperature,omitempty"`
	Messages    []AnthropicMessage `json:"messages"`
}

type AnthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type AnthropicResponse struct {
	Content []AnthropicContentBlock `json:"content"`
	Error   *AnthropicError         `json:"error,omitempty"`
}

type AnthropicContentBlock struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type AnthropicError struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

// NewAnthropicClient creates a new Anthropic client
func NewAnthropicClient(apiKey string) *AnthropicClient {
	return &AnthropicClient{
		apiKey:     apiKey,
		apiURL:     anthropicAPIURL,
		httpClient: newHTTPClient(),
	}
}

// Provider returns the provider name
func (c *AnthropicClient) Provider() string {
	return "anthropic"
}

// Summarize generates a summary using Anthropic
func (c *AnthropicClient) Summarize(eventType string, payload map[string]interface{}) (string, error) {
	start := time.Now()
	defer func() {
		fmt.Fprintf(os.Stderr, "[summarizer:anthropic] latency=%dms\n", time.Since(start).Milliseconds())
	}()

	prompt := buildSummaryPrompt(eventType, payload)

	reqBody := AnthropicRequest{
		Model:       anthropicModel,
		MaxTokens:   maxTokens,
		Temperature: temperature,
		Messages: []AnthropicMessage{
			{Role: "user", Content: prompt},
		},
	}

	reqData, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", c.apiURL, bytes.NewReader(reqData))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("anthropic-version", anthropicAPIVersion)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	var apiResp AnthropicResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	if apiResp.Error != nil {
		return "", fmt.Errorf("API error: %s - %s", apiResp.Error.Type, apiResp.Error.Message)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	if len(apiResp.Content) == 0 {
		return "", fmt.Errorf("empty response content")
	}

	return cleanSummary(apiResp.Content[0].Text), nil
}
