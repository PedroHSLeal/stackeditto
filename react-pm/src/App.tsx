import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import type { CustomDirectory, CustomFile } from "@/models/file-system";
import { useFileSystem } from "@/services/file-system";
import { useFileSystemManipulation } from "@/services/file-system/utils";
import { EXTENSION_STRUCTURE, useUntrustedModules, useUntrustedScripts } from "@/services/untrusted-code-extensions";
import { getProsemirrorText } from "@/services/prosemirror";

import { MarkdownEditor } from "./editor/MarkdownEditor";
import { buildReactProsemirrorState } from "./editor/state";
import { TreeView, type TreeActions } from "./components/TreeView";
import { ExtensionPanel } from "./components/ExtensionPanel";
import { StatusBar } from "./components/StatusBar";
import { buildDemoStructure } from "./demo-workspace";
import { markMountStart, metrics } from "./metrics";

// Os mesmos serviços que o App.vue usa: nada de arquivo/árvore/extensão foi reescrito para o React.
const fsImpl = useFileSystemManipulation();
const { executeUntrustedScript } = useUntrustedScripts();
const { registerUntrustedModules } = useUntrustedModules();

type Backend = "physical" | "inMemory";

type Workspace = {
  backend: Backend;
  root: FileSystemDirectoryHandle;
  directory: CustomDirectory;
  configDirectory: CustomDirectory | null;
};

type Opened =
  | { path: string, file: CustomFile, kind: "markdown", state: EditorState }
  | { path: string, file: CustomFile, kind: "text", text: string };

const isMarkdown = (file: CustomFile) => file.extensionFile.toLowerCase() == "md";

export function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [dirty, setDirty] = useState<ReadonlySet<string>>(new Set());
  const [showExtensions, setShowExtensions] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  /** Conteúdo não salvo por caminho: o papel do services/opened-files no app Vue (que depende do Vue). */
  const unsaved = useRef(new Map<string, string>());
  const viewRef = useRef<EditorView | null>(null);
  const latest = useRef({ workspace, opened, dirty });
  latest.current = { workspace, opened, dirty };

  const markDirty = useCallback((path: string, isDirty: boolean) => {
    setDirty((current) => {
      if (current.has(path) == isDirty) return current;
      const next = new Set(current);
      if (isDirty) next.add(path); else next.delete(path);
      return next;
    });
  }, []);

  // ---- workspace -------------------------------------------------------------------------------

  async function rebuildTree(base: Pick<Workspace, "backend" | "root">) {
    // populateDirectory(false) do App.vue: relê a pasta inteira; os objetos da árvore mudam de identidade.
    const fs = base.backend == "physical" ? useFileSystem("physical") : useFileSystem("inMemory");
    const project = fsImpl.populateDirectory(await fs.buildDirectoryStructure(base.root));
    if (!project?.directory) return null;

    const next: Workspace = { ...base, directory: project.directory, configDirectory: project.applicationDirectory };
    setWorkspace(next);
    return next;
  }

  async function runExtensions(configDirectory: CustomDirectory) {
    // executeUntrustedScripts do App.vue (o .mjs aqui recebe o texto já lido, não o método File.text)
    const files = fsImpl.getAllFilesFromDirectory(configDirectory);
    await executeUntrustedScript(files.filter((f) => f.extensionFile == "js" && f.size > 0).map((f) => f.text()));
    registerUntrustedModules(await Promise.all(files.filter((f) => f.extensionFile == "mjs")
      .map(async (f) => ({ text: await f.text(), webkitRelativePath: f.webkitRelativePath }))));
  }

  async function openWorkspace(backend: Backend) {
    const root = backend == "physical"
      ? await useFileSystem("physical").openDirectory()
      : await useFileSystem("inMemory").openDirectory(buildDemoStructure());
    if (!root) return;

    unsaved.current.clear();
    setDirty(new Set());
    setOpened(null);
    viewRef.current = null;

    const next = await rebuildTree({ backend, root });
    if (next?.configDirectory) await runExtensions(next.configDirectory);
  }

  // ---- arquivos ---------------------------------------------------------------------------------

  /** Guarda o texto do arquivo aberto antes de trocar (o App.vue serializa sempre; aqui só se mudou). */
  async function stashOpened() {
    const { opened, dirty } = latest.current;
    if (!opened || !dirty.has(opened.path) || opened.kind != "markdown" || !viewRef.current) return;

    const started = performance.now();
    unsaved.current.set(opened.path, await getProsemirrorText(viewRef.current));
    metrics.set({ serializeMs: performance.now() - started });
  }

  async function openFile(file: CustomFile) {
    if (latest.current.opened?.path == file.webkitRelativePath) return;

    setBusy(`abrindo ${file.name}…`);

    try {
      await stashOpened();

      const path = file.webkitRelativePath;
      const text = unsaved.current.get(path) ?? await file.text();

      if (isMarkdown(file)) {
        const state = await buildReactProsemirrorState(text);
        viewRef.current = null;
        markMountStart();
        setOpened({ path, file, kind: "markdown", state });
      } else {
        setOpened({ path, file, kind: "text", text });
      }
    } catch (error) {
      console.error(error);
      alert(`Não foi possível abrir ${file.name}: ${error}`);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    const { opened, workspace } = latest.current;
    if (!opened || !workspace) return;

    const started = performance.now();
    const content = opened.kind == "markdown"
      ? await getProsemirrorText(viewRef.current!)
      : unsaved.current.get(opened.path) ?? opened.text;
    metrics.set({ serializeMs: performance.now() - started });

    await fsImpl.saveFile(opened.file.handle, content);
    unsaved.current.delete(opened.path);
    markDirty(opened.path, false);

    // Os File da árvore são fotos do disco: relê para a próxima abertura não pegar conteúdo antigo.
    const next = await rebuildTree(workspace);
    const fresh = next && fsImpl.findFileHandler(next.directory, opened.path);
    if (fresh) setOpened((current) => current && current.path == opened.path ? { ...current, file: fresh } : current);
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() == "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function closeIfOpened(path: string) {
    unsaved.current.delete(path);
    markDirty(path, false);
    if (latest.current.opened?.path == path || latest.current.opened?.path.startsWith(`${path}/`)) {
      setOpened(null);
      viewRef.current = null;
    }
  }

  function parentOf(directory: CustomDirectory): CustomDirectory | undefined {
    const root = latest.current.workspace!.directory;
    const segments = directory.webkitRelativePath.split("/").slice(0, -1);
    return segments.length == 1 ? root : fsImpl.findDirectoryHandler(root, segments.join("/"));
  }

  const treeActions: TreeActions = {
    openFile: (file) => void openFile(file),
    async newFile(directory) {
      const name = prompt("Nome do novo arquivo", "nova-nota.md");
      if (!name) return;
      await fsImpl.createNewFile(directory.handle, name, "");
      await rebuildTree(latest.current.workspace!);
    },
    async newDirectory(directory) {
      const name = prompt("Nome da nova pasta", "nova-pasta");
      if (!name) return;
      await fsImpl.createNewDirectory(directory.handle, name);
      await rebuildTree(latest.current.workspace!);
    },
    async renameFile(file) {
      const name = prompt("Novo nome", file.name);
      if (!name || name == file.name) return;
      const content = unsaved.current.get(file.webkitRelativePath) ?? await (await file.handle.getFile()).text();
      await fsImpl.renameFile(file.directoryHandle, file.name, name, content);
      closeIfOpened(file.webkitRelativePath);
      await rebuildTree(latest.current.workspace!);
    },
    async deleteFile(file) {
      if (!confirm(`Excluir ${file.name}?`)) return;
      await fsImpl.deleteFile(file.directoryHandle, file.name);
      closeIfOpened(file.webkitRelativePath);
      await rebuildTree(latest.current.workspace!);
    },
    async deleteDirectory(directory) {
      if (!confirm(`Excluir a pasta ${directory.handle.name} e tudo dentro dela?`)) return;
      const parent = parentOf(directory);
      if (!parent) return;
      // A pasta-mãe certa (o App.vue passa a raiz: docs/code-review.md, exclusão aninhada).
      await fsImpl.deleteDirectory(parent.handle, directory.handle, true);
      closeIfOpened(directory.webkitRelativePath);
      await rebuildTree(latest.current.workspace!);
    },
  };

  // ---- extensões --------------------------------------------------------------------------------

  async function createExtensionFolder() {
    const ws = latest.current.workspace!;
    const folder = await fsImpl.createNewDirectory(ws.root, EXTENSION_STRUCTURE.EXTENSION_FOLDER);
    await fsImpl.createNewFile(folder, EXTENSION_STRUCTURE.INDEX__JS.fileName, EXTENSION_STRUCTURE.INDEX__JS.content);
    await rebuildTree(ws);
  }

  async function saveExtension(file: CustomFile, content: string) {
    await fsImpl.saveFile(file.handle, content);
    const next = await rebuildTree(latest.current.workspace!);
    if (next?.configDirectory) await runExtensions(next.configDirectory);

    // Os blocos HTML só chamam init() ao serem criados: reabre o arquivo atual para aplicar a extensão nova.
    const current = latest.current.opened;
    if (current?.kind == "markdown" && next) {
      await stashOpened();
      const fresh = fsImpl.findFileHandler(next.directory, current.path);
      setOpened(null);
      if (fresh) await openFile(fresh);
    }
  }

  // ---- tela -------------------------------------------------------------------------------------

  const onEditorReady = useCallback((view: EditorView) => { viewRef.current = view; }, []);
  const openedPath = opened?.path ?? null;
  const onDocChanged = useCallback(() => { if (openedPath) markDirty(openedPath, true); }, [openedPath, markDirty]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 12px", borderBottom: "1px solid #eee", background: "#faf7fc" }}>
        <strong style={{ marginRight: 8 }}>Stackeditto · react-prosemirror <small style={{ color: "#999" }}>(experimento)</small></strong>
        <button className="primary" onClick={() => void openWorkspace("physical")}>Abrir pasta</button>
        <button className="secondary" onClick={() => void openWorkspace("inMemory")}>Workspace demo</button>
        {workspace && <button className="primary" disabled={!opened} onClick={() => void save()}>Salvar (Ctrl+S)</button>}
        {workspace && <button className="secondary" onClick={() => setShowExtensions(!showExtensions)}>Extensões</button>}
        {busy && <span style={{ color: "#999", fontSize: 12 }}>{busy}</span>}
      </header>

      {!workspace ? (
        <Welcome />
      ) : (
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          <aside style={{ width: 300, borderRight: "1px solid #eee", overflow: "auto" }}>
            <TreeView root={workspace.directory} openedPath={openedPath} dirty={dirty} actions={treeActions} />
          </aside>

          <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {showExtensions && (
              <ExtensionPanel
                configDirectory={workspace.configDirectory}
                onCreate={createExtensionFolder}
                onSave={saveExtension}
                onClose={() => setShowExtensions(false)}
              />
            )}

            {opened?.kind == "markdown" && (
              <MarkdownEditor key={opened.path} state={opened.state} onReady={onEditorReady} onDocChanged={onDocChanged} />
            )}

            {opened?.kind == "text" && (
              <textarea
                key={opened.path}
                defaultValue={opened.text}
                spellCheck={false}
                style={{ flex: 1, border: 0, padding: 12, resize: "none", outline: "none", fontSize: 13 }}
                onChange={(event) => { unsaved.current.set(opened.path, event.target.value); markDirty(opened.path, true); }}
              />
            )}

            {!opened && <p style={{ color: "#999", padding: 24 }}>Escolha um arquivo na árvore.</p>}
          </main>
        </div>
      )}

      <StatusBar opened={opened?.kind == "markdown" ? opened.path : null} />
    </div>
  );
}

function Welcome() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: 560, lineHeight: 1.6 }}>
        <h2>Mesmo editor, outro renderizador</h2>
        <p>
          Este módulo é uma versão simplificada do Stackeditto em <b>React</b>, com o documento renderizado pelo{" "}
          <b>@handlewithcare/react-prosemirror</b> em vez do <code>EditorView</code> do prosemirror-view.
          Sistema de arquivos, parser markdown, schema, plugins, bloco HTML e extensões são os mesmos de <code>src/</code>.
        </p>
        <p><b>Abrir pasta</b> usa a File System Access API (Chrome/Edge). <b>Workspace demo</b> abre um workspace em memória com exemplos e arquivos grandes.</p>
      </div>
    </div>
  );
}
