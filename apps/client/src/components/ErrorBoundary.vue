<template>
  <div v-if="hasError" class="error-boundary-fallback">
    <div class="error-container bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg p-6 m-4">
      <!-- Error Icon -->
      <div class="text-center mb-4">
        <span class="text-6xl">⚠️</span>
      </div>

      <!-- Error Title -->
      <h2 class="text-xl font-bold text-red-800 dark:text-red-300 text-center mb-3">
        {{ errorTitle }}
      </h2>

      <!-- Error Message -->
      <p class="text-red-700 dark:text-red-400 text-center mb-4 text-sm">
        {{ errorMessage }}
      </p>

      <!-- Error Details (collapsible in dev mode) -->
      <details v-if="isDevelopment && errorDetails" class="mb-4 bg-red-100 dark:bg-red-900/30 rounded p-3">
        <summary class="cursor-pointer text-red-800 dark:text-red-300 font-semibold text-sm mb-2">
          Error Details
        </summary>
        <pre class="text-xs text-red-900 dark:text-red-200 overflow-auto max-h-48">{{ errorDetails }}</pre>
      </details>

      <!-- Action Buttons -->
      <div class="flex gap-3 justify-center flex-wrap">
        <button
          @click="handleReset"
          class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-200 text-sm"
        >
          🔄 Reset Component
        </button>
        <button
          @click="handleReload"
          class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors duration-200 text-sm"
        >
          ↻ Reload Page
        </button>
        <button
          v-if="isDevelopment"
          @click="handleCopyError"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 text-sm"
        >
          📋 Copy Error
        </button>
      </div>

      <!-- Help Text -->
      <p class="text-center text-xs text-red-600 dark:text-red-400 mt-4">
        If this persists, try clearing your browser cache or
        <a href="https://github.com/anthropics/claude-code/issues" target="_blank" class="underline">report an issue</a>.
      </p>
    </div>
  </div>
  <slot v-else></slot>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured, computed } from 'vue';

interface Props {
  fallbackTitle?: string;
  fallbackMessage?: string;
  onError?: (error: Error, errorInfo: any) => void;
}

const props = withDefaults(defineProps<Props>(), {
  fallbackTitle: 'Component Error',
  fallbackMessage: 'An unexpected error occurred in this component.',
});

const hasError = ref(false);
const errorTitle = ref('');
const errorMessage = ref('');
const errorDetails = ref('');
const errorStack = ref('');

const isDevelopment = computed(() => import.meta.env.DEV);

// Capture errors in child components
onErrorCaptured((error: Error, instance, info) => {
  hasError.value = true;
  errorTitle.value = props.fallbackTitle;
  errorMessage.value = props.fallbackMessage;
  errorStack.value = error.stack || '';
  errorDetails.value = `
Error: ${error.message}
Component: ${instance?.$options?.name || 'Unknown'}
Info: ${info}

Stack Trace:
${error.stack || 'No stack trace available'}
  `.trim();

  // Log to console in development
  if (isDevelopment.value) {
    console.error('[ErrorBoundary] Caught error:', {
      error,
      instance,
      info,
      stack: error.stack,
    });
  }

  // Call custom error handler if provided
  if (props.onError) {
    props.onError(error, { instance, info });
  }

  // Prevent error from propagating
  return false;
});

const handleReset = () => {
  hasError.value = false;
  errorTitle.value = '';
  errorMessage.value = '';
  errorDetails.value = '';
  errorStack.value = '';
};

const handleReload = () => {
  window.location.reload();
};

const handleCopyError = async () => {
  try {
    await navigator.clipboard.writeText(errorDetails.value);
    alert('Error details copied to clipboard!');
  } catch (err) {
    console.error('Failed to copy error details:', err);
    alert('Failed to copy to clipboard. See console for details.');
  }
};
</script>

<style scoped>
.error-boundary-fallback {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-container {
  max-width: 600px;
  width: 100%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

details summary {
  user-select: none;
}

details[open] summary {
  margin-bottom: 0.5rem;
}
</style>
