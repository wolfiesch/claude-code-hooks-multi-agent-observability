const eventTypeToEmoji: Record<string, string> = {
  'PreToolUse': '🔧',
  'PostToolUse': '✅',
  'Notification': '🔔',
  'Stop': '🛑',
  'SubagentStop': '👥',
  'PreCompact': '📦',
  'UserPromptSubmit': '💬',
  'SessionStart': '🚀',
  'SessionEnd': '🏁',
  // Codex CLI event types
  'TaskStart': '▶️',
  'TaskComplete': '✅',
  'TaskError': '❌',
  // Default
  'default': '❓'
};

export function useEventEmojis() {
  const getEmojiForEventType = (eventType: string): string => {
    return eventTypeToEmoji[eventType] || eventTypeToEmoji.default;
  };
  
  const formatEventTypeLabel = (eventTypes: Record<string, number>): string => {
    const entries = Object.entries(eventTypes)
      .sort((a, b) => b[1] - a[1]); // Sort by count descending

    if (entries.length === 0) return '';

    // Adaptive display: show fewer items when there are many events to keep labels compact
    const totalEvents = entries.reduce((sum, [, count]) => sum + count, 0);
    const maxItems = totalEvents > 10 ? 2 : 3; // Show only 2 items if more than 10 total events

    // Show up to maxItems most frequent event types
    const topEntries = entries.slice(0, maxItems);
    const remainingCount = entries.length - topEntries.length;

    const label = topEntries
      .map(([type, count]) => {
        const emoji = getEmojiForEventType(type);
        return count > 1 ? `${emoji}×${count}` : emoji;
      })
      .join('');

    // Add indicator if there are more event types not shown
    return remainingCount > 0 ? `${label}+${remainingCount}` : label;
  };
  
  return {
    getEmojiForEventType,
    formatEventTypeLabel
  };
}