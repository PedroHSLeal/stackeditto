<template>
  <div id="preview" v-html="markdownedFile" />
</template>

<script setup lang="ts">
import { marked } from 'marked';
import { onMounted, onUpdated, ref } from 'vue';

const markdownedFile = ref("");

const props = defineProps<{ content: string }>();

onMounted(() => insertHTML())

onUpdated(() => insertHTML())

function insertHTML() {
  markdownedFile.value = marked.parse(props.content) as string;
}
</script>

<style scoped>
#preview {
  height: 100vh;
  overflow: auto;
  padding: 8px;
}
</style>