<template>
  <div ref="workspace" id="workspace-tab" style="position: relative; height: inherit; background-color: var(--terciary); display: flex; flex-direction: column; gap: 20px; padding: 0px 4px 4px;">
    <div v-if="openedFiles.length > 0" style="flex: 0 0 auto; display: flex; flex-direction: column; max-height: 30%; overflow: auto">
      <span style="display: flex; align-items: center; cursor: default">
        <Icon width="19" height="19" icon="material-symbols:arrow-downward-alt-rounded" />
        Arquivos abertos
      </span>
      <div class="fancy-scroll" style="background-color: var(--secondary); border-radius: 4px; padding: 4px 0 4px 4px; overflow: auto">
        <template v-for="fileName of openedFiles">
          <FileItem :fileName="fileName.split('/').pop()!" @clicked="emits('onSelectOpenedFile', fileName)" />
        </template>
      </div>
    </div>
    <div v-if="workspace" style="flex: 1 1 auto; display: flex; flex-direction: column; height: 100%; overflow: auto;">
      <p style="margin: 0px; display: flex; align-items: center; cursor: default">
        <Icon width="19" height="19" icon="material-symbols:arrow-downward-alt-rounded" />
        Workspace
      </p>
      <TreeView
        @onSelectDirectory="(d) => emits('onSelectDirectory', d)"
        @onSelectFile="(f) => emits('onSelectFile', f)"
        @contextMenu="showContextMenu"
        :directory="workspaceData"
        class="fancy-scroll"
        style="background-color: var(--secondary); border-radius: 4px; padding: 4px 0 4px 4px; overflow: auto" />
    </div>
    <Transition name="menu">
      <div v-if="showMenu" :style="{ top: `${mouseCoordinates.y}px`, left: `${mouseCoordinates.x}px` }" style="position: absolute; background-color: lightgray">
        <div v-if="menuType == 'directory'" style="display: flex; flex-direction: column; padding: 5px;">
          <div style="display: flex; flex-direction: column; gap: 5px">
            <button @click="emits('menuAction', 'newFile', menuResource!)">Novo arquivo</button>
            <button @click="emits('menuAction', 'newDirectory', menuResource!)">Nova pasta</button>
          </div>
          <hr style="width: 100%">
          <button @click="emits('menuAction', 'renameDirectory', menuResource!)">Renomear pasta</button>
          <hr style="width: 100%">
          <button @click="emits('menuAction', 'deleteDirectory', menuResource!)">Excluir pasta</button>
        </div>
        <div v-else-if="menuType == 'file'" style="display: flex; flex-direction: column; padding: 5px;">
          <button @click="emits('menuAction', 'renameFile', menuResource!)">Renomear arquivo</button>
          <hr style="width: 100%">
          <button @click="emits('menuAction', 'deleteFile', menuResource!)">Excluir arquivo</button>
        </div>
      </div>
    </Transition>
  </div>

</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import TreeView from './TreeView/TreeView.vue';

import type { CustomDirectory, CustomFile } from '@/models/file';
import FileItem from "./TreeView/FileItem.vue";
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue";
import type { MenuAction } from "@/models/workspace";

const workspace = useTemplateRef("workspace");

const showMenu = ref(false);
const menuType = ref("");
const mouseCoordinates = ref({ x: 0, y: 0 });
const menuResource = ref<CustomDirectory | CustomFile>();

defineProps<{ openedFiles: string[], workspaceData: CustomDirectory | null }>();

const emits = defineEmits<{
  (e: "onSelectDirectory", directory: CustomDirectory): void,
  (e: "onSelectFile", file: CustomFile): void,
  (e: "onSelectOpenedFile", openedFile: string): void,
  (e: "menuAction", type: MenuAction, resource: CustomDirectory | CustomFile): void,
}>();

onMounted(() => {
  workspace.value?.addEventListener("contextmenu", (e) => {
    e.stopPropagation();
    e.preventDefault();
  });

  attachClickOutsideEvent();
})

onBeforeUnmount(() => {
  detachClickOutsideEvent();
})

function showContextMenu(type: "directory" | "file", resource: CustomDirectory | CustomFile, position: { x: number, y: number }) {
  menuType.value = type;
  menuResource.value = resource;
  mouseCoordinates.value = { ...position };
  showMenu.value = true;
}

function hideMenu(evt: Event) {
  showMenu.value = false;
}

function attachClickOutsideEvent() {
  ["click", "dblclick", "contextmenu"].forEach((e) => document.body.addEventListener(e, hideMenu));
}

function detachClickOutsideEvent() {
  ["click", "dblclick", "contextmenu"].forEach((e) => document.body.removeEventListener(e, hideMenu));
}
</script>
<style scoped lang="scss">
.menu-enter-active,
.menu-leave-active {
  transition: opacity 0.5s ease;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
}
</style>