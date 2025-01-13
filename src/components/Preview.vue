<template>
  <div id="preview" v-html="markdownedFile" />
</template>

<script setup lang="ts">
import { marked } from 'marked';
import { onMounted, onUpdated, ref, watch } from 'vue';

const markdownedFile = ref("");

const execFuncsExtension = {
  name: "execFunc",
  level: "block",
  start(src: string) {
    console.log(src);
    return src.match(/\{\{ \w+/)?.index;
  },
  tokenizer(src: string, tokens: any[]) {
    const rule = /^\{\{ \w+\(.*\) \}\}/;
    const match = rule.exec(src);

    if (match) {
      const formattedText = match[0].replace(/\{\{ /, "").replace(/ \}\}/, "").trim();
      
      const openBracket = formattedText.indexOf("(");
      const closeBracket = formattedText.lastIndexOf(")")

      console.log((openBracket - closeBracket));
      const args = (openBracket - closeBracket)  == -1 ? [] : formattedText.substring(openBracket + 1, closeBracket).split(",");

      const token = {
        type: 'execFunc',
        raw: match[0],
        text: formattedText,
        functionName: formattedText.substring(0, openBracket),
        tokens: args
      };

      return token;
    }
  },
  renderer(token) {
    window[token.functionName]();
    return "";
  }
}

const props = defineProps<{ content: string }>();

watch(() => props.content, (newContent, oldContent) => {
  insertHTML();
}, { immediate: false })

marked.use({ extensions: [execFuncsExtension] });
// marked.use({ walkTokens })

onMounted(() => insertHTML());

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