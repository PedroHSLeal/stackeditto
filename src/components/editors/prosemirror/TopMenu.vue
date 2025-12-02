<template>
  <div id="container">
    <div v-for="group in actions" id="group">
      <template v-for="action in group">
        <button @click="action.fn" :placeholder="action.placeholder">
          <Icon v-if="action.icon" :icon="action.icon" width="24" height="24" />
          <span v-if="action.text">{{ action.text }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";

import type { Menu } from "@/models/top-menu";

const props = defineProps<{ actions: Menu[] }>();
</script>

<style scoped lang="scss">
#container {
  display: flex;

  & > #group {
    display: flex;
    gap: 4px;

    &:not(:last-of-type) {
      border-right: 1px solid black;
    }

    button {
      $size: 32px;

      width: $size;
      height: $size;

      padding: 0;
    }
  }
}
</style>