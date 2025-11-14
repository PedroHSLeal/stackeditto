<template>
  <div style="position: relative; display: inline-block;">
    <slot name="trigger-button" :modal="showModal" :showModalFn="() => showModal = !showModal"/>
    <Transition>
      <div v-if="showModal" id="dropdown-container" style="min-width: 180px; background-color: var(--primary); padding: 8px; border-radius: 4px; z-index: 999; position: absolute; gap: 4px; display: flex; flex-direction: column;">
        <slot name="dropdown" :modal="showModal" :showModalFn="() => showModal = !showModal" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

const showModal = ref(false);
</script>

<style scoped>
.v-enter-active,
.v-leave-active {
  transition: all 0.5s ease;
}

.v-enter-from,
.v-leave-to {
  transform: translateY(20px);
  opacity: 0;
}
</style>