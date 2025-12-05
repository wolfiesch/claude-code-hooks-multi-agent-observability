# Native Go Summarization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement native LLM summarization in Go with multi-provider support (OpenAI primary, Anthropic secondary), eliminating the Python fallback dependency for `--summarize` flag.

**Architecture:** Interface-based design with provider auto-selection based on available API keys. Direct HTTP calls using Go stdlib only. Graceful degradation - if no API key or summarization fails, events still send without summary.

**Tech Stack:** Go 1.21+, stdlib only (`net/http`, `encoding/json`), OpenAI Chat Completions API, Anthropic Messages API

---

## Performance Targets (Senior Go Engineer Perspective)

| Metric | Target | Rationale |
|--------|--------|-----------|
| Cold start latency | <5ms | First API call setup |
| Summarization timeout | 2s | Fast fail, don't block hooks |
| Event send latency | <50ms | With or without summary |
| Memory allocation | <1KB per call | Minimize GC pressure |
| Binary size increase | <50KB | Minimal stdlib additions |

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           claude-hook binary                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  main.go                         summarizer.go                           │
│  ┌──────────────────┐           ┌────────────────────────────────────┐  │
│  │ Parse flags      │           │ type Summarizer interface {        │  │
│  │ Read stdin       │           │   Summarize(event, payload) string │  │
│  │ Collect metadata │           │ }                                  │  │
│  │                  │           │                                    │  │
│  │ if --summarize:  │           │ ┌─────────────┐  ┌──────────────┐  │  │
│  │   client :=      │──────────▶│ │OpenAIClient │  │AnthropicClient│ │  │
│  │   NewSummarizer()│           │ │ (PRIMARY)   │  │ (SECONDARY)  │  │  │
│  │   summary :=     │           │ └─────────────┘  └──────────────┘  │  │
│  │   client.Sum()   │           │                                    │  │
│  │                  │           │ NewSummarizer() → auto-selects     │  │
│  │ Send event       │           │   1. OPENAI_API_KEY → OpenAI       │  │
│  └──────────────────┘           │   2. ANTHROPIC_API_KEY → Anthropic │  │
│                                 │   3. nil (graceful skip)           │  │
│                                 └────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Provider Priority

1. **OpenAI** (Primary) - Check `OPENAI_API_KEY` first
   - Model: `gpt-4o-mini` (fastest, cheapest)
   - Endpoint: `https://api.openai.com/v1/chat/completions`

2. **Anthropic** (Secondary) - Fallback to `ANTHROPIC_API_KEY`
   - Model: `claude-haiku-4-5-20251001` (fastest Anthropic)
   - Endpoint: `https://api.anthropic.com/v1/messages`

3. **None** - No API key → silent skip, event sent without summary

## Key Design Decisions

1. **Interface-based abstraction** - `Summarizer` interface for provider flexibility
2. **Auto-selection factory** - `NewSummarizer()` picks provider based on env vars
3. **Sync summarization** - Simpler, summary included in same event
4. **2-second hard timeout** - Fast fail prevents hook blocking
5. **Graceful degradation** - No API key or failure → still send event

---

## Task 1: Define Summarizer Interface and Types

**Files:**
- Create: `.claude/hooks/claude-hook/summarizer.go`
- Test: `.claude/hooks/claude-hook/summarizer_test.go`

**Step 1: Write the failing test for interface and factory**

```go
// summarizer_test.go
package main

import (
	"os"
	"testing"
)

func TestNewSummarizer_OpenAIPrimary(t *testing.T) {
	// OpenAI should be selected when both keys present
	os.Setenv("OPENAI_API_KEY", "openai-test-key")
	os.Setenv("ANTHROPIC_API_KEY", "anthropic-test-key")
	defer func() {
		os.Unsetenv("OPENAI_API_KEY")
		os.Unsetenv("ANTHROPIC_API_KEY")
	}()

	summarizer := NewSummarizer()
	if summarizer == nil {
		t.Fatal("Expected summarizer, got nil")
	}

	// Verify it's OpenAI client
	_, isOpenAI := summarizer.(*OpenAIClient)
	if !isOpenAI {
		t.Error("Expected OpenAI client when both keys present")
	}
}

func TestNewSummarizer_AnthropicFallback(t *testing.T) {
	// Anthropic should be selected when only Anthropic key present
	os.Unsetenv("OPENAI_API_KEY")
	os.Setenv("ANTHROPIC_API_KEY", "anthropic-test-key")
	defer os.Unsetenv("ANTHROPIC_API_KEY")

	summarizer := NewSummarizer()
	if summarizer == nil {
		t.Fatal("Expected summarizer, got nil")
	}

	_, isAnthropic := summarizer.(*AnthropicClient)
	if !isAnthropic {
		t.Error("Expected Anthropic client when only Anthropic key present")
	}
}

func TestNewSummarizer_NoKeys(t *testing.T) {
	os.Unsetenv("OPENAI_API_KEY")
	os.Unsetenv("ANTHROPIC_API_KEY")

	summarizer := NewSummarizer()
	if summarizer != nil {
		t.Error("Expected nil when no API keys, got non-nil")
	}
}
```

**Step 2: Run test to verify it fails**

Run: `cd .claude/hooks/claude-hook && go test -v -run TestNewSummarizer`
Expected: FAIL with "undefined: NewSummarizer"

**Step 3: Write interface, types, and factory**

```go
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
```

**Step 4: Run test to verify it passes**

Run: `cd .claude/hooks/claude-hook && go test -v -run TestNewSummarizer`
Expected: FAIL - need to implement OpenAIClient and AnthropicClient first (Task 2 & 3)

**Step 5: Commit (partial - interface defined)**

```bash
cd .claude/hooks/claude-hook
git add summarizer.go summarizer_test.go
git commit -m "feat(summarizer): define Summarizer interface and factory pattern"
```

---

## Task 2: Implement OpenAI Client (Primary Provider)

**Files:**
- Modify: `.claude/hooks/claude-hook/summarizer.go`
- Test: `.claude/hooks/claude-hook/summarizer_test.go`

**Step 1: Write tests for OpenAI client**

```go
// Add to summarizer_test.go
import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"time"
)

func TestOpenAIClient_Summarize_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request
		if r.Header.Get("Authorization") != "Bearer test-openai-key" {
			t.Error("Missing or incorrect Authorization header")
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Error("Missing Content-Type header")
		}

		// Verify request body structure
		var req OpenAIRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Errorf("Failed to decode request: %v", err)
		}
		if req.Model != "gpt-4o-mini" {
			t.Errorf("Expected model gpt-4o-mini, got %s", req.Model)
		}

		// Return mock response
		resp := OpenAIResponse{
			Choices: []OpenAIChoice{
				{Message: OpenAIMessage{Content: "Reads config file from project root"}},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := &OpenAIClient{
		apiKey:     "test-openai-key",
		apiURL:     server.URL,
		httpClient: &http.Client{Timeout: 2 * time.Second},
	}

	summary, err := client.Summarize("PostToolUse", map[string]interface{}{
		"tool_name": "Read",
	})

	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if summary != "Reads config file from project root" {
		t.Errorf("Expected summary 'Reads config file from project root', got '%s'", summary)
	}
}

func TestOpenAIClient_Provider(t *testing.T) {
	client := &OpenAIClient{}
	if client.Provider() != "openai" {
		t.Errorf("Expected provider 'openai', got '%s'", client.Provider())
	}
}

func TestOpenAIClient_Summarize_Timeout(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(3 * time.Second)
	}))
	defer server.Close()

	client := &OpenAIClient{
		apiKey:     "test-key",
		apiURL:     server.URL,
		httpClient: &http.Client{Timeout: 100 * time.Millisecond},
	}

	_, err := client.Summarize("PostToolUse", map[string]interface{}{})
	if err == nil {
		t.Error("Expected timeout error, got nil")
	}
}
```

**Step 2: Run test to verify it fails**

Run: `cd .claude/hooks/claude-hook && go test -v -run TestOpenAIClient`
Expected: FAIL with "undefined: OpenAIClient"

**Step 3: Implement OpenAI client**

```go
// Add to summarizer.go

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
	Model       string          `json:"model"`
	Messages    []OpenAIMessage `json:"messages"`
	MaxTokens   int             `json:"max_tokens"`
	Temperature float64         `json:"temperature"`
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
	prompt := buildSummaryPrompt(eventType, payload)

	reqBody := OpenAIRequest{
		Model:       openaiModel,
		MaxTokens:   maxTokens,
		Temperature: temperature,
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
```

**Step 4: Run test to verify it passes**

Run: `cd .claude/hooks/claude-hook && go test -v -run TestOpenAIClient`
Expected: PASS

**Step 5: Commit**

```bash
cd .claude/hooks/claude-hook
git add summarizer.go summarizer_test.go
git commit -m "feat(summarizer): implement OpenAI client as primary provider"
```

---

## Task 3: Implement Anthropic Client (Secondary Provider)

**Files:**
- Modify: `.claude/hooks/claude-hook/summarizer.go`
- Test: `.claude/hooks/claude-hook/summarizer_test.go`

**Step 1: Write tests for Anthropic client**

```go
// Add to summarizer_test.go

func TestAnthropicClient_Summarize_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request headers
		if r.Header.Get("x-api-key") != "test-anthropic-key" {
			t.Error("Missing or incorrect x-api-key header")
		}
		if r.Header.Get("anthropic-version") != "2023-06-01" {
			t.Error("Missing or incorrect anthropic-version header")
		}

		// Verify request body
		var req AnthropicRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Errorf("Failed to decode request: %v", err)
		}
		if req.Model != "claude-haiku-4-5-20251001" {
			t.Errorf("Expected claude-haiku model, got %s", req.Model)
		}

		// Return mock response
		resp := AnthropicResponse{
			Content: []AnthropicContentBlock{
				{Type: "text", Text: "Executes npm install command"},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := &AnthropicClient{
		apiKey:     "test-anthropic-key",
		apiURL:     server.URL,
		httpClient: &http.Client{Timeout: 2 * time.Second},
	}

	summary, err := client.Summarize("PostToolUse", map[string]interface{}{
		"tool_name": "Bash",
	})

	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if summary != "Executes npm install command" {
		t.Errorf("Expected summary 'Executes npm install command', got '%s'", summary)
	}
}

func TestAnthropicClient_Provider(t *testing.T) {
	client := &AnthropicClient{}
	if client.Provider() != "anthropic" {
		t.Errorf("Expected provider 'anthropic', got '%s'", client.Provider())
	}
}
```

**Step 2: Run test to verify it fails**

Run: `cd .claude/hooks/claude-hook && go test -v -run TestAnthropicClient`
Expected: FAIL with "undefined: AnthropicClient"

**Step 3: Implement Anthropic client**

```go
// Add to summarizer.go

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
```

**Step 4: Run all tests to verify they pass**

Run: `cd .claude/hooks/claude-hook && go test -v ./...`
Expected: ALL PASS (including NewSummarizer tests from Task 1)

**Step 5: Commit**

```bash
cd .claude/hooks/claude-hook
git add summarizer.go summarizer_test.go
git commit -m "feat(summarizer): implement Anthropic client as secondary provider"
```

---

## Task 4: Integrate Summarizer into Main

**Files:**
- Modify: `.claude/hooks/claude-hook/main.go`

**Step 1: Update Event struct to include Summary and Provider**

```go
// In main.go, update the Event struct
type Event struct {
	SourceApp        string                 `json:"source_app"`
	SessionID        string                 `json:"session_id"`
	HookEventType    string                 `json:"hook_event_type"`
	Payload          map[string]interface{} `json:"payload"`
	Timestamp        int64                  `json:"timestamp"`
	ModelName        string                 `json:"model_name,omitempty"`
	AgentType        string                 `json:"agent_type"`
	AgentVersion     string                 `json:"agent_version,omitempty"`
	Git              GitContext             `json:"git"`
	Session          SessionContext         `json:"session"`
	Environment      EnvironmentContext     `json:"environment"`
	SessionStats     SessionStats           `json:"sessionStats,omitempty"`
	Tool             *ToolMetadata          `json:"tool,omitempty"`
	Summary          string                 `json:"summary,omitempty"`          // AI-generated summary
	SummaryProvider  string                 `json:"summaryProvider,omitempty"`  // Which LLM provider was used
}
```

**Step 2: Replace Python fallback with native summarization**

Find and replace the `--summarize` handling block (around line 142-146):

```go
// OLD CODE (remove this):
// if *summarize {
//     fallbackToPython(payload, *sourceApp, *eventType, *serverURL, *agentType, *agentVersion, *addChat)
//     return
// }

// NEW CODE:
var summary string
var summaryProvider string
if *summarize {
	if client := NewSummarizer(); client != nil {
		summaryProvider = client.Provider()
		var err error
		summary, err = client.Summarize(*eventType, payload)
		if err != nil {
			// Log error but continue - graceful degradation
			fmt.Fprintf(os.Stderr, "[summarizer:%s] error: %v\n", summaryProvider, err)
			summary = ""
		}
	}
	// If no client (no API key), silently skip summarization
}
```

**Step 3: Update event building to include summary fields**

```go
// In the event building section (around line 188):
event := Event{
	SourceApp:       *sourceApp,
	SessionID:       sessionID,
	HookEventType:   *eventType,
	Payload:         payload,
	Timestamp:       time.Now().UnixMilli(),
	ModelName:       modelName,
	AgentType:       *agentType,
	Git:             gitCtx,
	Session:         sessionCtx,
	Environment:     envCtx,
	SessionStats:    sessionStats,
	Tool:            toolMeta,
	Summary:         summary,         // Add this
	SummaryProvider: summaryProvider, // Add this
}
```

**Step 4: Delete the fallbackToPython function**

Remove the entire `fallbackToPython` function (lines 727-757 in current main.go).

**Step 5: Run tests**

Run: `cd .claude/hooks/claude-hook && go test -v ./...`
Expected: PASS

**Step 6: Commit**

```bash
cd .claude/hooks/claude-hook
git add main.go
git commit -m "feat(main): integrate multi-provider summarizer, remove Python fallback"
```

---

## Task 5: Add Performance Logging

**Files:**
- Modify: `.claude/hooks/claude-hook/summarizer.go`

**Step 1: Add timing to Summarize methods**

Update both OpenAI and Anthropic `Summarize` methods to log timing:

```go
// For OpenAIClient.Summarize, add at the start:
func (c *OpenAIClient) Summarize(eventType string, payload map[string]interface{}) (string, error) {
	start := time.Now()
	defer func() {
		fmt.Fprintf(os.Stderr, "[summarizer:openai] latency=%dms\n", time.Since(start).Milliseconds())
	}()
	// ... rest of implementation
}

// For AnthropicClient.Summarize, add at the start:
func (c *AnthropicClient) Summarize(eventType string, payload map[string]interface{}) (string, error) {
	start := time.Now()
	defer func() {
		fmt.Fprintf(os.Stderr, "[summarizer:anthropic] latency=%dms\n", time.Since(start).Milliseconds())
	}()
	// ... rest of implementation
}
```

**Step 2: Run tests**

Run: `cd .claude/hooks/claude-hook && go test -v ./...`
Expected: PASS

**Step 3: Commit**

```bash
cd .claude/hooks/claude-hook
git add summarizer.go
git commit -m "feat(summarizer): add latency metrics logging"
```

---

## Task 6: Build and Test Binary

**Files:**
- Build: `.claude/hooks/claude-hook/claude-hook`

**Step 1: Build the binary**

```bash
cd .claude/hooks/claude-hook
go build -ldflags="-s -w" -o claude-hook .
```

**Step 2: Verify binary size**

```bash
ls -lh claude-hook
# Should be similar size (~8MB)
```

**Step 3: Test without any API key**

```bash
unset OPENAI_API_KEY
unset ANTHROPIC_API_KEY
echo '{"session_id":"test123","tool_name":"Read"}' | ./claude-hook --source-app test --event-type PostToolUse --summarize 2>&1
# Should complete without error, no summary generated
```

**Step 4: Test with OpenAI key (primary)**

```bash
export OPENAI_API_KEY="sk-your-key"
unset ANTHROPIC_API_KEY
echo '{"session_id":"test123","tool_name":"Read","tool_input":{"file_path":"/config.json"}}' | ./claude-hook --source-app test --event-type PostToolUse --summarize 2>&1
# Should show: [summarizer:openai] latency=XXXms
```

**Step 5: Test with Anthropic key only (fallback)**

```bash
unset OPENAI_API_KEY
export ANTHROPIC_API_KEY="sk-ant-your-key"
echo '{"session_id":"test123","tool_name":"Bash"}' | ./claude-hook --source-app test --event-type PostToolUse --summarize 2>&1
# Should show: [summarizer:anthropic] latency=XXXms
```

**Step 6: Commit**

```bash
cd .claude/hooks/claude-hook
git add claude-hook
git commit -m "build: compile binary with multi-provider summarization"
```

---

## Task 7: Deploy to Global Hooks Directory

**Files:**
- Copy: `~/.claude/bin/claude-hook`

**Step 1: Backup existing binary**

```bash
cp ~/.claude/bin/claude-hook ~/.claude/bin/claude-hook.backup.$(date +%Y%m%d_%H%M%S)
```

**Step 2: Copy new binary**

```bash
cp .claude/hooks/claude-hook/claude-hook ~/.claude/bin/claude-hook
chmod +x ~/.claude/bin/claude-hook
```

**Step 3: Verify installation**

```bash
~/.claude/bin/claude-hook --help
```

**Step 4: Test in another repository**

```bash
cd ~/Projects/some-other-repo
export OPENAI_API_KEY="sk-your-key"
echo '{"session_id":"test","tool_name":"Bash"}' | ~/.claude/bin/claude-hook --source-app claude-global --event-type PostToolUse --summarize 2>&1
# Should work with OpenAI
```

**Step 5: Create deployment script**

```bash
cd .claude/hooks/claude-hook
cat > deploy.sh << 'EOF'
#!/bin/bash
set -e

BACKUP_FILE="$HOME/.claude/bin/claude-hook.backup.$(date +%Y%m%d_%H%M%S)"
TARGET="$HOME/.claude/bin/claude-hook"

echo "Backing up existing binary to: $BACKUP_FILE"
cp "$TARGET" "$BACKUP_FILE" 2>/dev/null || true

echo "Deploying new binary to: $TARGET"
cp claude-hook "$TARGET"
chmod +x "$TARGET"

echo "Deployment complete!"
echo "Provider priority: OpenAI > Anthropic"
echo "Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable"
EOF
chmod +x deploy.sh
git add deploy.sh
git commit -m "chore: add deployment script with backup"
```

---

## Task 8: Update Documentation

**Files:**
- Modify: `.claude/hooks/claude-hook/README.md`

**Step 1: Update README with multi-provider info**

Add a section to README.md:

```markdown
## LLM Summarization

The `--summarize` flag enables AI-generated summaries of hook events. The binary supports multiple LLM providers with automatic fallback:

### Provider Priority

1. **OpenAI** (Primary) - Set `OPENAI_API_KEY`
   - Model: `gpt-4o-mini`
   - Fastest, most cost-effective

2. **Anthropic** (Secondary) - Set `ANTHROPIC_API_KEY`
   - Model: `claude-haiku-4-5-20251001`
   - Used when OpenAI key not available

3. **None** - No API key set
   - Summarization silently skipped
   - Events still sent without summary

### Configuration

```bash
# Use OpenAI (recommended)
export OPENAI_API_KEY="sk-..."

# Or use Anthropic
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Performance

- Timeout: 2 seconds (hard limit)
- Typical latency: 100-300ms
- Graceful degradation on failure
```

**Step 2: Commit**

```bash
cd .claude/hooks/claude-hook
git add README.md
git commit -m "docs: add multi-provider summarization documentation"
```

---

## Verification Checklist

After completing all tasks, verify:

- [ ] `go test ./...` passes in `.claude/hooks/claude-hook/`
- [ ] Binary compiles without errors
- [ ] Works without any API key (graceful skip)
- [ ] Works with `OPENAI_API_KEY` only (uses OpenAI)
- [ ] Works with `ANTHROPIC_API_KEY` only (uses Anthropic)
- [ ] Works with both keys (uses OpenAI - primary)
- [ ] Events still send to server with or without summary
- [ ] No Python dependencies required
- [ ] Latency logging shows provider name
- [ ] Binary size is reasonable (<10MB)

---

## Rollback Plan

If issues are discovered:

```bash
# Restore backup binary
cp ~/.claude/bin/claude-hook.backup.YYYYMMDD_HHMMSS ~/.claude/bin/claude-hook

# Or remove --summarize flag from global hooks temporarily
# Edit ~/.claude/settings.json and remove --summarize from hook commands
```

---

## Future Enhancements

1. **Additional providers** - Add Gemini, local Ollama, etc.
2. **Provider override** - `SUMMARIZER_PROVIDER=anthropic` env var
3. **Async summarization** - Fire and forget mode
4. **Summary caching** - Cache similar payloads
5. **Rate limiting** - Skip summarization if quota low
6. **Model override** - `SUMMARIZER_MODEL=gpt-4o` env var
