// summarizer_test.go
package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"
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
