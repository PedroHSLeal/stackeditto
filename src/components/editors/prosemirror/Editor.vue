<template>
    <div ref="refEditor" id="prosemirror-editor" />
</template>

<script setup lang="ts">
import { buildProsemirrorState, defaultNodeViews, buildProsemirrorView, updateProsemirrorView } from '@/services/prosemirror';
import { onMounted, useTemplateRef, watch } from 'vue';
import type { EditorView } from 'prosemirror-view';

const props = defineProps<{ value: string }>();

const refEditor = useTemplateRef("refEditor");

let view: EditorView;

onMounted(async () => {
  try {
    view = buildProsemirrorView(refEditor.value!, await buildProsemirrorState(props.value), defaultNodeViews);
  } catch (error) {
    console.error(error);
  }
})

watch(() => props.value, async (newV) => {
  if (view) {
    try {
      await updateProsemirrorView(view, newV);
    } catch (error) {
      console.error(error);
    }
  }
})
</script>

<style lang="scss" src="./prosemirror.scss"></style>