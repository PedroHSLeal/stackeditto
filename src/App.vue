<template>
  <div id="app-container">
    <Topbar v-if="anyApplication" :style="{ height: `${TOPBAR_HEIGHT_IN_PIXELS}px` }" style="flex: 0 0 auto">
      <button v-if="anyApplication" @click="showWorkspace = !showWorkspace" :style="{ backgroundColor: showWorkspace ? 'var(--terciary)' : '' }" style="display: inline-flex; align-items: center; justify-content: center">
        <Icon width="16" height="16" icon="material-symbols:menu-rounded" />
      </button>

      <DropdownMenu>
        <template #trigger-button="{ showModalFn, modal }">
          <button @click="showModalFn" style="display: flex; gap: 4px; align-items: center; justify-content: center">
            Projeto
            <Icon width="16" height="16" :icon="modal ? 'material-symbols:arrow-drop-up-rounded' : 'material-symbols:arrow-drop-down-rounded'" />
          </button>
        </template>
        <template #dropdown="{ showModalFn }">
          <button v-if="!anyApplication" @click="() => { populateDirectory(); showModalFn() }">Abrir Workspace</button>
          <button v-if="anyApplication" @click="() => { populateDirectory(false); showModalFn() }">Recarregar Workspace</button>
          <button v-if="anyApplication" @click="() => { showNewResourceModal(ModalOperation.DIRECTORY, store.$state.directory!, false); showModalFn() }">Nova Pasta</button>
          <button v-if="anyApplication" @click="() => { showNewResourceModal(ModalOperation.FILE, store.$state.directory!, false); showModalFn() }">Novo Arquivo</button>
          <button v-if="anyApplication && !isMobile" @click="() => { showOrCreateExtension(); showModalFn() }">Extensoes</button>
        </template>
      </DropdownMenu>

      <DropdownMenu v-if="anyApplication">
        <template #trigger-button="{ showModalFn, modal }">
          <button @click="showModalFn" style="display: flex; gap: 4px; align-items: center; justify-content: center">
            Arquivo
            <Icon width="16" height="16" :icon="modal ? 'material-symbols:arrow-drop-up-rounded' : 'material-symbols:arrow-drop-down-rounded'" />
          </button>
        </template>
        <template #dropdown="{ showModalFn }">
          <button @click="() => { saveFile(); showModalFn() }">Salvar Arquivo</button>
          <!-- TODO: salvar todas as alteracoes no opened files -->
        </template>
      </DropdownMenu>
    </Topbar>

    <div id="widgets" :style="{ height: widgetHeight }" style="display: flex">
      <Workspace v-if="showWorkspace" @onSelectDirectory="selectDirectory" @onSelectFile="openFile" @onSelectOpenedFile="reopenFile" @menuAction="triggerMenuAction" :openedFiles="openedFiles" :workspaceData="store.$state.directory" :style="{ width: `${WORKSPACE_WIDTH_IN_PIXELS}px` }" style="flex-shrink: 0;" />
      <Welcome v-if="!anyApplication" @action="triggerWelcomeAction" style="flex-grow: 1" />
      <div v-if="anyApplication && fileValue" :style="{ width: editorWidth }" class="fancy-scroll" style="overflow: auto">
        <Editor :value="fileValue" />
      </div>
    </div>

    <ExtensionModal v-if="showExtension && !isMobile" :extensionFolder="store.$state.configDirectory!" @onNewResource="(op) => showNewResourceModal(op, store.$state.configDirectory!, false)" @onConfirm="reloadDirectoryStructure" @onClose="() => showExtension = false" />
    <NewFileOrDirectoryModal v-if="showNewResource" :workspace="newResourceWorkspace!" :operation="newResourceOperation!" @onConfirm="saveNewFileOrDirectory" @onCancel="showNewResource = false" />
    <RenameResourceModal v-if="showRenameResource" :resourceName="renameResourceName" :operation="renameResourceOperation!" @onConfirm="renameResource" @onCancel="() => showRenameResource = false" />
    <DeleteResourceModal v-if="showDeleteResource" :operation="deleteResourceOperation!" @onConfirm="deleteResource" @onCancel="() => showDeleteResource = false" />

    <Transition>
      <LoadingModal v-if="showLoading" />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';

import { Icon } from "@iconify/vue";
import { useMediaQuery } from "@vueuse/core";

import Workspace from './components/Workspace.vue';
import Topbar from './components/Topbar.vue';
import ExtensionModal from './components/modals/ExtensionModal.vue';
import NewFileOrDirectoryModal from './components/modals/NewFileOrDirectoryModal.vue';
import RenameResourceModal from './components/modals/RenameResourceModal.vue';
import DeleteResourceModal from './components/modals/DeleteResourceModal.vue';
import LoadingModal from './components/modals/LoadingModal.vue';
import DropdownMenu from './components/DropdownMenu.vue';
import Editor from './components/Editor.vue';
import Welcome from './components/Welcome.vue';

import type { CustomDirectory, CustomFile } from './models/file-system';
import { ModalOperation } from './models/file-system';

import { useFileSystem } from './services/file-system';

import { EXTENSION_STRUCTURE, useUntrustedScripts, useUntrustedModules } from '@/services/untrusted-code-extensions';

import { useFileSystemStore } from './store/file-system';
import { getProsemirrorText } from './services/prosemirror';
import { useOpenFiles } from './services/opened-files';
import { type Value } from './services/markdown/remark';

import type { MenuAction } from './models/workspace';
import type { WelcomeAction } from './models/welcome';

const of = useOpenFiles();
const fs = useFileSystem();
const { executeUntrustedScript } = useUntrustedScripts();
const { registerUntrustedModules } = useUntrustedModules();
const store = useFileSystemStore();
const isMobile = useMediaQuery("(max-width: 560px)");

const TOPBAR_HEIGHT_IN_PIXELS = 32;
const WORKSPACE_WIDTH_IN_PIXELS = 350;

const editorWidth = computed(() => showWorkspace.value ? `calc(100% - ${WORKSPACE_WIDTH_IN_PIXELS}px)` : `100%`);
const widgetHeight = `calc(100vh - ${TOPBAR_HEIGHT_IN_PIXELS}px)`;

const anyApplication = computed(() => store.$state.originalHandler != null);

const selectedDirectory = shallowRef<CustomDirectory | null>(null);

const fileKey = shallowRef<string>("");
const fileValue = shallowRef<CustomFile>();

const openedFiles = computed(() => of.getOpenedFiles().value);

const showWorkspace = ref<boolean>(false);
const showExtension = ref<boolean>(false);
const showEditor = ref<boolean>(false);
const showLoading = ref<boolean>(false);

const showRenameResource = ref<boolean>(false);
const renameResourceName = ref("");
const renameResourceOperation = ref<ModalOperation | null>(null);

const showDeleteResource = ref<boolean>(false);
const deleteResourceOperation = ref<ModalOperation | null>(null);

const showNewResource = ref<boolean>(false);
const newResourceWorkspace = shallowRef<CustomDirectory | null>(null);
const newResourceOperation = ref<ModalOperation | null>(null);

let resourceActionData: CustomDirectory | CustomFile | null = null;

onMounted(() => { });

async function populateDirectory(openDirectoryPicker = true) {
  if (openDirectoryPicker) {
    store.$patch({ originalHandler: await fs.openDirectory() });
  }

  const directoryStructure = await fs.buildDirectoryStructure(store.$state.originalHandler!);
  const project = fs.populateDirectory(directoryStructure);

  if (!project) return;

  store.$patch({
    directory: project.directory,
    configDirectory: project.applicationDirectory
  });

  if (project.applicationDirectory)
    await executeUntrustedScripts();

  showWorkspace.value = true;
  showEditor.value = true;
}

async function executeUntrustedScripts() {
  let userUntrustedFiles = fs.getAllFilesFromDirectory(store.$state.configDirectory!);

  let userUntrustedModules = userUntrustedFiles.filter(file => file.name.endsWith(".mjs"))
    .map(({ text, webkitRelativePath }) => ({ text: text, webkitRelativePath }));

  let userUntrustedScripts = userUntrustedFiles.filter(file => file.name.endsWith(".js"))
    .filter(f => f.size > 0)
    .map(file => file.text());

  await executeUntrustedScript(userUntrustedScripts);
  await registerUntrustedModules(userUntrustedModules);
}

async function saveFile() {
  fs.saveFile(of.getLastOpenedFile()!.handler, await getProsemirrorText());
}

async function reloadDirectoryStructure() {
  await populateDirectory(false);
}

async function showOrCreateExtension() {
  if (!store.$state.configDirectory) {
    const configDirectory = await fs.createNewDirectory(store.$state.originalHandler!, EXTENSION_STRUCTURE.EXTENSION_FOLDER);
    await fs.createNewFile(configDirectory, EXTENSION_STRUCTURE.INDEX__JS.fileName, EXTENSION_STRUCTURE.INDEX__JS.content);
    await populateDirectory(false);
  }

  showExtension.value = true;
}

async function showNewResourceModal(operation: ModalOperation, defaultDir: CustomDirectory, isChosenDir: boolean) {
  newResourceWorkspace.value = isChosenDir ? selectedDirectory.value : defaultDir;
  newResourceOperation.value = operation;
  showNewResource.value = true;
}

async function showRenameResourceModal(operation: ModalOperation, priorResourceName: string) {
  renameResourceName.value = priorResourceName;
  renameResourceOperation.value = operation;
  showRenameResource.value = true;
}

async function showDeleteResourceModal(operation: ModalOperation) {
  deleteResourceOperation.value = operation;
  showDeleteResource.value = true;
}

async function selectDirectory(directory: CustomDirectory) {
  if (isMobile.value) {
    showWorkspace.value = false;
  }

  selectedDirectory.value = directory;
}

async function saveTemporaryChangesInFile(fileHandle: FileSystemFileHandle, fileRelativePath: string, contentToSave: Value) {
  of.setLastOpenedFile(fileHandle, contentToSave);
  of.setFile(fileRelativePath, fileHandle, contentToSave);
}

async function openFile(fileInWorkspace: CustomFile) {
  if (isMobile.value) {
    showWorkspace.value = false;
  }

  if (of.hasFile(fileInWorkspace.webkitRelativePath))
    await saveTemporaryChangesInFile(of.getLastOpenedFile()!.handler, fileKey.value, await getProsemirrorText());
  else
    await saveTemporaryChangesInFile(fileInWorkspace.handle, fileInWorkspace.webkitRelativePath, await fileInWorkspace.text());

  fileKey.value = fileInWorkspace.webkitRelativePath;
  fileValue.value = fileInWorkspace;
}

async function reopenFile(openedFileRelativePath: string) {
  if (isMobile.value) {
    showWorkspace.value = false;
  }

  let viewTextContent = await getProsemirrorText();

  of.updateFile(fileKey.value, viewTextContent);

  fileKey.value = openedFileRelativePath;

  let customFile = fs.findFileHandler(store.$state.directory!, openedFileRelativePath);

  fileValue.value = customFile;
}

function triggerWelcomeAction(type: WelcomeAction) {
  switch (type) {
    case 'tour':
      /* navigator.storage.getDirectory().then((dir) => {
        store.$patch({ originalHandler: dir });

        showWorkspace.value = true;
        showEditor.value = true;
      }); */
      break;
    case 'openWorkspace':
      break;
    default:
      break;
  }
}

async function triggerMenuAction(type: MenuAction, resource: CustomDirectory | CustomFile) {
  switch (type) {
    case 'newFile':
      showNewResourceModal(ModalOperation.FILE, (resource as CustomDirectory), false);
      break;
    case 'newDirectory':
      showNewResourceModal(ModalOperation.DIRECTORY, (resource as CustomDirectory), false);
      break;
    case 'renameFile':
      showRenameResourceModal(ModalOperation.FILE, resource.handle.name);
      break;
    case 'renameDirectory':
      showRenameResourceModal(ModalOperation.DIRECTORY, resource.handle.name);
      break;
    case 'deleteFile':
      showDeleteResourceModal(ModalOperation.FILE);
      break;
    case 'deleteDirectory':
      showDeleteResourceModal(ModalOperation.DIRECTORY);
      break;
    default:
      break;
  }

  resourceActionData = resource;
}

async function saveNewFileOrDirectory(directory: CustomDirectory, operation: ModalOperation, name: string) {
  if (!directory.handle) return;

  if (operation == ModalOperation.FILE) await fs.createNewFile(directory.handle, name, "");
  else if (operation == ModalOperation.DIRECTORY) await fs.createNewDirectory(directory.handle, name);

  await populateDirectory(false);

  showNewResource.value = false;

  await reloadDirectoryStructure();
}

async function renameResource(operation: ModalOperation, newResourceName: string) {
  if (resourceActionData?.handle.name == newResourceName) return;

  if (resourceActionData) {
    if (operation == ModalOperation.FILE) {
      let fileHandle = of.hasFile(resourceActionData.webkitRelativePath)
        ? of.getFile(resourceActionData.webkitRelativePath)!.handler
        : (resourceActionData as CustomFile).handle;

      await fs.renameFile((resourceActionData as CustomFile).directoryHandle, (resourceActionData as CustomFile).name, newResourceName, await (await fileHandle.getFile()).text());
    }
    else if (operation == ModalOperation.DIRECTORY) {
      showLoading.value = true;

      let parentResourceRelativePath = resourceActionData.webkitRelativePath.split("/").slice(0, -1);

      let parentDirectory = parentResourceRelativePath.length == 1 && store.$state.directory?.webkitRelativePath == parentResourceRelativePath[0]
        ? store.$state.directory
        : fs.findDirectoryHandler(store.$state.directory!, parentResourceRelativePath.join("/"));

      let oldDirectoryToDelete = fs.findDirectoryHandler(store.$state.directory!, resourceActionData.webkitRelativePath);

      await fs.renameDirectory(parentDirectory!.handle, (resourceActionData as CustomDirectory).handle, newResourceName);

      await reloadDirectoryStructure();

      if (oldDirectoryToDelete)
        await fs.deleteDirectory(parentDirectory!.handle, oldDirectoryToDelete.handle, true);

      showLoading.value = false;
    }
  }

  showRenameResource.value = false;

  await reloadDirectoryStructure();
}

async function deleteResource(operation: ModalOperation) {
  if (resourceActionData) {
    if (operation == ModalOperation.FILE) {
      await fs.deleteFile((resourceActionData as CustomFile).directoryHandle, (resourceActionData as CustomFile).name);

      of.deleteFile(resourceActionData.webkitRelativePath);

      if (fileKey.value == resourceActionData.webkitRelativePath) {
        fileKey.value = "";
        fileValue.value = undefined;
      }
    }
    else if (operation == ModalOperation.DIRECTORY) {
      await fs.deleteDirectory(store.$state.originalHandler!, (resourceActionData as CustomDirectory).handle, true);
    }
  }

  showDeleteResource.value = false;

  await reloadDirectoryStructure();
}

</script>

<style scoped lang="scss">
#app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100vw;
}
</style>