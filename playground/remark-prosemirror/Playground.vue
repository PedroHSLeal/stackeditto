<template>
  <div style="width: 100vw">
    <template v-for="(value, key) of markdownItSections">
      <button @click="() => fileKey = key">{{ key }}</button>
    </template>

    <button @click="seila" style="background-color: red">MAPEAR PARA MARKDOWN</button>
  </div>
  <div id="widgets" style="display: flex; height: 100vh">
    <ProsemirrorEditor :fileKey="fileKey" class="fancy-scroll" style="overflow: auto" />
  </div>
</template>

<script setup lang="ts">
import ProsemirrorEditor from "@/components/ProsemirrorEditor.vue";

import { markRaw, onMounted, provide, readonly, ref, shallowRef } from 'vue';
import { useUntrustedScripts } from "@/services/untrusted-code-extensions/scripts";

import importsTemplate from '@/templates/imports-template.js?raw';
import { getUntrustedHtmlBlock, getUntrustedHtmlBlockKeys, registerUntrustedHtmlBlock } from "@/services/untrusted-code-extensions/registry/html-blocks";
import { useOpenFiles } from "@/services/opened-files";

import markdownItText from "<md>/markdown-it-test-file.md?raw";
import type { EditorView } from "prosemirror-view";
import { proseMirrorToMarkdown } from "@/services/markdown/remark";
import { getView } from "@/services/prosemirror";

const fileKey = ref("");
const view = markRaw<{ view: EditorView | null }>({ view: null });
const markdownItSections = shallowRef({});

const { loadUntrustedScript } = useUntrustedScripts();
const of = useOpenFiles();

provide("fileKey", readonly(fileKey));
provide("view", view);

let outsideHtmlMap: Map<string, string> = new Map();

onMounted(async () => {
  await loadUntrustedScript(`return async function(registerHtmlBlock) { ${importsTemplate} }`, registerUntrustedHtmlBlock);
  const sections = breakFileIntoSections(markdownItText);

  for (const key in sections) {
    of.setFile(key, sections[key]);
  }

  // of.setFile("code", sections["code"]);

  markdownItSections.value = sections;
  // markdownItSections.value = { code: sections["code"] };

  fileKey.value = "custom elements";
});

function breakFileIntoSections(file: string): { [key: string]: string } {
  const section = /<!-- \#\#\# (?<name>.+) -->/gm;

  const cleanSections = file.split(section).filter(s => s);

  const obj: { [key: string]: string } = {};

  for (let i = 0; i < cleanSections.length; i += 2) {
    obj[cleanSections[i]] = cleanSections[i + 1];
  }

  return obj;
}

function seila() {
  let untrustedHtmlBlockTags = getUntrustedHtmlBlockKeys();

  untrustedHtmlBlockTags.forEach((htmlBlockTag) => {
    getView()!.dom.querySelectorAll<HTMLElement>(htmlBlockTag).forEach(element => {
      let parent = element.parentElement;

      let result = getUntrustedHtmlBlock(htmlBlockTag).toMarkdown(element.parentElement, element, null);

      let tag = parent?.getAttributeNS("stack-and-ditto", "tag")
      let position = parent?.getAttributeNS("stack-and-ditto", "position")

      outsideHtmlMap.set(`${tag}-${position}`, `<${tag}>\n${result}\n</${tag}>`);
    })
  });

  proseMirrorToMarkdown(getView()!.state.doc).then(v => {
    let ids = [...outsideHtmlMap.keys()]
    untrustedHtmlBlockTags.forEach((htmlBlockTag) => {
      ids.filter(id => id.startsWith(htmlBlockTag)).forEach(id => {
        v = v.replace(`</${htmlBlockTag}/>`, outsideHtmlMap.get(id)!);
      });
    })

    console.log(v);
  })
}
</script>