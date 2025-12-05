package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

const VERSION = "1.0.0"

// Configuration constants
var (
	DEBOUNCE_TIMES = map[string]float64{
		"PostToolUse":      3.0,
		"Notification":     2.0,
		"Stop":             0.0,
		"SubagentStop":     5.0,
		"UserPromptSubmit": 0.0,
	}

	PRIORITIES = map[string]int{
		"Notification":  1,
		"Stop":          2,
		"SubagentStop":  3,
		"PostToolUse":   4,
	}
)

// Paths
type Paths struct {
	CacheDir    string
	DBPath      string
	LogFile     string
	DebounceDir string
}

// TelegramConfig holds Telegram bot configuration
type TelegramConfig struct {
	Enabled bool
	Token   string
	ChatID  string
	GroupID string
}

// SessionInfo represents session data from database
type SessionInfo struct {
	CWD                 string
	ToolCount           int
	LastPrompt          string
	NotificationCount   int
}

// HookEvent represents the incoming hook data
type HookEvent struct {
	HookEventName string                 `json:"hook_event_name"`
	SessionID     string                 `json:"session_id"`
	CWD           string                 `json:"cwd"`
	ToolName      string                 `json:"tool_name"`
	Message       string                 `json:"message"`
	Prompt        string                 `json:"prompt"`
	Payload       map[string]interface{} `json:"payload"`
}

// NotificationManager handles all notification logic
type NotificationManager struct {
	db             *sql.DB
	paths          Paths
	telegramConfig TelegramConfig
	logger         *log.Logger
}

func main() {
	paths := initPaths()
	logger := initLogger(paths.LogFile)

	// Read hook data from stdin
	inputData, err := io.ReadAll(os.Stdin)
	if err != nil {
		logger.Printf("Error reading stdin: %v", err)
		return
	}

	if len(inputData) == 0 {
		logger.Println("No input data")
		return
	}

	var event HookEvent
	if err := json.Unmarshal(inputData, &event); err != nil {
		logger.Printf("JSON decode error: %v", err)
		return
	}

	// Initialize notification manager
	nm, err := NewNotificationManager(paths, logger)
	if err != nil {
		logger.Printf("Failed to initialize manager: %v", err)
		return
	}
	defer nm.Close()

	// Handle the event
	if err := nm.HandleEvent(event); err != nil {
		logger.Printf("Error handling event: %v", err)
	}
}

func initPaths() Paths {
	home, _ := os.UserHomeDir()
	cacheDir := filepath.Join(home, ".cache", "unified_notify")
	os.MkdirAll(cacheDir, 0755)

	return Paths{
		CacheDir:    cacheDir,
		DBPath:      filepath.Join(cacheDir, "notifications.db"),
		LogFile:     filepath.Join(home, ".claude", "unified-notify.log"),
		DebounceDir: cacheDir,
	}
}

func initLogger(logFile string) *log.Logger {
	os.MkdirAll(filepath.Dir(logFile), 0755)
	f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Printf("Could not open log file: %v", err)
		return log.New(os.Stderr, "", log.LstdFlags)
	}
	return log.New(f, "", log.LstdFlags)
}

func NewNotificationManager(paths Paths, logger *log.Logger) (*NotificationManager, error) {
	nm := &NotificationManager{
		paths:  paths,
		logger: logger,
	}

	// Initialize database
	if err := nm.initDatabase(); err != nil {
		return nil, fmt.Errorf("database init failed: %w", err)
	}

	// Load Telegram config
	nm.loadTelegramConfig()

	return nm, nil
}

func (nm *NotificationManager) Close() {
	if nm.db != nil {
		nm.db.Close()
	}
}

func (nm *NotificationManager) initDatabase() error {
	db, err := sql.Open("sqlite3", nm.paths.DBPath)
	if err != nil {
		return err
	}
	nm.db = db

	// Create sessions table
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS sessions (
			session_id TEXT PRIMARY KEY,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			last_prompt TEXT,
			cwd TEXT,
			tool_count INTEGER DEFAULT 0,
			notification_count INTEGER DEFAULT 0,
			last_notification_type TEXT,
			last_notification_time DATETIME
		)
	`)
	if err != nil {
		return err
	}

	// Create notifications table
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS notifications (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			session_id TEXT,
			event_type TEXT,
			message TEXT,
			sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			was_batched BOOLEAN DEFAULT 0
		)
	`)
	return err
}

func (nm *NotificationManager) loadTelegramConfig() {
	home, _ := os.UserHomeDir()
	envFile := filepath.Join(home, "Claude-Code-Remote", ".env")

	data, err := os.ReadFile(envFile)
	if err != nil {
		return
	}

	config := TelegramConfig{}
	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		value := strings.Trim(strings.TrimSpace(parts[1]), "\"'")

		switch key {
		case "TELEGRAM_ENABLED":
			config.Enabled = value == "true"
		case "TELEGRAM_BOT_TOKEN":
			config.Token = value
		case "TELEGRAM_CHAT_ID":
			config.ChatID = value
		case "TELEGRAM_GROUP_ID":
			config.GroupID = value
		}
	}

	if config.Enabled {
		nm.telegramConfig = config
		nm.logger.Println("Telegram notifications enabled")
	}
}

func (nm *NotificationManager) shouldDebounce(eventType, sessionID string) bool {
	debounceTime, exists := DEBOUNCE_TIMES[eventType]
	if !exists || debounceTime == 0.0 {
		return false
	}

	debounceFile := filepath.Join(nm.paths.DebounceDir, fmt.Sprintf("debounce_%s_%s", eventType, sessionID))

	data, err := os.ReadFile(debounceFile)
	if err != nil {
		return false
	}

	lastTime, err := strconv.ParseFloat(strings.TrimSpace(string(data)), 64)
	if err != nil {
		return false
	}

	elapsed := time.Now().Unix() - int64(lastTime)
	if float64(elapsed) < debounceTime {
		nm.logger.Printf("Debouncing %s (only %.1fs since last)", eventType, float64(elapsed))
		return true
	}

	return false
}

func (nm *NotificationManager) markNotificationTime(eventType, sessionID string) {
	debounceFile := filepath.Join(nm.paths.DebounceDir, fmt.Sprintf("debounce_%s_%s", eventType, sessionID))
	timestamp := fmt.Sprintf("%d", time.Now().Unix())
	os.WriteFile(debounceFile, []byte(timestamp), 0644)
}

func (nm *NotificationManager) updateSession(sessionID string, event HookEvent) error {
	eventType := event.HookEventName

	if eventType == "UserPromptSubmit" {
		prompt := event.Prompt
		if len(prompt) > 500 {
			prompt = prompt[:500]
		}

		_, err := nm.db.Exec(`
			INSERT INTO sessions (session_id, last_prompt, cwd)
			VALUES (?, ?, ?)
			ON CONFLICT(session_id) DO UPDATE SET
				last_prompt = excluded.last_prompt,
				cwd = excluded.cwd
		`, sessionID, prompt, event.CWD)
		return err
	}

	if eventType == "PostToolUse" {
		_, err := nm.db.Exec(`
			INSERT INTO sessions (session_id, tool_count)
			VALUES (?, 1)
			ON CONFLICT(session_id) DO UPDATE SET
				tool_count = tool_count + 1
		`, sessionID)
		return err
	}

	return nil
}

func (nm *NotificationManager) getSessionInfo(sessionID string) (*SessionInfo, error) {
	var info SessionInfo
	err := nm.db.QueryRow(`
		SELECT COALESCE(cwd, ''), COALESCE(tool_count, 0),
		       COALESCE(last_prompt, ''), COALESCE(notification_count, 0)
		FROM sessions
		WHERE session_id = ?
	`, sessionID).Scan(&info.CWD, &info.ToolCount, &info.LastPrompt, &info.NotificationCount)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &info, nil
}

func (nm *NotificationManager) formatMessage(eventType string, event HookEvent, sessionInfo *SessionInfo) string {
	cwd := event.CWD
	project := "Claude"
	if cwd != "" {
		project = filepath.Base(cwd)
	}

	switch eventType {
	case "Notification":
		message := strings.ToLower(event.Message)
		if strings.Contains(message, "permission") {
			return fmt.Sprintf("🔐 %s: Permission needed", project)
		} else if strings.Contains(message, "waiting") {
			return fmt.Sprintf("⏸️ %s: Waiting for input", project)
		} else if strings.Contains(message, "approval") {
			return fmt.Sprintf("✋ %s: Approval needed", project)
		} else {
			msg := event.Message
			if len(msg) > 50 {
				msg = msg[:50]
			}
			return fmt.Sprintf("ℹ️ %s: %s", project, msg)
		}

	case "Stop":
		if sessionInfo != nil && sessionInfo.ToolCount > 0 {
			return fmt.Sprintf("✅ %s: Task done (%d tools used)", project, sessionInfo.ToolCount)
		}
		return fmt.Sprintf("✅ %s: Task completed", project)

	case "PostToolUse":
		toolName := event.ToolName
		if toolName == "" {
			toolName = "unknown"
		}
		if sessionInfo != nil {
			return fmt.Sprintf("⚙️ %s: Used %s (#%d)", project, toolName, sessionInfo.ToolCount)
		}
		return fmt.Sprintf("⚙️ %s: Used %s", project, toolName)

	case "SubagentStop":
		return fmt.Sprintf("🤖 %s: Subagent completed", project)
	}

	return fmt.Sprintf("%s: %s", project, eventType)
}

func (nm *NotificationManager) sendTelegram(message string) {
	if !nm.telegramConfig.Enabled || nm.telegramConfig.Token == "" {
		return
	}

	chatID := nm.telegramConfig.GroupID
	if chatID == "" {
		chatID = nm.telegramConfig.ChatID
	}
	if chatID == "" {
		nm.logger.Println("No Telegram chat_id or group_id configured")
		return
	}

	// Fire and forget in goroutine
	go func() {
		url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", nm.telegramConfig.Token)

		formattedMessage := fmt.Sprintf("<b>Claude Code</b>\n%s", message)

		payload := map[string]interface{}{
			"chat_id":              chatID,
			"text":                 formattedMessage,
			"parse_mode":           "HTML",
			"disable_notification": false,
		}

		jsonData, err := json.Marshal(payload)
		if err != nil {
			nm.logger.Printf("Telegram JSON error: %v", err)
			return
		}

		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Post(url, "application/json", strings.NewReader(string(jsonData)))
		if err != nil {
			nm.logger.Printf("Telegram error: %v", err)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode == 200 {
			nm.logger.Printf("Telegram sent: %s", message[:min(50, len(message))])
		} else {
			nm.logger.Printf("Telegram failed: %d", resp.StatusCode)
		}
	}()
}

func (nm *NotificationManager) sendDesktopNotification(message, eventType string) {
	// Only for high-priority events
	if eventType != "Notification" && eventType != "Stop" {
		return
	}

	titleMap := map[string]string{
		"Notification": "⚠️ Claude Code",
		"Stop":         "✅ Claude Code",
		"PostToolUse":  "⚙️ Claude Code",
		"SubagentStop": "🤖 Claude Code",
	}

	title := titleMap[eventType]
	if title == "" {
		title = "Claude Code"
	}

	script := fmt.Sprintf(`display notification "%s" with title "%s" sound name "Glass"`,
		strings.ReplaceAll(message, `"`, `\"`),
		title)

	cmd := exec.Command("osascript", "-e", script)
	if err := cmd.Run(); err != nil {
		nm.logger.Printf("Desktop notification failed: %v", err)
	}
}

func (nm *NotificationManager) recordNotification(sessionID, eventType, message string) error {
	_, err := nm.db.Exec(`
		INSERT INTO notifications (session_id, event_type, message)
		VALUES (?, ?, ?)
	`, sessionID, eventType, message)
	if err != nil {
		return err
	}

	_, err = nm.db.Exec(`
		UPDATE sessions
		SET notification_count = notification_count + 1,
		    last_notification_type = ?,
		    last_notification_time = CURRENT_TIMESTAMP
		WHERE session_id = ?
	`, eventType, sessionID)
	return err
}

func (nm *NotificationManager) HandleEvent(event HookEvent) error {
	eventType := event.HookEventName
	sessionID := event.SessionID

	nm.logger.Printf("Event: %s for session %s", eventType, sessionID[:min(8, len(sessionID))])

	// Update session tracking
	if err := nm.updateSession(sessionID, event); err != nil {
		nm.logger.Printf("Session update error: %v", err)
	}

	// Check if we should send notification
	if _, exists := PRIORITIES[eventType]; !exists {
		nm.logger.Printf("Ignoring event type: %s", eventType)
		return nil
	}

	// Check debouncing
	if nm.shouldDebounce(eventType, sessionID) {
		nm.logger.Printf("Debounced: %s", eventType)
		return nil
	}

	// Get session info for context
	sessionInfo, err := nm.getSessionInfo(sessionID)
	if err != nil {
		nm.logger.Printf("Session info error: %v", err)
	}

	// Format message
	message := nm.formatMessage(eventType, event, sessionInfo)

	// Send notifications
	nm.sendTelegram(message)
	nm.sendDesktopNotification(message, eventType)

	// Record notification
	if err := nm.recordNotification(sessionID, eventType, message); err != nil {
		nm.logger.Printf("Record error: %v", err)
	}

	// Update debounce time
	nm.markNotificationTime(eventType, sessionID)

	nm.logger.Printf("Notified: %s", message[:min(60, len(message))])
	return nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
