<template>
  <div id="directory" @click.stop.prevent="emits('clicked')" @dblclick.stop.prevent="emits('selected')">
    <span>
      <Icon :icon="selected ? 'material-symbols:folder-open' : 'material-symbols:folder'" />
      <span>{{ directory.handle.name }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";

import type { CustomDirectory } from "@/models/file";

defineProps<{ directory: CustomDirectory, selected: boolean }>();

const emits = defineEmits<{ (e: "clicked"): void, (e: "selected"): void }>();
</script>

<style scoped lang="scss">
#directory {
  white-space: nowrap;
  display: flex;
  // align-items: center;
  width: auto;
}

#directory>span {
  user-select: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 4px;
  padding: 0 4px 0 2px;
  transition: background-color 100ms;
}

#directory>span:hover {
  background-color: lightpink;
  cursor: pointer;
}
</style>