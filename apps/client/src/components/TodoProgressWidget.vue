<template>
  <div class="bg-[var(--theme-bg-primary)] rounded-lg border border-[var(--theme-border-primary)] p-4 mobile:p-3 shadow-lg">
    <div class="flex items-center justify-between mb-3 mobile:mb-2">
      <h3 class="text-sm font-semibold text-[var(--theme-text-primary)] flex items-center gap-2">
        <span class="text-lg">✓</span>
        Todo Progress
        <span
          v-if="selectedAgent"
          class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-[var(--theme-primary-light)] text-[var(--theme-primary-dark)] border border-[var(--theme-primary)]"
          title="Inspecting this agent"
        >
          📌
        </span>
        <span
          v-else-if="showMultiAgentView"
          class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[var(--theme-bg-secondary)] text-[var(--theme-text-secondary)] border border-[var(--theme-border-primary)]"
        >
          {{ perAgentTodos?.length || 0 }} agents
        </span>
      </h3>
      <span v-if="!showMultiAgentView && lastUpdate" class="text-xs text-[var(--theme-text-secondary)]">
        {{ formatTimestamp(lastUpdate) }}
      </span>
    </div>

    <!-- Multi-agent view: per-agent breakdown -->
    <div v-if="showMultiAgentView && perAgentTodos && perAgentTodos.length > 0" class="space-y-2">
      <div
        v-for="agent in perAgentTodos"
        :key="agent.agentId"
        class="flex items-center gap-2 p-2 rounded-lg bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-primary)]"
      >
        <!-- Mini progress ring -->
        <div class="relative w-10 h-10 flex-shrink-0">
          <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <circle
              cx="18"
              cy="18"
              r="14"
              stroke="var(--theme-border-secondary)"
              stroke-width="3"
              fill="none"
            />
            <circle
              cx="18"
              cy="18"
              r="14"
              :stroke="getProgressColor(getCompletionPercent(agent.todoTracking))"
              stroke-width="3"
              fill="none"
              :stroke-dasharray="miniCircumference"
              :stroke-dashoffset="getMiniProgressOffset(agent.todoTracking)"
              stroke-linecap="round"
              class="transition-all duration-300"
            />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="text-[10px] font-bold text-[var(--theme-text-primary)]">
              {{ getCompletionPercent(agent.todoTracking) }}%
            </span>
          </div>
        </div>

        <!-- Agent info -->
        <div class="flex-1 min-w-0">
          <div class="text-xs font-mono text-[var(--theme-text-primary)] truncate" :title="agent.agentId">
            {{ agent.agentId }}
          </div>
          <div class="flex items-center gap-2 text-[10px] text-[var(--theme-text-secondary)]">
            <span class="flex items-center gap-0.5">
              <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              {{ agent.todoTracking.completedTodos }}
            </span>
            <span class="flex items-center gap-0.5">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              {{ agent.todoTracking.inProgressTodos }}
            </span>
            <span class="flex items-center gap-0.5">
              <span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
              {{ agent.todoTracking.pendingTodos }}
            </span>
            <span class="ml-auto">{{ agent.todoTracking.completedTodos }}/{{ agent.todoTracking.totalTodos }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Single agent view: detailed display -->
    <div v-else-if="hasTodos" class="space-y-3">
      <!-- Circular Progress Ring -->
      <div class="flex items-center justify-center gap-4 mobile:gap-3">
        <div class="relative w-24 h-24 mobile:w-20 mobile:h-20">
          <!-- Background circle -->
          <svg class="w-full h-full transform -rotate-90">
            <circle
              cx="48"
              cy="48"
              r="42"
              stroke="var(--theme-border-secondary)"
              stroke-width="8"
              fill="none"
              class="mobile:r-40"
            />
            <!-- Progress circle -->
            <circle
              cx="48"
              cy="48"
              r="42"
              :stroke="progressColor"
              stroke-width="8"
              fill="none"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="progressOffset"
              stroke-linecap="round"
              class="transition-all duration-500 mobile:r-40"
            />
          </svg>
          <!-- Percentage text -->
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="text-2xl mobile:text-xl font-bold text-[var(--theme-text-primary)]">
              {{ completionPercent }}%
            </span>
          </div>
        </div>

        <!-- Stats -->
        <div class="flex flex-col gap-1.5 mobile:gap-1 text-sm">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-green-500"></span>
            <span class="text-[var(--theme-text-secondary)]">Completed:</span>
            <span class="font-semibold text-[var(--theme-text-primary)]">{{ completedTodos }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-blue-500"></span>
            <span class="text-[var(--theme-text-secondary)]">In Progress:</span>
            <span class="font-semibold text-[var(--theme-text-primary)]">{{ inProgressTodos }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-gray-400"></span>
            <span class="text-[var(--theme-text-secondary)]">Pending:</span>
            <span class="font-semibold text-[var(--theme-text-primary)]">{{ pendingTodos }}</span>
          </div>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="relative h-2 bg-[var(--theme-border-secondary)] rounded-full overflow-hidden">
        <div
          class="absolute inset-y-0 left-0 transition-all duration-500 rounded-full"
          :style="{ width: `${completionPercent}%`, backgroundColor: progressColor }"
        ></div>
      </div>

      <!-- Total count -->
      <div class="text-center text-xs text-[var(--theme-text-secondary)]">
        {{ completedTodos }} of {{ totalTodos }} tasks completed
      </div>
    </div>

    <!-- No todos state -->
    <div v-else class="text-center py-4 text-[var(--theme-text-secondary)] text-sm">
      <div class="text-3xl mb-2">📝</div>
      <div>No todos tracked yet</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface TodoTracking {
  totalTodos: number;
  completedTodos: number;
  inProgressTodos: number;
  pendingTodos: number;
  completionRate: number;
  lastUpdate: string | null;
}

interface AgentTodoEntry {
  agentId: string;
  todoTracking: TodoTracking;
  lastEventTime: number;
}

interface Props {
  todoTracking: TodoTracking | null;
  perAgentTodos?: AgentTodoEntry[] | null;
  selectedAgent?: string | null;
}

const props = defineProps<Props>();

// Determine if we should show multi-agent view
const showMultiAgentView = computed(() => {
  return !props.selectedAgent && props.perAgentTodos && props.perAgentTodos.length > 0;
});

const hasTodos = computed(() => {
  return props.todoTracking && props.todoTracking.totalTodos > 0;
});

const totalTodos = computed(() => props.todoTracking?.totalTodos || 0);
const completedTodos = computed(() => props.todoTracking?.completedTodos || 0);
const inProgressTodos = computed(() => props.todoTracking?.inProgressTodos || 0);
const pendingTodos = computed(() => props.todoTracking?.pendingTodos || 0);
const lastUpdate = computed(() => props.todoTracking?.lastUpdate || null);

const completionPercent = computed(() => {
  if (!hasTodos.value) return 0;
  return Math.round((completedTodos.value / totalTodos.value) * 100);
});

// Helper functions for multi-agent view
const getCompletionPercent = (tracking: TodoTracking): number => {
  if (!tracking || tracking.totalTodos === 0) return 0;
  return Math.round((tracking.completedTodos / tracking.totalTodos) * 100);
};

const getProgressColor = (percent: number): string => {
  if (percent === 100) return '#10b981'; // green-500
  if (percent >= 75) return '#3b82f6'; // blue-500
  if (percent >= 50) return '#f59e0b'; // amber-500
  if (percent >= 25) return '#ef4444'; // red-500
  return '#6b7280'; // gray-500
};

const progressColor = computed(() => {
  return getProgressColor(completionPercent.value);
});

// SVG circle calculations for main view
const radius = 42;
const circumference = 2 * Math.PI * radius;
const progressOffset = computed(() => {
  const percent = completionPercent.value;
  return circumference - (percent / 100) * circumference;
});

// SVG circle calculations for mini view (multi-agent)
const miniRadius = 14;
const miniCircumference = 2 * Math.PI * miniRadius;
const getMiniProgressOffset = (tracking: TodoTracking): number => {
  const percent = getCompletionPercent(tracking);
  return miniCircumference - (percent / 100) * miniCircumference;
};

const formatTimestamp = (timestamp: string | null) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};
</script>
