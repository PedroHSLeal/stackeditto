<template>
  <Modal @click.self="emits('onClose')">
    <div id="first-steps" style="display: flex; flex-direction: column; height: 90%; width: min(900px, 94vw); background-color: white; border-radius: 10px; overflow: hidden">
      <Topbar style="height: 32px; flex: 0 0 auto">
        <span style="font-weight: 600">Primeiros Passos</span>
        <div style="margin-left: auto">
          <button @click="emits('onClose')" style="display: flex; align-items: center; justify-content: center; gap: 4px">
            <Icon width="14" height="14" icon="material-symbols:close-rounded" /> Fechar
          </button>
        </div>
      </Topbar>
      <article class="fancy-scroll document" v-html="html" style="flex: 1 1 auto; overflow: auto; padding: 8px 28px 28px"></article>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

import { Icon } from '@iconify/vue';

import Modal from '../Modal.vue';
import Topbar from '../Topbar.vue';

import { useFirstSteps } from '@/services/first-steps';

const emits = defineEmits<{ (e: "onClose"): void }>();

const html = useFirstSteps().renderHtml();

function closeOnEscape(ev: KeyboardEvent) {
  if (ev.key == "Escape") emits("onClose");
}

onMounted(() => document.addEventListener("keydown", closeOnEscape));
onBeforeUnmount(() => document.removeEventListener("keydown", closeOnEscape));
</script>

<style scoped lang="scss">
.document {
  line-height: 1.55;

  :deep(h1) { font-size: 30px; margin: 16px 0 8px; }
  :deep(h2) { font-size: 21px; margin: 32px 0 8px; padding-bottom: 4px; border-bottom: 1px solid var(--terciary); }

  :deep(img) {
    display: block;
    max-width: 100%;
    margin: 12px auto;
    border-radius: 8px;
    border: 1px solid lightgray;
  }

  :deep(blockquote) {
    margin: 12px 0;
    padding: 8px 14px;
    border-left: 4px solid var(--primary);
    background-color: var(--secondary);
    border-radius: 4px;

    p { margin: 0; }
  }

  :deep(code) {
    font-family: inherit;
    background-color: #f2f2f2;
    padding: 1px 4px;
    border-radius: 4px;
  }

  :deep(pre) {
    background-color: #f6f6f6;
    padding: 10px 12px;
    border-radius: 6px;
    overflow: auto;

    code { background: none; padding: 0; }
  }

  :deep(table) {
    border-collapse: collapse;
    margin: 8px 0;

    th, td { border: 1px solid lightgray; padding: 4px 10px; text-align: left; }
    th { background-color: var(--secondary); }
  }
}
</style>