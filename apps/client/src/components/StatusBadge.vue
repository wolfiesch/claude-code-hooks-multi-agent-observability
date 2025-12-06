<template>
  <span :class="badgeClasses" class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold shadow-sm border gap-1">
    <span>{{ icon }}</span>
    <span>{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SessionStatus } from '../types/history';

const props = defineProps<{
  status: SessionStatus;
}>();

const badgeClasses = computed(() => {
  switch (props.status) {
    case 'success':
      return 'bg-green-500 text-white border-green-600';
    case 'error':
      return 'bg-red-500 text-white border-red-600';
    case 'partial':
      return 'bg-yellow-300 text-[var(--theme-text-primary)] border-yellow-400';
    case 'ongoing':
    default:
      return 'bg-blue-500 text-white border-blue-600';
  }
});

const icon = computed(() => {
  switch (props.status) {
    case 'success':
      return '✓';
    case 'error':
      return '✗';
    case 'partial':
      return '⚠';
    case 'ongoing':
    default:
      return '●';
  }
});

const label = computed(() => {
  switch (props.status) {
    case 'success':
      return 'Success';
    case 'error':
      return 'Error';
    case 'partial':
      return 'Partial';
    case 'ongoing':
    default:
      return 'Ongoing';
  }
});
</script>
