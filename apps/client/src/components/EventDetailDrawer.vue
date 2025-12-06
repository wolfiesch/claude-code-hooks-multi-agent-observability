<template>
  <Transition name="fade">
    <div v-if="event" class="fixed inset-0 z-40 flex">
      <div class="flex-1 bg-black/30 backdrop-blur-sm" @click="emit('close')" />
      <Transition name="slide-in">
        <div class="w-96 max-w-full h-full bg-[var(--theme-bg-primary)] border-l border-[var(--theme-border-primary)] shadow-theme-lg flex flex-col">
          <div class="p-4 border-b border-[var(--theme-border-primary)] flex items-start justify-between gap-3">
            <div class="space-y-1">
              <div class="text-sm font-semibold text-[var(--theme-text-primary)]">
                {{ event.hook_event_type }}
              </div>
              <div class="text-xs text-[var(--theme-text-tertiary)]">
                {{ formattedTimestamp }}
              </div>
            </div>
            <button
              class="h-9 w-9 rounded-full bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-primary)] text-[var(--theme-text-primary)] hover:border-[var(--theme-primary)]"
              @click="emit('close')"
              aria-label="Close event details"
            >
              ✕
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-4 space-y-4">
            <div class="flex flex-col gap-1">
              <span class="text-xs uppercase text-[var(--theme-text-tertiary)] font-semibold">Event Summary</span>
              <p class="text-sm text-[var(--theme-text-secondary)] leading-relaxed">
                {{ event.summary || 'No summary provided.' }}
              </p>
            </div>

            <div class="flex flex-col gap-2">
              <button
                class="flex items-center justify-between px-3 py-2 rounded-md bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-primary)] text-sm font-semibold text-[var(--theme-text-primary)]"
                @click="showPayload = !showPayload"
              >
                <span>Payload</span>
                <span>{{ showPayload ? '▴' : '▾' }}</span>
              </button>
              <pre v-if="showPayload" class="bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-primary)] rounded-md p-3 text-xs text-[var(--theme-text-primary)] overflow-x-auto whitespace-pre-wrap">
{{ payloadString }}
              </pre>
            </div>

            <div v-if="event.chat?.length" class="flex flex-col gap-2">
              <button
                class="flex items-center justify-between px-3 py-2 rounded-md bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-primary)] text-sm font-semibold text-[var(--theme-text-primary)]"
                @click="showChat = !showChat"
              >
                <span>Chat ({{ event.chat.length }})</span>
                <span>{{ showChat ? '▴' : '▾' }}</span>
              </button>
              <div v-if="showChat" class="bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-primary)] rounded-md divide-y divide-[var(--theme-border-primary)]">
                <div
                  v-for="(message, index) in event.chat"
                  :key="index"
                  class="p-3 text-sm text-[var(--theme-text-primary)]"
                >
                  <div class="text-[11px] uppercase text-[var(--theme-text-tertiary)] mb-1">{{ message.role || 'message' }}</div>
                  <div>{{ message.content || JSON.stringify(message) }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="p-4 border-t border-[var(--theme-border-primary)]">
            <a
              :href="sessionLink"
              target="_blank"
              rel="noreferrer"
              class="inline-flex items-center justify-center w-full px-3 py-2 rounded-md bg-[var(--theme-primary)] text-white font-semibold shadow-sm hover:bg-[var(--theme-primary-hover)] transition-theme"
            >
              View full session
            </a>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { API_BASE_URL } from '../config';
import type { HookEvent } from '../types';

const props = defineProps<{
  event: HookEvent | null;
  sessionId?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const showPayload = ref(true);
const showChat = ref(false);

const formattedTimestamp = computed(() => {
  if (!props.event?.timestamp) return 'Timestamp unavailable';
  return new Date(props.event.timestamp).toLocaleString();
});

const payloadString = computed(() => {
  if (!props.event?.payload) return 'No payload';
  try {
    return JSON.stringify(props.event.payload, null, 2);
  } catch {
    return 'Unable to render payload';
  }
});

const sessionLink = computed(() => {
  if (!props.sessionId) return '#';
  return `${API_BASE_URL}/sessions/${encodeURIComponent(props.sessionId)}`;
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-in-enter-active,
.slide-in-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.slide-in-enter-from,
.slide-in-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
