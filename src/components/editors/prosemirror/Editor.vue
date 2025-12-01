<template>
    <div ref="refEditor" id="prosemirror-editor" />
</template>

<script setup lang="ts">
import { buildViewState, defaultNodeViews, defaultView, updateView } from '@/services/prosemirror';
import { onMounted, useTemplateRef, watch, watchEffect } from 'vue';
import type { EditorView } from 'prosemirror-view';

const props = defineProps<{ value: string }>();

const refEditor = useTemplateRef("refEditor");

let view: EditorView;

onMounted(async () => {
  try {
    view = defaultView(refEditor.value!, await buildViewState(props.value), defaultNodeViews);
  } catch (error) {
    console.error(error);
  }
})

watch(() => props.value, async (newV) => {
  if (view) {
    try {
      updateView(view, newV);
    } catch (error) {
      console.error(error);
    }
  }
})
</script>

<style lang="scss">
.ProseMirror {
  & * {
    margin: 0;
    padding: 0;
  }

  & h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p {
    margin: 8px 0;
  }

  & a {
    cursor: pointer;
  }

  & hr {
    margin: 8px 0;
  }

  & blockquote {
    border-left: 3px solid black;
    padding-left: 20px;
  }

  & ul {
    padding-left: 28px;
  }

  & ol {
    padding-left: 40px;
  }

  & table {
    margin: 8px;
    // width: 100%;
    border: 1px solid black;
    border-collapse: collapse;
  }

  & td,
  th {
    width: 100%;
    white-space: nowrap;
    border: 1px solid black;
    border-collapse: collapse;
  }

  &:focus-visible {
    outline: none !important;
  }

  & pre {
    white-space: pre;
  }
}
</style>