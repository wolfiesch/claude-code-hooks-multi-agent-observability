<template>
  <div>
    <!-- HITL Question Section (NEW) -->
    <div
      v-if="event.humanInTheLoop && (event.humanInTheLoopStatus?.status === 'pending' || hasSubmittedResponse)"
      class="mb-4 p-4 rounded-lg border-2 shadow-lg"
      :class="hasSubmittedResponse || event.humanInTheLoopStatus?.status === 'responded' ? 'border-green-500 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20' : 'border-yellow-500 bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 animate-pulse-slow'"
      @click.stop
    >
      <!-- Question Header -->
      <div class="mb-3">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center space-x-2">
            <span class="text-2xl">{{ hitlTypeEmoji }}</span>
            <h3 class="text-lg font-bold" :class="hasSubmittedResponse || event.humanInTheLoopStatus?.status === 'responded' ? 'text-green-900 dark:text-green-100' : 'text-yellow-900 dark:text-yellow-100'">
              {{ hitlTypeLabel }}
            </h3>
            <span v-if="permissionType" class="text-xs font-mono font-semibold px-2 py-1 rounded border-2 bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-900 dark:text-blue-100">
              {{ permissionType }}
            </span>
          </div>
          <span v-if="!hasSubmittedResponse && event.humanInTheLoopStatus?.status !== 'responded'" class="text-xs font-semibold text-yellow-700 dark:text-yellow-300">
            ⏱️ Waiting for response...
          </span>
        </div>
        <div class="flex items-center space-x-2 ml-9">
          <span
            class="text-xs font-semibold text-[var(--theme-text-primary)] px-1.5 py-0.5 rounded-full border-2 bg-[var(--theme-bg-tertiary)] shadow-sm"
            :style="{ ...appBgStyle, ...appBorderStyle }"
          >
            {{ event.source_app }}
          </span>
          <span class="text-xs text-[var(--theme-text-secondary)] px-1.5 py-0.5 rounded-full border bg-[var(--theme-bg-tertiary)]/50 shadow-sm" :class="borderColorClass">
            {{ sessionIdShort }}
          </span>
          <span class="text-xs text-[var(--theme-text-tertiary)] font-medium">
            {{ formatTime(event.timestamp) }}
          </span>
        </div>
      </div>

      <!-- Question Text -->
      <div class="mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg border" :class="hasSubmittedResponse || event.humanInTheLoopStatus?.status === 'responded' ? 'border-green-300' : 'border-yellow-300'">
        <p class="text-base font-medium text-gray-900 dark:text-gray-100">
          {{ event.humanInTheLoop.question }}
        </p>
      </div>

      <!-- Inline Response Display (Optimistic UI) -->
      <div v-if="localResponse || (event.humanInTheLoopStatus?.status === 'responded' && event.humanInTheLoopStatus.response)" class="mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-400">
        <div class="flex items-center mb-2">
          <span class="text-xl mr-2">✅</span>
          <strong class="text-green-900 dark:text-green-100">Your Response:</strong>
        </div>
        <div v-if="(localResponse?.response || event.humanInTheLoopStatus?.response?.response)" class="text-gray-900 dark:text-gray-100 ml-7">
          {{ localResponse?.response || event.humanInTheLoopStatus?.response?.response }}
        </div>
        <div v-if="(localResponse?.permission !== undefined || event.humanInTheLoopStatus?.response?.permission !== undefined)" class="text-gray-900 dark:text-gray-100 ml-7">
          {{ (localResponse?.permission ?? event.humanInTheLoopStatus?.response?.permission) ? 'Approved ✅' : 'Denied ❌' }}
        </div>
        <div v-if="(localResponse?.choice || event.humanInTheLoopStatus?.response?.choice)" class="text-gray-900 dark:text-gray-100 ml-7">
          {{ localResponse?.choice || event.humanInTheLoopStatus?.response?.choice }}
        </div>
      </div>

      <!-- Response UI -->
      <div v-if="event.humanInTheLoop.type === 'question'">
        <!-- Text Input for Questions -->
        <textarea
          v-model="responseText"
          class="w-full p-3 border-2 border-yellow-500 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
          rows="3"
          placeholder="Type your response here..."
          @click.stop
        ></textarea>
        <div class="flex justify-end space-x-2 mt-2">
          <button
            @click.stop="submitResponse"
            :disabled="!responseText.trim() || isSubmitting || hasSubmittedResponse"
            class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed"
          >
            {{ isSubmitting ? '⏳ Sending...' : '✅ Submit Response' }}
          </button>
        </div>
      </div>

      <div v-else-if="event.humanInTheLoop.type === 'permission'">
        <!-- Yes/No Buttons for Permissions -->
        <div class="flex justify-end items-center space-x-3">
          <div v-if="hasSubmittedResponse || event.humanInTheLoopStatus?.status === 'responded'" class="flex items-center px-3 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-500">
            <span class="text-sm font-bold text-green-900 dark:text-green-100">Responded</span>
          </div>
          <button
            @click.stop="submitPermission(false)"
            :disabled="isSubmitting || hasSubmittedResponse"
            class="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
            :class="hasSubmittedResponse ? 'opacity-40 cursor-not-allowed' : ''"
          >
            {{ isSubmitting ? '⏳' : '❌ Deny' }}
          </button>
          <button
            @click.stop="submitPermission(true)"
            :disabled="isSubmitting || hasSubmittedResponse"
            class="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
            :class="hasSubmittedResponse ? 'opacity-40 cursor-not-allowed' : ''"
          >
            {{ isSubmitting ? '⏳' : '✅ Approve' }}
          </button>
        </div>
      </div>

      <div v-else-if="event.humanInTheLoop.type === 'choice'">
        <!-- Multiple Choice Buttons -->
        <div class="flex flex-wrap gap-2 justify-end">
          <button
            v-for="choice in event.humanInTheLoop.choices"
            :key="choice"
            @click.stop="submitChoice(choice)"
            :disabled="isSubmitting || hasSubmittedResponse"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 disabled:transform-none"
          >
            {{ isSubmitting ? '⏳' : choice }}
          </button>
        </div>
      </div>
    </div>

    <!-- Original Event Row Content (skip if HITL with humanInTheLoop) -->
    <div
      v-if="!event.humanInTheLoop"
      class="group relative p-4 mobile:p-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border border-[var(--theme-border-primary)] hover:border-[var(--theme-primary)] bg-gradient-to-r from-[var(--theme-bg-primary)] to-[var(--theme-bg-secondary)]"
      :class="{ 'ring-2 ring-[var(--theme-primary)] border-[var(--theme-primary)] shadow-2xl': isExpanded }"
      @click="toggleExpanded"
    >
    <!-- App color indicator -->
    <div 
      class="absolute left-0 top-0 bottom-0 w-3 rounded-l-lg"
      :style="{ backgroundColor: appHexColor }"
    ></div>
    
    <!-- Session color indicator -->
    <div 
      class="absolute left-3 top-0 bottom-0 w-1.5"
      :class="gradientClass"
    ></div>
    
    <div class="ml-4">
      <!-- Desktop Layout: Original horizontal layout -->
      <div class="hidden mobile:block mb-2">
        <!-- Mobile: App + Time on first row -->
        <div class="flex items-center justify-between mb-1">
          <span 
            class="text-xs font-semibold text-[var(--theme-text-primary)] px-1.5 py-0.5 rounded-full border-2 bg-[var(--theme-bg-tertiary)] shadow-md"
            :style="{ ...appBgStyle, ...appBorderStyle }"
          >
            {{ event.source_app }}
          </span>
          <span class="text-xs text-[var(--theme-text-tertiary)] font-medium">
            {{ formatTime(event.timestamp) }}
          </span>
        </div>
        
        <!-- Mobile: Session + Event Type on second row -->
        <div class="flex items-center space-x-2">
          <span class="text-xs text-[var(--theme-text-secondary)] px-1.5 py-0.5 rounded-full border bg-[var(--theme-bg-tertiary)]/50" :class="borderColorClass">
            {{ sessionIdShort }}
          </span>
          <span v-if="event.model_name" class="text-xs text-[var(--theme-text-secondary)] px-1.5 py-0.5 rounded-full border bg-[var(--theme-bg-tertiary)]/50 shadow-sm" :title="`Model: ${event.model_name}`">
            <span class="mr-0.5">🧠</span>{{ formatModelName(event.model_name) }}
          </span>
          <span v-if="event.agent_type && event.agent_type !== 'claude'" class="text-xs font-semibold text-purple-900 dark:text-purple-100 px-1.5 py-0.5 rounded-full border-2 border-purple-500 bg-purple-100 dark:bg-purple-900/30 shadow-sm" :title="`Agent: ${event.agent_type}${event.agent_version ? ' v' + event.agent_version : ''}`">
            <span class="mr-0.5">🤖</span>{{ event.agent_type }}
          </span>
          <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-bold bg-[var(--theme-primary)] text-white shadow-md">
            <span class="mr-1 text-sm">{{ hookEmoji }}</span>
            {{ event.hook_event_type }}
          </span>
        </div>
      </div>

      <!-- Desktop Layout: Original single row layout -->
      <div class="flex items-center justify-between mb-2 mobile:hidden">
        <div class="flex items-center space-x-4">
          <span
            class="text-base font-bold text-[var(--theme-text-primary)] px-2 py-0.5 rounded-full border-2 bg-[var(--theme-bg-tertiary)] shadow-lg"
            :style="{ ...appBgStyle, ...appBorderStyle }"
          >
            {{ event.source_app }}
          </span>
          <span class="text-sm text-[var(--theme-text-secondary)] px-2 py-0.5 rounded-full border bg-[var(--theme-bg-tertiary)]/50 shadow-md" :class="borderColorClass">
            {{ sessionIdShort }}
          </span>
          <span v-if="event.model_name" class="text-sm text-[var(--theme-text-secondary)] px-2 py-0.5 rounded-full border bg-[var(--theme-bg-tertiary)]/50 shadow-md" :title="`Model: ${event.model_name}`">
            <span class="mr-1">🧠</span>{{ formatModelName(event.model_name) }}
          </span>
          <span v-if="event.agent_type && event.agent_type !== 'claude'" class="text-sm font-semibold text-purple-900 dark:text-purple-100 px-2 py-0.5 rounded-full border-2 border-purple-500 bg-purple-100 dark:bg-purple-900/30 shadow-md" :title="`Agent: ${event.agent_type}${event.agent_version ? ' v' + event.agent_version : ''}`">
            <span class="mr-1">🤖</span>{{ event.agent_type }}
          </span>
          <span class="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-bold bg-[var(--theme-primary)] text-white shadow-lg">
            <span class="mr-1.5 text-base">{{ hookEmoji }}</span>
            {{ event.hook_event_type }}
          </span>
        </div>
        <span class="text-sm text-[var(--theme-text-tertiary)] font-semibold">
          {{ formatTime(event.timestamp) }}
        </span>
      </div>
      
      <!-- Tool info and Summary - Desktop Layout -->
      <div class="flex items-center justify-between mb-2 mobile:hidden">
        <div v-if="toolInfo" class="text-base text-[var(--theme-text-secondary)] font-semibold">
          <span class="font-medium italic px-2 py-0.5 rounded border-2 border-[var(--theme-primary)] bg-[var(--theme-primary-light)] shadow-sm">{{ toolInfo.tool }}</span>
          <span v-if="toolInfo.detail" class="ml-2 text-[var(--theme-text-tertiary)]" :class="{ 'italic': event.hook_event_type === 'UserPromptSubmit' }">{{ toolInfo.detail }}</span>
        </div>
        
        <!-- Summary aligned to the right -->
        <div v-if="event.summary" class="max-w-[50%] px-3 py-1.5 bg-[var(--theme-primary)]/10 border border-[var(--theme-primary)]/30 rounded-lg shadow-md">
          <span class="text-sm text-[var(--theme-text-primary)] font-semibold">
            <span class="mr-1">📝</span>
            {{ event.summary }}
          </span>
        </div>
      </div>

      <!-- Tool info and Summary - Mobile Layout -->
      <div class="space-y-2 hidden mobile:block mb-2">
        <div v-if="toolInfo" class="text-sm text-[var(--theme-text-secondary)] font-semibold w-full">
          <span class="font-medium italic px-1.5 py-0.5 rounded border-2 border-[var(--theme-primary)] bg-[var(--theme-primary-light)] shadow-sm">{{ toolInfo.tool }}</span>
          <span v-if="toolInfo.detail" class="ml-2 text-[var(--theme-text-tertiary)]" :class="{ 'italic': event.hook_event_type === 'UserPromptSubmit' }">{{ toolInfo.detail }}</span>
        </div>
        
        <div v-if="event.summary" class="w-full px-2 py-1 bg-[var(--theme-primary)]/10 border border-[var(--theme-primary)]/30 rounded-lg shadow-md">
          <span class="text-xs text-[var(--theme-text-primary)] font-semibold">
            <span class="mr-1">📝</span>
            {{ event.summary }}
          </span>
        </div>
      </div>
      
      <!-- Expanded content -->
      <div v-if="isExpanded" class="mt-2 pt-2 border-t-2 border-[var(--theme-primary)] bg-gradient-to-r from-[var(--theme-bg-primary)] to-[var(--theme-bg-secondary)] rounded-b-lg p-3 space-y-3">
        <!-- Payload -->
        <div>
          <!-- Header with buttons -->
          <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h4 class="text-base mobile:text-sm font-bold text-[var(--theme-primary)] drop-shadow-sm flex items-center">
              <span class="mr-1.5 text-xl mobile:text-base">📦</span>
              Payload
            </h4>
            <div class="flex items-center gap-2">
              <!-- Copy Parsed Button -->
              <button
                @click.stop="copyParsedPayload"
                class="px-2.5 py-1 mobile:px-2 mobile:py-0.5 text-xs font-bold rounded-lg bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-dark)] text-white transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/50"
                aria-label="Copy parsed payload to clipboard (Press C)"
                :title="isExpanded ? 'Copy Parsed (Press C)' : ''"
              >
                {{ copyParsedButtonText }}
              </button>
              <!-- Copy Raw JSON Button -->
              <button
                @click.stop="copyRawPayload"
                class="px-2.5 py-1 mobile:px-2 mobile:py-0.5 text-xs font-bold rounded-lg bg-[var(--theme-bg-tertiary)] hover:bg-[var(--theme-bg-quaternary)] text-[var(--theme-text-primary)] border border-[var(--theme-border-primary)] transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/50"
                aria-label="Copy raw JSON payload to clipboard (Press Shift+C)"
                :title="isExpanded ? 'Copy Raw JSON (Press Shift+C)' : ''"
              >
                {{ copyRawButtonText }}
              </button>
              <!-- Toggle Raw JSON Button -->
              <button
                @click.stop="showRawPayload = !showRawPayload"
                class="px-2.5 py-1 mobile:px-2 mobile:py-0.5 text-xs font-bold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/50"
                :class="showRawPayload
                  ? 'bg-[var(--theme-primary)] text-white'
                  : 'bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-primary)] border border-[var(--theme-border-primary)]'"
                :aria-expanded="showRawPayload"
                aria-label="Toggle raw JSON view (Press R)"
                :title="isExpanded ? 'Toggle Raw JSON (Press R)' : ''"
              >
                {{ showRawPayload ? '▲ Hide Raw' : '▼ Show Raw' }}
              </button>
            </div>
          </div>

          <!-- Parsed Payload View (Default) -->
          <div class="bg-[var(--theme-bg-tertiary)] p-3 mobile:p-2 rounded-lg border border-[var(--theme-primary)]/30 shadow-md">
            <PayloadInterpreter
              ref="payloadInterpreterRef"
              :payload="event.payload"
              :event-type="event.hook_event_type"
              :event="event"
            />
          </div>

          <!-- Raw JSON View (Collapsible) -->
          <div v-if="showRawPayload" class="mt-3">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-xs font-semibold text-[var(--theme-text-tertiary)]">Raw JSON</span>
              <div class="flex-1 h-px bg-[var(--theme-border-primary)]"></div>
            </div>
            <pre class="text-sm mobile:text-xs text-[var(--theme-text-primary)] bg-[var(--theme-bg-quaternary)] p-3 mobile:p-2 rounded-lg overflow-x-auto max-h-64 overflow-y-auto font-mono border border-[var(--theme-border-primary)] shadow-md">{{ formattedPayload }}</pre>
          </div>
        </div>
        
        <!-- Chat transcript button -->
        <div v-if="event.chat && event.chat.length > 0" class="flex justify-end">
          <button
            @click.stop="!isMobile && (showChatModal = true)"
            :class="[
              'px-4 py-2 mobile:px-3 mobile:py-1.5 font-bold rounded-lg transition-all duration-200 flex items-center space-x-1.5 shadow-md hover:shadow-lg',
              isMobile 
                ? 'bg-[var(--theme-bg-quaternary)] cursor-not-allowed opacity-50 text-[var(--theme-text-quaternary)] border border-[var(--theme-border-tertiary)]' 
                : 'bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary-light)] hover:from-[var(--theme-primary-dark)] hover:to-[var(--theme-primary)] text-white border border-[var(--theme-primary-dark)] transform hover:scale-105'
            ]"
            :disabled="isMobile"
          >
            <span class="text-base mobile:text-sm">💬</span>
            <span class="text-sm mobile:text-xs font-bold drop-shadow-sm">
              {{ isMobile ? 'Not available in mobile' : `View Chat Transcript (${event.chat.length} messages)` }}
            </span>
          </button>
        </div>
      </div>
    </div>
    </div>
    <!-- Chat Modal -->
    <ChatTranscriptModal
      v-if="event.chat && event.chat.length > 0"
      :is-open="showChatModal"
      :chat="event.chat"
      @close="showChatModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, watch } from 'vue';
import type { HookEvent, HumanInTheLoopResponse } from '../types';
import { useMediaQuery } from '../composables/useMediaQuery';
import { useExpandedEvents } from '../composables/useExpandedState';
import ChatTranscriptModal from './ChatTranscriptModal.vue';
import PayloadInterpreter from './PayloadInterpreter.vue';
import { API_BASE_URL } from '../config';

const props = defineProps<{
  event: HookEvent;
  gradientClass: string;
  colorClass: string;
  appGradientClass: string;
  appColorClass: string;
  appHexColor: string;
}>();

const emit = defineEmits<{
  (e: 'response-submitted', response: HumanInTheLoopResponse): void;
}>();

// Expanded state management with persistence
const { isEventExpanded, toggleEvent } = useExpandedEvents();
const isExpanded = computed({
  get: () => isEventExpanded(props.event.id),
  set: () => toggleEvent(props.event.id)
});

// Existing refs
const showChatModal = ref(false);
const showRawPayload = ref(false);
const copyParsedButtonText = ref('📋 Copy Parsed');
const copyRawButtonText = ref('📄 Copy Raw');
const payloadInterpreterRef = ref<InstanceType<typeof PayloadInterpreter> | null>(null);

// New refs for HITL
const responseText = ref('');
const isSubmitting = ref(false);
const hasSubmittedResponse = ref(false);
const localResponse = ref<HumanInTheLoopResponse | null>(null); // Optimistic UI

// Media query for responsive design
const { isMobile } = useMediaQuery();

const toggleExpanded = () => {
  toggleEvent(props.event.id);
};

const sessionIdShort = computed(() => {
  return props.event.session_id.slice(0, 8);
});

const hookEmoji = computed(() => {
  const emojiMap: Record<string, string> = {
    'PreToolUse': '🔧',
    'PostToolUse': '✅',
    'Notification': '🔔',
    'Stop': '🛑',
    'SubagentStop': '👥',
    'PreCompact': '📦',
    'UserPromptSubmit': '💬',
    'SessionStart': '🚀',
    'SessionEnd': '🏁'
  };
  return emojiMap[props.event.hook_event_type] || '❓';
});

const borderColorClass = computed(() => {
  // Convert bg-color-500 to border-color-500
  return props.colorClass.replace('bg-', 'border-');
});


const appBorderStyle = computed(() => {
  return {
    borderColor: props.appHexColor
  };
});

const appBgStyle = computed(() => {
  // Use the hex color with 20% opacity
  return {
    backgroundColor: props.appHexColor + '33' // Add 33 for 20% opacity in hex
  };
});

const formattedPayload = computed(() => {
  return JSON.stringify(props.event.payload, null, 2);
});

const toolInfo = computed(() => {
  const payload = props.event.payload;
  
  // Handle UserPromptSubmit events
  if (props.event.hook_event_type === 'UserPromptSubmit' && payload.prompt) {
    return {
      tool: 'Prompt:',
      detail: `"${payload.prompt.slice(0, 100)}${payload.prompt.length > 100 ? '...' : ''}"`
    };
  }
  
  // Handle PreCompact events
  if (props.event.hook_event_type === 'PreCompact') {
    const trigger = payload.trigger || 'unknown';
    return {
      tool: 'Compaction:',
      detail: trigger === 'manual' ? 'Manual compaction' : 'Auto-compaction (full context)'
    };
  }
  
  // Handle SessionStart events
  if (props.event.hook_event_type === 'SessionStart') {
    const source = payload.source || 'unknown';
    const sourceLabels: Record<string, string> = {
      'startup': 'New session',
      'resume': 'Resuming session',
      'clear': 'Fresh session'
    };
    return {
      tool: 'Session:',
      detail: sourceLabels[source] || source
    };
  }
  
  // Handle tool-based events
  if (payload.tool_name) {
    const info: { tool: string; detail?: string } = { tool: payload.tool_name };
    
    if (payload.tool_input) {
      if (payload.tool_input.command) {
        info.detail = payload.tool_input.command.slice(0, 50) + (payload.tool_input.command.length > 50 ? '...' : '');
      } else if (payload.tool_input.file_path) {
        info.detail = payload.tool_input.file_path.split('/').pop();
      } else if (payload.tool_input.pattern) {
        info.detail = payload.tool_input.pattern;
      }
    }
    
    return info;
  }
  
  return null;
});

const formatTime = (timestamp?: number) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
};

// Format model name for display (e.g., "claude-haiku-4-5-20251001" -> "haiku-4-5")
const formatModelName = (name: string | null | undefined): string => {
  if (!name) return '';

  // Extract model family and version
  // "claude-haiku-4-5-20251001" -> "haiku-4-5"
  // "claude-sonnet-4-5-20250929" -> "sonnet-4-5"
  const parts = name.split('-');
  if (parts.length >= 4) {
    return `${parts[1]}-${parts[2]}-${parts[3]}`;
  }
  return name;
};

const copyParsedPayload = async () => {
  try {
    const parsedText = payloadInterpreterRef.value?.getParsedText() || formattedPayload.value;
    await navigator.clipboard.writeText(parsedText);
    copyParsedButtonText.value = '✅ Copied!';
    setTimeout(() => {
      copyParsedButtonText.value = '📋 Copy Parsed';
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
    copyParsedButtonText.value = '❌ Failed';
    setTimeout(() => {
      copyParsedButtonText.value = '📋 Copy Parsed';
    }, 2000);
  }
};

const copyRawPayload = async () => {
  try {
    await navigator.clipboard.writeText(formattedPayload.value);
    copyRawButtonText.value = '✅ Copied!';
    setTimeout(() => {
      copyRawButtonText.value = '📄 Copy Raw';
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
    copyRawButtonText.value = '❌ Failed';
    setTimeout(() => {
      copyRawButtonText.value = '📄 Copy Raw';
    }, 2000);
  }
};

// Keyboard shortcut handler
const handleKeyPress = (event: KeyboardEvent) => {
  // Only handle shortcuts when event is expanded
  if (!isExpanded.value) return;

  // Ignore shortcuts when typing in input fields
  const target = event.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

  const key = event.key.toLowerCase();

  // R = Toggle Raw JSON
  if (key === 'r' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    showRawPayload.value = !showRawPayload.value;
  }

  // C = Copy Parsed
  if (key === 'c' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    copyParsedPayload();
  }

  // Shift+C = Copy Raw JSON
  if (key === 'c' && event.shiftKey && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    copyRawPayload();
  }

  // O = Toggle "Other details" in PayloadInterpreter
  if (key === 'o' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    payloadInterpreterRef.value?.toggleOtherDetails();
  }
};

// Setup keyboard shortcuts - only add listener when this row is expanded
// This prevents having 50+ global listeners when 50+ rows are rendered
// Instead, only the expanded row (typically 1) has an active listener
watch(isExpanded, (newValue) => {
  if (newValue) {
    window.addEventListener('keydown', handleKeyPress);
  } else {
    window.removeEventListener('keydown', handleKeyPress);
  }
}, { immediate: true });

// Cleanup listener on unmount (in case row is expanded when unmounting)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyPress);
});

// New computed properties for HITL
const hitlTypeEmoji = computed(() => {
  if (!props.event.humanInTheLoop) return '';
  const emojiMap = {
    question: '❓',
    permission: '🔐',
    choice: '🎯'
  };
  return emojiMap[props.event.humanInTheLoop.type] || '❓';
});

const hitlTypeLabel = computed(() => {
  if (!props.event.humanInTheLoop) return '';
  const labelMap = {
    question: 'Agent Question',
    permission: 'Permission Request',
    choice: 'Choice Required'
  };
  return labelMap[props.event.humanInTheLoop.type] || 'Question';
});

const permissionType = computed(() => {
  return props.event.payload?.permission_type || null;
});

// Methods for HITL responses
const submitResponse = async () => {
  if (!responseText.value.trim() || !props.event.id) return;

  const response: HumanInTheLoopResponse = {
    response: responseText.value.trim(),
    hookEvent: props.event,
    respondedAt: Date.now()
  };

  // Optimistic UI: Show response immediately
  localResponse.value = response;
  hasSubmittedResponse.value = true;
  const savedText = responseText.value;
  responseText.value = '';
  isSubmitting.value = true;

  try {
    const res = await fetch(`${API_BASE_URL}/events/${props.event.id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    });

    if (!res.ok) throw new Error('Failed to submit response');

    emit('response-submitted', response);
  } catch (error) {
    console.error('Error submitting response:', error);
    // Rollback optimistic update
    localResponse.value = null;
    hasSubmittedResponse.value = false;
    responseText.value = savedText;
    alert('Failed to submit response. Please try again.');
  } finally {
    isSubmitting.value = false;
  }
};

const submitPermission = async (approved: boolean) => {
  if (!props.event.id) return;

  const response: HumanInTheLoopResponse = {
    permission: approved,
    hookEvent: props.event,
    respondedAt: Date.now()
  };

  // Optimistic UI: Show response immediately
  localResponse.value = response;
  hasSubmittedResponse.value = true;
  isSubmitting.value = true;

  try {
    const res = await fetch(`${API_BASE_URL}/events/${props.event.id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    });

    if (!res.ok) throw new Error('Failed to submit permission');

    emit('response-submitted', response);
  } catch (error) {
    console.error('Error submitting permission:', error);
    // Rollback optimistic update
    localResponse.value = null;
    hasSubmittedResponse.value = false;
    alert('Failed to submit permission. Please try again.');
  } finally {
    isSubmitting.value = false;
  }
};

const submitChoice = async (choice: string) => {
  if (!props.event.id) return;

  const response: HumanInTheLoopResponse = {
    choice,
    hookEvent: props.event,
    respondedAt: Date.now()
  };

  // Optimistic UI: Show response immediately
  localResponse.value = response;
  hasSubmittedResponse.value = true;
  isSubmitting.value = true;

  try {
    const res = await fetch(`${API_BASE_URL}/events/${props.event.id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    });

    if (!res.ok) throw new Error('Failed to submit choice');

    emit('response-submitted', response);
  } catch (error) {
    console.error('Error submitting choice:', error);
    // Rollback optimistic update
    localResponse.value = null;
    hasSubmittedResponse.value = false;
    alert('Failed to submit choice. Please try again.');
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
@keyframes pulse-slow {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.95;
  }
}

.animate-pulse-slow {
  animation: pulse-slow 2s ease-in-out infinite;
}
</style>