import { ref, onMounted, onUnmounted } from 'vue';
import type { HookEvent, WebSocketMessage } from '../types';

/**
 * Validate that an event has required fields
 */
function isValidEvent(event: any): event is HookEvent {
  return (
    event &&
    typeof event === 'object' &&
    typeof event.source_app === 'string' &&
    typeof event.session_id === 'string' &&
    typeof event.hook_event_type === 'string'
  );
}

/**
 * Sanitize event to ensure no malformed data crashes the UI
 */
function sanitizeEvent(event: any): HookEvent {
  try {
    return {
      id: event.id,
      source_app: String(event.source_app || 'unknown'),
      session_id: String(event.session_id || 'unknown'),
      hook_event_type: String(event.hook_event_type || 'unknown'),
      payload: typeof event.payload === 'object' ? event.payload : {},
      chat: Array.isArray(event.chat) ? event.chat : undefined,
      summary: event.summary ? String(event.summary) : undefined,
      timestamp: typeof event.timestamp === 'number' ? event.timestamp : Date.now(),
      model_name: event.model_name ? String(event.model_name) : undefined,
      input_tokens: typeof event.input_tokens === 'number' ? event.input_tokens : undefined,
      output_tokens: typeof event.output_tokens === 'number' ? event.output_tokens : undefined,
      cost_usd: typeof event.cost_usd === 'number' ? event.cost_usd : undefined,
      environment: typeof event.environment === 'object' ? event.environment : undefined,
      session: typeof event.session === 'object' ? event.session : undefined,
      workflow: typeof event.workflow === 'object' ? event.workflow : undefined,
      humanInTheLoop: event.humanInTheLoop,
      humanInTheLoopStatus: event.humanInTheLoopStatus,
    };
  } catch (err) {
    console.error('[useWebSocket] Failed to sanitize event:', err);
    // Return a minimal valid event
    return {
      source_app: 'error',
      session_id: 'error',
      hook_event_type: 'error',
      payload: { error: 'Failed to parse event' },
      timestamp: Date.now(),
    };
  }
}

export function useWebSocket(url: string) {
  const events = ref<HookEvent[]>([]);
  const isConnected = ref(false);
  const error = ref<string | null>(null);
  
  let ws: WebSocket | null = null;
  let reconnectTimeout: number | null = null;
  
  // Get max events from environment variable or use default
  const maxEvents = parseInt(import.meta.env.VITE_MAX_EVENTS_TO_DISPLAY || '300');
  
  const connect = () => {
    try {
      ws = new WebSocket(url);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        isConnected.value = true;
        error.value = null;
      };
      
      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          if (message.type === 'initial') {
            const initialEvents = Array.isArray(message.data) ? message.data : [];
            // Validate and sanitize all initial events
            const validEvents = initialEvents
              .filter(e => {
                if (!isValidEvent(e)) {
                  console.warn('[useWebSocket] Skipping invalid event:', e);
                  return false;
                }
                return true;
              })
              .map(sanitizeEvent);
            // Only keep the most recent events up to maxEvents
            events.value = validEvents.slice(-maxEvents);
          } else if (message.type === 'event') {
            const rawEvent = message.data as any;

            // Validate event before adding
            if (!isValidEvent(rawEvent)) {
              console.warn('[useWebSocket] Received invalid event, skipping:', rawEvent);
              error.value = 'Received malformed event (skipped)';
              // Clear error after 3 seconds
              setTimeout(() => {
                if (error.value === 'Received malformed event (skipped)') {
                  error.value = null;
                }
              }, 3000);
              return;
            }

            // Sanitize and add event
            const newEvent = sanitizeEvent(rawEvent);
            events.value.push(newEvent);

            // Limit events array to maxEvents, removing oldest events in-place
            // Using splice instead of slice to avoid creating a new array on every event
            if (events.value.length > maxEvents) {
              const removeCount = events.value.length - maxEvents;
              events.value.splice(0, removeCount);
            }
          }
        } catch (err) {
          console.error('[useWebSocket] Failed to parse WebSocket message:', err);
          error.value = 'Failed to parse message from server';
          // Clear error after 5 seconds
          setTimeout(() => {
            if (error.value === 'Failed to parse message from server') {
              error.value = null;
            }
          }, 5000);
        }
      };
      
      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        error.value = 'WebSocket connection error';
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        isConnected.value = false;
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeout = window.setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, 3000);
      };
    } catch (err) {
      console.error('Failed to connect:', err);
      error.value = 'Failed to connect to server';
    }
  };
  
  const disconnect = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    
    if (ws) {
      ws.close();
      ws = null;
    }
  };
  
  onMounted(() => {
    connect();
  });
  
  onUnmounted(() => {
    disconnect();
  });

  const clearEvents = () => {
    events.value = [];
  };

  return {
    events,
    isConnected,
    error,
    clearEvents
  };
}