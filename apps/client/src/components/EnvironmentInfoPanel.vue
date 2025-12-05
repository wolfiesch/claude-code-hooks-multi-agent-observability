<template>
  <div v-if="envInfo" class="environment-panel bg-[var(--theme-bg-primary)] rounded-lg border border-[var(--theme-border-primary)] overflow-hidden">
    <!-- Header -->
    <button
      @click="isExpanded = !isExpanded"
      class="w-full px-4 py-3 mobile:px-3 mobile:py-2 flex items-center justify-between hover:bg-[var(--theme-bg-secondary)] transition-colors cursor-pointer"
    >
      <div class="flex items-center space-x-2">
        <span class="text-lg mobile:text-base">💻</span>
        <h3 class="text-sm mobile:text-xs font-semibold text-[var(--theme-text-primary)]">
          Environment
        </h3>
      </div>
      <svg
        :class="['w-5 h-5 mobile:w-4 mobile:h-4 text-[var(--theme-text-tertiary)] transition-transform', isExpanded ? 'rotate-180' : '']"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Expandable Content -->
    <div v-show="isExpanded" class="px-4 pb-4 mobile:px-3 mobile:pb-3 space-y-3 mobile:space-y-2">
      <!-- OS Info -->
      <div class="flex items-center justify-between py-2 border-b border-[var(--theme-border-secondary)]">
        <span class="text-xs mobile:text-[10px] text-[var(--theme-text-tertiary)] uppercase tracking-wide">
          Operating System
        </span>
        <div class="flex items-center space-x-2">
          <span class="text-lg mobile:text-base">{{ getOSIcon(envInfo.os) }}</span>
          <span class="text-sm mobile:text-xs font-medium text-[var(--theme-text-primary)]">
            {{ getOSName(envInfo.os) }}
          </span>
          <span v-if="envInfo.osVersion" class="text-xs mobile:text-[10px] text-[var(--theme-text-tertiary)]">
            {{ envInfo.osVersion }}
          </span>
        </div>
      </div>

      <!-- Shell -->
      <div v-if="envInfo.shell" class="flex items-center justify-between py-2 border-b border-[var(--theme-border-secondary)]">
        <span class="text-xs mobile:text-[10px] text-[var(--theme-text-tertiary)] uppercase tracking-wide">
          Shell
        </span>
        <span class="text-sm mobile:text-xs font-mono font-medium text-[var(--theme-text-primary)]">
          {{ envInfo.shell }}
        </span>
      </div>

      <!-- Language Runtimes -->
      <div class="space-y-2">
        <span class="text-xs mobile:text-[10px] text-[var(--theme-text-tertiary)] uppercase tracking-wide">
          Runtimes
        </span>
        <div class="grid grid-cols-2 gap-2 mobile:gap-1.5">
          <!-- Python -->
          <div v-if="envInfo.pythonVersion" class="flex items-center space-x-2 px-3 py-2 mobile:px-2 mobile:py-1.5 rounded-md bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-secondary)]">
            <span class="text-base mobile:text-sm">🐍</span>
            <div class="flex flex-col">
              <span class="text-[10px] text-[var(--theme-text-tertiary)]">Python</span>
              <span class="text-xs mobile:text-[10px] font-mono font-medium text-[var(--theme-text-primary)]">
                {{ envInfo.pythonVersion }}
              </span>
            </div>
          </div>

          <!-- Node.js -->
          <div v-if="envInfo.nodeVersion" class="flex items-center space-x-2 px-3 py-2 mobile:px-2 mobile:py-1.5 rounded-md bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-secondary)]">
            <span class="text-base mobile:text-sm">🟢</span>
            <div class="flex flex-col">
              <span class="text-[10px] text-[var(--theme-text-tertiary)]">Node</span>
              <span class="text-xs mobile:text-[10px] font-mono font-medium text-[var(--theme-text-primary)]">
                {{ envInfo.nodeVersion }}
              </span>
            </div>
          </div>

          <!-- Go -->
          <div v-if="envInfo.goVersion" class="flex items-center space-x-2 px-3 py-2 mobile:px-2 mobile:py-1.5 rounded-md bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-secondary)]">
            <span class="text-base mobile:text-sm">🐹</span>
            <div class="flex flex-col">
              <span class="text-[10px] text-[var(--theme-text-tertiary)]">Go</span>
              <span class="text-xs mobile:text-[10px] font-mono font-medium text-[var(--theme-text-primary)]">
                {{ envInfo.goVersion }}
              </span>
            </div>
          </div>

          <!-- Rust -->
          <div v-if="envInfo.rustVersion" class="flex items-center space-x-2 px-3 py-2 mobile:px-2 mobile:py-1.5 rounded-md bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-secondary)]">
            <span class="text-base mobile:text-sm">🦀</span>
            <div class="flex flex-col">
              <span class="text-[10px] text-[var(--theme-text-tertiary)]">Rust</span>
              <span class="text-xs mobile:text-[10px] font-mono font-medium text-[var(--theme-text-primary)]">
                {{ envInfo.rustVersion }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  envInfo?: {
    os: string;
    osVersion?: string;
    shell?: string;
    user?: string;
    pythonVersion?: string;
    nodeVersion?: string;
    goVersion?: string;
    rustVersion?: string;
  };
}>();

const isExpanded = ref(false);

function getOSIcon(os: string): string {
  const osLower = os.toLowerCase();
  if (osLower.includes('darwin') || osLower.includes('mac')) return '🍎';
  if (osLower.includes('linux')) return '🐧';
  if (osLower.includes('windows')) return '🪟';
  return '💻';
}

function getOSName(os: string): string {
  const osLower = os.toLowerCase();
  if (osLower.includes('darwin')) return 'macOS';
  if (osLower.includes('linux')) return 'Linux';
  if (osLower.includes('windows')) return 'Windows';
  return os;
}
</script>

<style scoped>
.environment-panel {
  max-width: 400px;
}

@media (max-width: 640px) {
  .environment-panel {
    max-width: unset;
  }
}
</style>
