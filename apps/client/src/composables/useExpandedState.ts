import { ref, watch } from 'vue';

const STORAGE_KEY_PREFIX = 'cc-observability-expanded-';

/**
 * Composable for managing expanded/collapsed state with localStorage persistence
 */
export function useExpandedState(storageKey: string, defaultExpanded = false) {
  const fullKey = STORAGE_KEY_PREFIX + storageKey;

  // Try to restore from localStorage
  const storedValue = localStorage.getItem(fullKey);
  const initialValue = storedValue !== null ? storedValue === 'true' : defaultExpanded;

  const isExpanded = ref(initialValue);

  // Watch for changes and persist to localStorage
  watch(isExpanded, (newValue) => {
    try {
      localStorage.setItem(fullKey, String(newValue));
    } catch (error) {
      console.warn('Failed to save expanded state to localStorage:', error);
    }
  });

  return {
    isExpanded
  };
}

/**
 * Composable for managing a set of expanded event IDs
 */
export function useExpandedEvents() {
  const STORAGE_KEY = 'cc-observability-expanded-events';

  // Load from localStorage
  const loadExpandedEvents = (): Set<number> => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Set(parsed);
      }
    } catch (error) {
      console.warn('Failed to load expanded events from localStorage:', error);
    }
    return new Set();
  };

  const expandedEvents = ref<Set<number>>(loadExpandedEvents());

  // Save to localStorage whenever the set changes
  const saveToStorage = () => {
    try {
      const array = Array.from(expandedEvents.value);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(array));
    } catch (error) {
      console.warn('Failed to save expanded events to localStorage:', error);
    }
  };

  const toggleEvent = (eventId: number | undefined) => {
    if (eventId === undefined) return;

    if (expandedEvents.value.has(eventId)) {
      expandedEvents.value.delete(eventId);
    } else {
      expandedEvents.value.add(eventId);
    }
    saveToStorage();
  };

  const isEventExpanded = (eventId: number | undefined): boolean => {
    if (eventId === undefined) return false;
    return expandedEvents.value.has(eventId);
  };

  const clearAll = () => {
    expandedEvents.value.clear();
    saveToStorage();
  };

  return {
    expandedEvents,
    toggleEvent,
    isEventExpanded,
    clearAll
  };
}
