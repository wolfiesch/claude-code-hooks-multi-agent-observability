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
