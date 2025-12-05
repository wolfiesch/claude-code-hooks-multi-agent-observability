<template>
  <div v-if="gitInfo && gitInfo.isGitRepo" class="inline-flex items-center space-x-1.5 mobile:space-x-1">
    <!-- Branch Badge -->
    <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-primary)] border border-[var(--theme-border-secondary)]">
      <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 16 16">
        <path d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z"/>
      </svg>
      {{ gitInfo.branch }}
    </span>

    <!-- Commit Hash -->
    <span v-if="gitInfo.commitHash" class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-secondary)] border border-[var(--theme-border-secondary)]">
      {{ gitInfo.commitHash }}
    </span>

    <!-- Dirty Status -->
    <span
      v-if="gitInfo.isDirty"
      class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--theme-accent-warning)]/20 text-[var(--theme-accent-warning)] border border-[var(--theme-accent-warning)]"
      title="Uncommitted changes"
    >
      <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 16 16">
        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
        <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
      </svg>
      Dirty
    </span>
    <span
      v-else
      class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--theme-accent-success)]/20 text-[var(--theme-accent-success)] border border-[var(--theme-accent-success)]"
      title="No uncommitted changes"
    >
      <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 16 16">
        <path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 0 1 .02-.022z"/>
      </svg>
      Clean
    </span>

    <!-- Ahead/Behind Indicators -->
    <div v-if="gitInfo.commitsAhead > 0 || gitInfo.commitsBehind > 0" class="inline-flex items-center space-x-1">
      <span
        v-if="gitInfo.commitsAhead > 0"
        class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold text-[var(--theme-accent-success)]"
        :title="`${gitInfo.commitsAhead} commits ahead of remote`"
      >
        ↑{{ gitInfo.commitsAhead }}
      </span>
      <span
        v-if="gitInfo.commitsBehind > 0"
        class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold text-[var(--theme-accent-error)]"
        :title="`${gitInfo.commitsBehind} commits behind remote`"
      >
        ↓{{ gitInfo.commitsBehind }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  gitInfo?: {
    isGitRepo: boolean;
    branch?: string;
    commitHash?: string;
    isDirty?: boolean;
    commitsAhead?: number;
    commitsBehind?: number;
    stagedFiles?: number;
    unstagedFiles?: number;
  };
}>();
</script>

<style scoped>
/* Component-specific styles */
</style>
