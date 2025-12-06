<template>
  <div class="flex flex-col gap-2">
    <label class="text-xs font-semibold text-[var(--theme-text-secondary)] uppercase">Time Range</label>
    <div class="flex flex-wrap items-center gap-2">
      <select
        v-model="selectedPreset"
        class="bg-[var(--theme-bg-primary)] border border-[var(--theme-border-primary)] rounded-md px-3 py-2 text-sm text-[var(--theme-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]"
      >
        <option v-for="preset in presets" :key="preset.value" :value="preset.value">
          {{ preset.label }}
        </option>
      </select>

      <div v-if="selectedPreset === 'custom'" class="flex flex-wrap gap-2 items-center">
        <input
          v-model="customStart"
          type="datetime-local"
          class="bg-[var(--theme-bg-primary)] border border-[var(--theme-border-primary)] rounded-md px-3 py-2 text-sm text-[var(--theme-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]"
        />
        <span class="text-[var(--theme-text-tertiary)] text-sm">to</span>
        <input
          v-model="customEnd"
          type="datetime-local"
          class="bg-[var(--theme-bg-primary)] border border-[var(--theme-border-primary)] rounded-md px-3 py-2 text-sm text-[var(--theme-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

type PresetValue = 'last_hour' | 'today' | 'week' | 'month' | 'custom';

const emit = defineEmits<{
  change: [range: { start_time?: number; end_time?: number }];
}>();

const selectedPreset = ref<PresetValue>('last_hour');
const customStart = ref('');
const customEnd = ref('');

const presets: Array<{ label: string; value: PresetValue }> = [
  { label: 'Last hour', value: 'last_hour' },
  { label: 'Today', value: 'today' },
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' },
  { label: 'Custom', value: 'custom' }
];

const getPresetRange = (value: PresetValue) => {
  const now = new Date();
  const end = now.getTime();
  switch (value) {
    case 'last_hour': {
      return { start_time: end - 60 * 60 * 1000, end_time: end };
    }
    case 'today': {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return { start_time: startOfDay, end_time: end };
    }
    case 'week': {
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday).getTime();
      return { start_time: startOfWeek, end_time: end };
    }
    case 'month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return { start_time: startOfMonth, end_time: end };
    }
    case 'custom':
    default:
      return { start_time: undefined, end_time: undefined };
  }
};

const emitRange = (range: { start_time?: number; end_time?: number }) => {
  emit('change', range);
};

watch(selectedPreset, (value) => {
  if (value !== 'custom') {
    customStart.value = '';
    customEnd.value = '';
    emitRange(getPresetRange(value));
  } else if (customStart.value && customEnd.value) {
    emitRange({
      start_time: new Date(customStart.value).getTime(),
      end_time: new Date(customEnd.value).getTime()
    });
  }
});

watch([customStart, customEnd], ([start, end]) => {
  if (selectedPreset.value !== 'custom') return;
  if (start && end) {
    emitRange({
      start_time: new Date(start).getTime(),
      end_time: new Date(end).getTime()
    });
  }
});

onMounted(() => {
  emitRange(getPresetRange(selectedPreset.value));
});
</script>
