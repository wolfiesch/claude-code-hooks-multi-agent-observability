<template>
  <div class="flex items-center gap-2 mobile:gap-1.5 w-full">
    <label class="text-sm mobile:text-xs font-semibold text-[var(--theme-text-primary)] whitespace-nowrap">
      Inspect Agent:
    </label>
    <div class="relative flex-1 min-w-0">
      <select
        :value="modelValue"
        @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value || null)"
        class="w-full px-3 mobile:px-2 py-2 mobile:py-1.5 rounded-lg text-sm mobile:text-xs font-mono border-2 transition-all duration-200 bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-primary)] border-[var(--theme-border-primary)] focus:border-[var(--theme-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20 appearance-none cursor-pointer"
      >
        <option value="">Auto (Latest from all agents)</option>
        <option
          v-for="agent in agents"
          :key="agent"
          :value="agent"
        >
          {{ agent }}
        </option>
      </select>
      <div class="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none text-[var(--theme-text-tertiary)]">
        <svg class="w-4 h-4 mobile:w-3 mobile:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
    <button
      v-if="modelValue"
      @click="emit('update:modelValue', null)"
      class="px-2 py-1.5 mobile:px-1.5 mobile:py-1 rounded-md bg-[var(--theme-accent-error)]/10 hover:bg-[var(--theme-accent-error)]/20 border border-[var(--theme-accent-error)] text-[var(--theme-accent-error)] text-xs mobile:text-[10px] font-semibold transition-all duration-200 whitespace-nowrap"
      title="Clear agent selection"
    >
      Clear
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string | null;
  agents: string[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();
</script>
