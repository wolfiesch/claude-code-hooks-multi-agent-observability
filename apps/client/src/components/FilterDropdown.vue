<template>
  <div class="filter-dropdown" ref="dropdownRef">
    <button
      type="button"
      class="filter-trigger"
      :class="{ 'is-active': isOpen || badgeCount > 0 }"
      @click="toggleDropdown"
      :disabled="disabled"
      :title="badgeCount ? `${badgeCount} selected` : `Filter by ${label}`"
    >
      <span class="trigger-label">{{ label }}</span>
      <span v-if="badgeCount > 0" class="badge">{{ badgeCount }}</span>
      <span class="chevron" :class="{ 'rotate-180': isOpen }">v</span>
    </button>

    <Transition name="fade-scale">
      <div v-if="isOpen" class="dropdown-panel" role="menu" :aria-label="`${label} filter options`">
        <div class="panel-header">
          <div class="panel-title">{{ label }}</div>
          <div class="panel-actions">
            <button class="panel-btn" @click="selectAll" :disabled="!options.length">Select All</button>
            <button v-if="badgeCount" class="panel-btn" @click="clearAll">Clear All</button>
          </div>
        </div>
        <div class="options-list" role="group">
          <label
            v-for="option in options"
            :key="option.value"
            class="option-row"
          >
            <input
              type="checkbox"
              class="checkbox"
              :checked="isSelected(option.value)"
              @change="toggleOption(option.value)"
            />
            <div class="option-text">
              <span class="option-label">{{ option.label }}</span>
              <span v-if="option.description" class="option-description">{{ option.description }}</span>
            </div>
          </label>
          <div v-if="options.length === 0" class="empty-state">No options available</div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import type { FilterOption } from '../types';

const props = withDefaults(defineProps<{
  label: string;
  options: FilterOption[];
  modelValue: Set<string>;
  disabled?: boolean;
}>(), {
  options: () => [],
  modelValue: () => new Set<string>(),
  disabled: false
});

const emit = defineEmits<{
  'update:modelValue': [value: Set<string>];
}>();

const isOpen = ref(false);
const dropdownRef = ref<HTMLDivElement>();

const badgeCount = computed(() => props.modelValue?.size || 0);

const toggleDropdown = () => {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
};

const isSelected = (value: string) => props.modelValue?.has(value);

const toggleOption = (value: string) => {
  const next = new Set(props.modelValue);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  emit('update:modelValue', next);
};

const selectAll = () => {
  emit('update:modelValue', new Set(props.options.map(option => option.value)));
};

const clearAll = () => {
  emit('update:modelValue', new Set());
};

const handleClickOutside = (event: MouseEvent) => {
  if (!dropdownRef.value) return;
  if (!dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    isOpen.value = false;
  }
};

watch(() => props.options, (newOptions) => {
  // Drop selections that no longer exist in the available option set
  const optionValues = new Set(newOptions.map(option => option.value));
  const filteredSelection = new Set(Array.from(props.modelValue || []).filter(value => optionValues.has(value)));
  if (filteredSelection.size !== (props.modelValue?.size || 0)) {
    emit('update:modelValue', filteredSelection);
  }
}, { deep: true });

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.filter-dropdown {
  position: relative;
  display: inline-block;
}

.filter-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--theme-border-primary);
  background: linear-gradient(90deg, var(--theme-bg-tertiary), var(--theme-bg-primary));
  color: var(--theme-text-primary);
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.3px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
  transition: all 0.2s ease;
  cursor: pointer;
}

.filter-trigger.is-active {
  border-color: var(--theme-primary);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.12);
  background: linear-gradient(90deg, var(--theme-primary) 0%, var(--theme-primary-light) 100%);
  color: white;
}

.filter-trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.trigger-label {
  text-transform: uppercase;
}

.badge {
  background: rgba(255, 255, 255, 0.2);
  color: inherit;
  border: 1px solid currentColor;
  padding: 2px 6px;
  border-radius: 9999px;
  font-size: 11px;
  min-width: 20px;
  text-align: center;
}

.chevron {
  font-size: 12px;
  transition: transform 0.2s ease;
  display: inline-block;
}

.rotate-180 {
  transform: rotate(180deg);
}

.dropdown-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 240px;
  background: var(--theme-bg-primary);
  border: 1px solid var(--theme-border-primary);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
  z-index: 20;
  padding: 10px 10px 8px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px 8px;
  border-bottom: 1px solid var(--theme-border-primary);
}

.panel-title {
  font-weight: 800;
  color: var(--theme-text-primary);
  font-size: 12px;
  text-transform: uppercase;
}

.panel-actions {
  display: flex;
  gap: 6px;
}

.panel-btn {
  background: var(--theme-bg-tertiary);
  border: 1px solid var(--theme-border-primary);
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 700;
  color: var(--theme-text-primary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.panel-btn:hover:not(:disabled) {
  background: var(--theme-bg-quaternary);
  border-color: var(--theme-primary);
}

.panel-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.options-list {
  max-height: 260px;
  overflow-y: auto;
  padding: 6px 2px 2px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.option-row {
  display: flex;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 10px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.option-row:hover {
  background: var(--theme-bg-tertiary);
  border-color: var(--theme-border-primary);
}

.checkbox {
  width: 16px;
  height: 16px;
}

.option-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.option-label {
  font-weight: 700;
  color: var(--theme-text-primary);
  font-size: 12px;
}

.option-description {
  font-size: 11px;
  color: var(--theme-text-tertiary);
}

.empty-state {
  padding: 10px;
  text-align: center;
  font-size: 12px;
  color: var(--theme-text-tertiary);
  border: 1px dashed var(--theme-border-primary);
  border-radius: 10px;
}

.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.15s ease;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
</style>
