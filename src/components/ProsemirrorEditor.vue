<template>
  <div id="prosemirror-editor-container" style="display: flex; flex-direction: column; padding: 6px 12px; width: 100%; overflow: auto">
    <p style="margin: 0 0 12px 0; text-align: center; color: lightgray; cursor: default;">--*--</p>
    <div id="prosemirror-editor" class="fancy-scroll" style="flex-grow: 1; width: 100%; overflow: auto" />
    <p style="margin: 12px 0 0 0; text-align: center; color: lightgray; cursor: default;">--*--</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from "vue";
import type { EditorView } from "prosemirror-view";
import { buildViewState, defaultNodeViews, defaultView, updateView } from "@/services/prosemirror";
import { useOpenFiles } from "@/services/opened-files";

let view: EditorView;

const props = defineProps<{ fileKey: string }>();

const of = useOpenFiles();

onMounted(async () => {
  try {
    let element = document.querySelector("#prosemirror-editor-container > #prosemirror-editor");
    view = defaultView(element!, await buildViewState(of.getFile(props.fileKey) ?? ""), defaultNodeViews);
  }
  catch (error: any) {
    console.error(error);
  }
})

watch(() => props.fileKey, async (newV, _) => {
  if (view) {
    try {
      updateView(view, of.getFile(newV) ?? "");
    } catch (error: any) {
      console.error(error);
    }
  }
});
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