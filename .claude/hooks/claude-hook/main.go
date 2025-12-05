package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

const Version = "1.0.0"

// Event represents the complete event data structure
type Event struct {
	SourceApp      string                 `json:"source_app"`
	SessionID      string                 `json:"session_id"`
	HookEventType  string                 `json:"hook_event_type"`
	Payload        map[string]interface{} `json:"payload"`
	Timestamp      int64                  `json:"timestamp"`
	ModelName      string                 `json:"model_name,omitempty"`
	AgentType      string                 `json:"agent_type"`
	AgentVersion   string                 `json:"agent_version,omitempty"`
	Git            GitContext             `json:"git"`
	Session        SessionContext         `json:"session"`
	Environment    EnvironmentContext     `json:"environment"`
	SessionStats   SessionStats           `json:"sessionStats,omitempty"`
	Tool           *ToolMetadata          `json:"tool,omitempty"`
}

// GitContext contains git repository metadata
type GitContext struct {
	IsGitRepo      bool   `json:"isGitRepo"`
	Branch         string `json:"branch,omitempty"`
	CommitHash     string `json:"commitHash,omitempty"`
	IsDirty        bool   `json:"isDirty"`
	StagedFiles    int    `json:"stagedFiles"`
	UnstagedFiles  int    `json:"unstagedFiles"`
	RemoteBranch   string `json:"remoteBranch,omitempty"`
	CommitsAhead   int    `json:"commitsAhead"`
	CommitsBehind  int    `json:"commitsBehind"`
}

// SessionContext contains session metadata
type SessionContext struct {
	StartTime            string  `json:"startTime"`
	DurationMinutes      float64 `json:"durationMinutes"`
	Model                string  `json:"model"`
	ModelShort           string  `json:"modelShort"`
	WorkingDirectory     string  `json:"workingDirectory"`
	WorkingDirectoryName string  `json:"workingDirectoryName"`
	SessionID            string  `json:"sessionId"`
	ToolCount            int     `json:"toolCount"`
}

// EnvironmentContext contains environment metadata
type EnvironmentContext struct {
	OS            string `json:"os"`
	OSVersion     string `json:"osVersion"`
	Shell         string `json:"shell"`
	User          string `json:"user"`
	PythonVersion string `json:"pythonVersion,omitempty"`
	NodeVersion   string `json:"nodeVersion,omitempty"`
	GoVersion     string `json:"goVersion,omitempty"`
}

// SessionStats contains cumulative session statistics
type SessionStats struct {
	ToolsExecuted    int     `json:"toolsExecuted"`
	FilesRead        int     `json:"filesRead"`
	FilesWritten     int     `json:"filesWritten"`
	FilesEdited      int     `json:"filesEdited"`
	BashCommandsRun  int     `json:"bashCommandsRun"`
	TestsRun         int     `json:"testsRun"`
	TotalToolTimeMs  float64 `json:"totalToolTimeMs"`
	AvgToolTimeMs    float64 `json:"avgToolTimeMs"`
	ErrorCount       int     `json:"errorCount"`
	GrepSearches     int     `json:"grepSearches"`
	GlobSearches     int     `json:"globSearches"`
	SubagentsLaunched int    `json:"subagentsLaunched"`
	WebSearches      int     `json:"webSearches"`
	WebFetches       int     `json:"webFetches"`
}

// ToolMetadata contains tool-specific metadata
type ToolMetadata struct {
	Name       string                 `json:"name"`
	DurationMs *float64               `json:"durationMs,omitempty"`
	Success    bool                   `json:"success"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// SessionState tracks persistent session state
type SessionState struct {
	StartTime string `json:"startTime"`
	ToolCount int    `json:"toolCount"`
}

func main() {
	// Parse flags
	sourceApp := flag.String("source-app", "", "Source application name (required)")
	eventType := flag.String("event-type", "", "Hook event type (required)")
	serverURL := flag.String("server-url", "http://localhost:4000/events", "Server URL")
	agentType := flag.String("agent-type", "claude", "Type of AI agent")
	agentVersion := flag.String("agent-version", "", "Agent CLI version")
	addChat := flag.Bool("add-chat", false, "Include chat transcript")
	summarize := flag.Bool("summarize", false, "Generate AI summary (falls back to Python)")

	flag.Parse()

	if *sourceApp == "" || *eventType == "" {
		fmt.Fprintln(os.Stderr, "Error: --source-app and --event-type are required")
		flag.Usage()
		os.Exit(1)
	}

	// Read input from stdin
	var payload map[string]interface{}
	decoder := json.NewDecoder(os.Stdin)
	if err := decoder.Decode(&payload); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to parse JSON input: %v\n", err)
		os.Exit(1)
	}

	// Get session ID and project directory
	sessionID, _ := payload["session_id"].(string)
	if sessionID == "" {
		sessionID = "unknown"
	}

	projectDir := os.Getenv("CLAUDE_PROJECT_DIR")
	if projectDir == "" {
		projectDir, _ = os.Getwd()
	}

	// Check if --summarize flag is set - fall back to Python
	if *summarize {
		fallbackToPython(payload, *sourceApp, *eventType, *serverURL, *agentType, *agentVersion, *addChat)
		return
	}

	// Extract model name from transcript
	modelName := ""
	if transcriptPath, ok := payload["transcript_path"].(string); ok && transcriptPath != "" {
		modelName = extractModelFromTranscript(transcriptPath)
	}

	// Collect metadata
	gitCtx := getGitContext(projectDir)
	sessionCtx := getSessionContext(sessionID, projectDir)
	envCtx := getEnvironmentContext()

	// Update tool count for PostToolUse
	if *eventType == "PostToolUse" {
		incrementToolCount(sessionID)
	}

	// Get session stats
	sessionStats := getSessionStats(sessionID)

	// Get tool metadata if applicable
	var toolMeta *ToolMetadata
	if toolName, ok := payload["tool_name"].(string); ok && toolName != "" {
		toolMeta = &ToolMetadata{
			Name:     toolName,
			Success:  true,
			Metadata: make(map[string]interface{}),
		}

		// For PostToolUse, try to read duration from temp file
		if *eventType == "PostToolUse" {
			if duration := readToolDuration(sessionID, toolName); duration != nil {
				toolMeta.DurationMs = duration

				// Update session stats
				updateSessionStats(sessionID, toolName, *duration, payload)
			}
		}
	}

	// Build event
	event := Event{
		SourceApp:     *sourceApp,
		SessionID:     sessionID,
		HookEventType: *eventType,
		Payload:       payload,
		Timestamp:     time.Now().UnixMilli(),
		ModelName:     modelName,
		AgentType:     *agentType,
		Git:           gitCtx,
		Session:       sessionCtx,
		Environment:   envCtx,
		SessionStats:  sessionStats,
		Tool:          toolMeta,
	}

	if *agentVersion != "" {
		event.AgentVersion = *agentVersion
	}

	// Add chat transcript if requested
	if *addChat {
		if transcriptPath, ok := payload["transcript_path"].(string); ok && transcriptPath != "" {
			if chat := readChatTranscript(transcriptPath); chat != nil {
				event.Payload["chat"] = chat
			}
		}
	}

	// Send event to server
	if !sendEventToServer(event, *serverURL) {
		// Queue for later if send failed
		queueEvent(event, projectDir)
	} else {
		// Try to flush queue on successful send
		flushQueue(*serverURL, projectDir)
	}

	// Always exit 0 to not block Claude Code
	os.Exit(0)
}

func getGitContext(projectDir string) GitContext {
	ctx := GitContext{
		IsGitRepo: false,
	}

	// Check if git repo
	cmd := exec.Command("git", "rev-parse", "--git-dir")
	cmd.Dir = projectDir
	if err := cmd.Run(); err != nil {
		return ctx
	}

	ctx.IsGitRepo = true

	// Get branch
	if output, err := exec.Command("git", "-C", projectDir, "rev-parse", "--abbrev-ref", "HEAD").Output(); err == nil {
		ctx.Branch = strings.TrimSpace(string(output))
	}

	// Get commit hash
	if output, err := exec.Command("git", "-C", projectDir, "rev-parse", "--short", "HEAD").Output(); err == nil {
		ctx.CommitHash = strings.TrimSpace(string(output))
	}

	// Get status
	if output, err := exec.Command("git", "-C", projectDir, "status", "--porcelain").Output(); err == nil {
		status := string(output)
		ctx.IsDirty = len(strings.TrimSpace(status)) > 0

		// Count staged/unstaged
		for _, line := range strings.Split(status, "\n") {
			if len(line) < 2 {
				continue
			}
			if strings.HasPrefix(line, "M ") || strings.HasPrefix(line, "A ") || strings.HasPrefix(line, "D ") {
				ctx.StagedFiles++
			}
			if len(line) > 1 && line[1] == 'M' {
				ctx.UnstagedFiles++
			}
		}
	}

	// Get remote branch
	if output, err := exec.Command("git", "-C", projectDir, "rev-parse", "--abbrev-ref", "@{upstream}").Output(); err == nil {
		ctx.RemoteBranch = strings.TrimSpace(string(output))
	}

	// Get ahead/behind
	if ctx.RemoteBranch != "" {
		if output, err := exec.Command("git", "-C", projectDir, "rev-list", "--left-right", "--count", "HEAD...@{upstream}").Output(); err == nil {
			parts := strings.Fields(strings.TrimSpace(string(output)))
			if len(parts) == 2 {
				fmt.Sscanf(parts[0], "%d", &ctx.CommitsAhead)
				fmt.Sscanf(parts[1], "%d", &ctx.CommitsBehind)
			}
		}
	}

	return ctx
}

func getSessionContext(sessionID, projectDir string) SessionContext {
	state := loadSessionState(sessionID)

	// Calculate duration
	startTime, _ := time.Parse(time.RFC3339, state.StartTime)
	duration := time.Since(startTime).Minutes()

	// Get model from environment
	model := os.Getenv("CLAUDE_MODEL")
	if model == "" {
		model = "unknown"
	}

	modelShort := model
	modelLower := strings.ToLower(model)
	if strings.Contains(modelLower, "sonnet") {
		modelShort = "Sonnet 4.5"
	} else if strings.Contains(modelLower, "opus") {
		modelShort = "Opus"
	} else if strings.Contains(modelLower, "haiku") {
		modelShort = "Haiku"
	}

	return SessionContext{
		StartTime:            state.StartTime,
		DurationMinutes:      float64(int(duration*10)) / 10, // Round to 1 decimal
		Model:                model,
		ModelShort:           modelShort,
		WorkingDirectory:     projectDir,
		WorkingDirectoryName: filepath.Base(projectDir),
		SessionID:            sessionID,
		ToolCount:            state.ToolCount,
	}
}

func getEnvironmentContext() EnvironmentContext {
	ctx := EnvironmentContext{
		OS:        strings.ToLower(runtime.GOOS),
		OSVersion: getOSVersion(),
		Shell:     filepath.Base(os.Getenv("SHELL")),
		User:      os.Getenv("USER"),
	}

	// Get Python version
	if output, err := exec.Command("python3", "--version").CombinedOutput(); err == nil {
		ctx.PythonVersion = strings.TrimPrefix(strings.TrimSpace(string(output)), "Python ")
	}

	// Get Node version
	if output, err := exec.Command("node", "--version").CombinedOutput(); err == nil {
		ctx.NodeVersion = strings.TrimPrefix(strings.TrimSpace(string(output)), "v")
	}

	// Get Go version
	if output, err := exec.Command("go", "version").CombinedOutput(); err == nil {
		parts := strings.Fields(string(output))
		if len(parts) >= 3 {
			ctx.GoVersion = strings.TrimPrefix(parts[2], "go")
		}
	}

	return ctx
}

func getOSVersion() string {
	switch runtime.GOOS {
	case "darwin":
		if output, err := exec.Command("sw_vers", "-productVersion").Output(); err == nil {
			return strings.TrimSpace(string(output))
		}
	case "linux":
		if output, err := exec.Command("uname", "-r").Output(); err == nil {
			return strings.TrimSpace(string(output))
		}
	}
	return runtime.GOOS
}

func extractModelFromTranscript(transcriptPath string) string {
	data, err := os.ReadFile(transcriptPath)
	if err != nil {
		return ""
	}

	lines := strings.Split(string(data), "\n")
	// Search in reverse for most recent assistant message
	for i := len(lines) - 1; i >= 0; i-- {
		line := strings.TrimSpace(lines[i])
		if line == "" {
			continue
		}

		var entry map[string]interface{}
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			continue
		}

		if entry["type"] == "assistant" {
			if message, ok := entry["message"].(map[string]interface{}); ok {
				if model, ok := message["model"].(string); ok {
					return model
				}
			}
		}
	}

	return ""
}

func readChatTranscript(transcriptPath string) []map[string]interface{} {
	data, err := os.ReadFile(transcriptPath)
	if err != nil {
		return nil
	}

	var chat []map[string]interface{}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		var entry map[string]interface{}
		if err := json.Unmarshal([]byte(line), &entry); err == nil {
			chat = append(chat, entry)
		}
	}

	return chat
}

func readToolDuration(sessionID, toolName string) *float64 {
	logDir := filepath.Join("logs", sessionID)
	durationFile := filepath.Join(logDir, "last_tool_duration.json")

	data, err := os.ReadFile(durationFile)
	if err != nil {
		return nil
	}

	var durData struct {
		ToolName   string  `json:"tool_name"`
		DurationMs float64 `json:"duration_ms"`
	}
	if err := json.Unmarshal(data, &durData); err != nil {
		return nil
	}

	if durData.ToolName == toolName {
		// Delete after reading
		os.Remove(durationFile)
		return &durData.DurationMs
	}

	return nil
}

func sendEventToServer(event Event, serverURL string) bool {
	data, err := json.Marshal(event)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to marshal event: %v\n", err)
		return false
	}

	maxRetries := 3
	for attempt := 0; attempt < maxRetries; attempt++ {
		req, err := http.NewRequest("POST", serverURL, bytes.NewBuffer(data))
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to create request: %v\n", err)
			return false
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "Claude-Code-Hook/"+Version)

		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			if attempt < maxRetries-1 {
				time.Sleep(time.Duration(500*( 1 << attempt)) * time.Millisecond) // Exponential backoff
				continue
			}
			fmt.Fprintf(os.Stderr, "Failed to send event after %d attempts: %v\n", attempt+1, err)
			return false
		}
		defer resp.Body.Close()

		if resp.StatusCode == 200 {
			return true
		}

		fmt.Fprintf(os.Stderr, "Server returned status: %d\n", resp.StatusCode)
		if attempt < maxRetries-1 {
			time.Sleep(time.Duration(500*(1 << attempt)) * time.Millisecond)
		}
	}

	return false
}

func queueEvent(event Event, projectDir string) {
	queueDir := filepath.Join(projectDir, ".claude", "data")
	os.MkdirAll(queueDir, 0755)

	queueFile := filepath.Join(queueDir, "event_queue.jsonl")

	data, err := json.Marshal(event)
	if err != nil {
		return
	}

	f, err := os.OpenFile(queueFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer f.Close()

	f.Write(data)
	f.WriteString("\n")
}

func flushQueue(serverURL, projectDir string) {
	queueFile := filepath.Join(projectDir, ".claude", "data", "event_queue.jsonl")

	data, err := os.ReadFile(queueFile)
	if err != nil {
		return
	}

	lines := strings.Split(string(data), "\n")
	var remaining []string

	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}

		var event Event
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			continue
		}

		if !sendEventToServer(event, serverURL) {
			remaining = append(remaining, line)
		}
	}

	// Rewrite queue with remaining events
	if len(remaining) == 0 {
		os.Remove(queueFile)
	} else {
		os.WriteFile(queueFile, []byte(strings.Join(remaining, "\n")+"\n"), 0644)
	}
}

func getStateFile() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".claude-observability-state.json")
}

func loadSessionState(sessionID string) SessionState {
	stateFile := getStateFile()

	var allState map[string]SessionState
	data, err := os.ReadFile(stateFile)
	if err == nil {
		json.Unmarshal(data, &allState)
	}

	if allState == nil {
		allState = make(map[string]SessionState)
	}

	sessionKey := "session_" + sessionID
	if state, ok := allState[sessionKey]; ok {
		return state
	}

	// Initialize new session
	newState := SessionState{
		StartTime: time.Now().UTC().Format(time.RFC3339),
		ToolCount: 0,
	}
	allState[sessionKey] = newState
	saveState(allState)

	return newState
}

func incrementToolCount(sessionID string) {
	stateFile := getStateFile()

	var allState map[string]SessionState
	data, err := os.ReadFile(stateFile)
	if err == nil {
		json.Unmarshal(data, &allState)
	}

	if allState == nil {
		allState = make(map[string]SessionState)
	}

	sessionKey := "session_" + sessionID
	state := allState[sessionKey]
	state.ToolCount++
	allState[sessionKey] = state

	saveState(allState)
}

func saveState(allState map[string]SessionState) {
	data, _ := json.Marshal(allState)
	os.WriteFile(getStateFile(), data, 0644)
}

func getSessionStats(sessionID string) SessionStats {
	// Placeholder - full stats tracking would require more complex state management
	// For now, return empty stats
	return SessionStats{}
}

func updateSessionStats(sessionID, toolName string, durationMs float64, payload map[string]interface{}) {
	// Placeholder for session stats update
	// Would track cumulative stats in state file
}

func fallbackToPython(payload map[string]interface{}, sourceApp, eventType, serverURL, agentType, agentVersion string, addChat bool) {
	// Re-encode payload and pipe to Python script
	data, _ := json.Marshal(payload)

	scriptPath := filepath.Join(filepath.Dir(os.Args[0]), "..", "send_event.py")

	args := []string{
		scriptPath,
		"--source-app", sourceApp,
		"--event-type", eventType,
		"--server-url", serverURL,
		"--agent-type", agentType,
		"--summarize",
	}

	if agentVersion != "" {
		args = append(args, "--agent-version", agentVersion)
	}

	if addChat {
		args = append(args, "--add-chat")
	}

	cmd := exec.Command("uv", append([]string{"run", "--script"}, args...)...)
	cmd.Stdin = bytes.NewReader(data)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	cmd.Run()
	os.Exit(0)
}
