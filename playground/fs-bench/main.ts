import {
  DEFAULT_OPTIONS, FIXTURE_DIR, HEAD_BYTES, SIZES, STAGES,
  chunksOf, fixtureSpec, plan, singleFilePath, toMarkdown, workspaceLayout,
  type Case, type CaseResult, type PlanOptions, type Sample, type Subject,
} from "./shared";

/**
 * Page half of the File System Access benchmark; scripts/fs-bench/run.mjs drives it headless
 * (OPFS + a folder dropped through CDP), and the buttons below run it by hand with the real
 * showDirectoryPicker(), which no automation can click through.
 */
declare global {
  interface Window {
    __fsb: typeof api;
  }
}

const roots: Partial<Record<Subject, FileSystemDirectoryHandle>> = {};

// ---------------------------------------------------------------- handles

async function opfsRoot() {
  return (await navigator.storage.getDirectory()).getDirectoryHandle(FIXTURE_DIR, { create: true });
}

async function dirOf(root: FileSystemDirectoryHandle, path: string, create = false) {
  let dir = root;
  for (const part of path.split("/").slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create });
  return dir;
}

async function fileOf(root: FileSystemDirectoryHandle, path: string, create = false) {
  return (await dirOf(root, path, create)).getFileHandle(path.split("/").at(-1)!, { create });
}

async function canWrite(root: FileSystemDirectoryHandle) {
  return (await (root as any).queryPermission({ mode: "readwrite" })) == "granted";
}

async function* walkFiles(dir: FileSystemDirectoryHandle): AsyncGenerator<FileSystemFileHandle> {
  for await (const entry of (dir as any).values() as AsyncIterable<FileSystemHandle>) {
    if (entry.kind == "file") yield entry as FileSystemFileHandle;
    else yield* walkFiles(entry as FileSystemDirectoryHandle);
  }
}

// ---------------------------------------------------------------- worker (sync access handles)

let worker: Worker | undefined;
let nextId = 0;
const pending = new Map<number, (value: any) => void>();

function callWorker(message: Record<string, unknown>, transfer: Transferable[] = []): Promise<any> {
  if (!worker) {
    worker = new Worker(new URL("./opfs-worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => { pending.get(data.id)?.(data); pending.delete(data.id); };
  }

  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    worker!.postMessage({ ...message, id }, transfer);
  });
}

// ---------------------------------------------------------------- fixtures

async function prepare(subject: Subject, options: PlanOptions) {
  const root = roots[subject];
  if (!root) throw new Error(`subject "${subject}" nao esta aberto`);

  const started = performance.now();
  const writable = subject != "local" && await canWrite(root);
  let written = 0, reused = 0;

  for (const { path, bytes } of fixtureSpec(options)) {
    try {
      const file = await (await fileOf(root, path)).getFile();
      if (file.size == bytes) { reused++; continue; }
    } catch { /* missing */ }

    if (!writable) throw new Error(`fixture ${path} ausente ou com tamanho errado e o handle de ${subject} nao pode escrever`);

    const handle = await fileOf(root, path, true);
    const stream = await handle.createWritable();
    for (const chunk of chunksOf(bytes)) await stream.write(chunk);
    await stream.close();
    written++;
  }

  return { written, reused, ms: Math.round(performance.now() - started) };
}

// ---------------------------------------------------------------- measurements

type ReadMethod = (typeof import("./shared").READ_METHODS)[number];

async function readOnce(handle: FileSystemFileHandle, method: ReadMethod): Promise<Sample> {
  const started = performance.now();
  const file = await handle.getFile();
  const gotFile = performance.now();
  let bytes = 0, chunks = 0, firstChunkBytes: number | undefined, firstDataMs: number | null = null;

  const pump = async (reader: ReadableStreamDefaultReader<Uint8Array | string>, stopAt = Infinity) => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (firstDataMs == null) { firstDataMs = performance.now() - started; firstChunkBytes = value.length; }
      chunks++;
      bytes += value.length;
      if (bytes >= stopAt) { await reader.cancel(); break; }
    }
  };

  switch (method) {
    case "getFile": bytes = file.size; break;
    case "text": bytes = (await file.text()).length; break;
    case "arrayBuffer": bytes = (await file.arrayBuffer()).byteLength; break;
    case "stream": await pump(file.stream().getReader()); break;
    case "stream-text": {
      // Same output as text(): the whole decoded string.
      const parts: string[] = [];
      const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (firstDataMs == null) { firstDataMs = performance.now() - started; firstChunkBytes = value.length; }
        chunks++;
        parts.push(value);
      }
      bytes = parts.join("").length;
      break;
    }
    case "stream-head": await pump(file.stream().getReader(), HEAD_BYTES); break;
    case "slice-head": bytes = (await file.slice(0, HEAD_BYTES).text()).length; break;
    default: throw new Error(`metodo desconhecido: ${method}`);
  }

  const ms = performance.now() - started;
  return { ms, getFileMs: gotFile - started, firstDataMs: method == "getFile" ? null : firstDataMs ?? ms, bytes, chunks: chunks || undefined, firstChunkBytes };
}

async function repeatSamples(c: Case, once: () => Promise<Sample>) {
  await once(); // warm-up: first touch of the file, worker start, lazy imports
  const samples: Sample[] = [];
  for (let i = 0; i < c.repeat; i++) samples.push(await once());
  return samples;
}

async function readFile(c: Case, root: FileSystemDirectoryHandle): Promise<Partial<CaseResult>> {
  const path = singleFilePath(c.size!);

  if (c.method == "sync-access") {
    return {
      samples: await repeatSamples(c, async () => {
        const reply = await callWorker({ type: "read", path });
        if (!reply.ok) throw new Error(reply.error);
        return reply.sample;
      }),
    };
  }

  const handle = await fileOf(root, path);
  return { samples: await repeatSamples(c, () => readOnce(handle, c.method as ReadMethod)) };
}

async function readWorkspace(c: Case, root: FileSystemDirectoryHandle): Promise<Partial<CaseResult>> {
  const workspace = await root.getDirectoryHandle("workspace");
  const handles: FileSystemFileHandle[] = [];
  for await (const handle of walkFiles(workspace)) handles.push(handle);

  const consume = async (handle: FileSystemFileHandle, stream: boolean) => {
    const file = await handle.getFile();
    if (!stream) return (await file.text()).length;
    let bytes = 0;
    const reader = file.stream().getReader();
    for (;;) { const { done, value } = await reader.read(); if (done) return bytes; bytes += value.byteLength; }
  };

  const once = async (): Promise<Sample> => {
    const started = performance.now();
    let files = 0, bytes = 0;

    switch (c.method) {
      case "walk":
        for await (const _ of walkFiles(workspace)) files++;
        break;
      case "walk+getFile": {
        // What the app does: getFile() for every entry, concurrently, while walking.
        const pendingFiles: Promise<File>[] = [];
        for await (const handle of walkFiles(workspace)) pendingFiles.push(handle.getFile());
        const all = await Promise.all(pendingFiles);
        files = all.length;
        break;
      }
      case "app-getFiles": {
        const { useFileSystemManipulation } = await import("@/services/file-system/utils");
        const tree = await useFileSystemManipulation().getFiles(workspace, { webkitRelativePath: workspace.name, handle: workspace, directories: [], files: [] } as any);
        const count = (d: any): number => d.files.length + d.directories.reduce((sum: number, sub: any) => sum + count(sub), 0);
        files = count(tree);
        break;
      }
      case "text-seq":
      case "stream-seq":
        for (const handle of handles) bytes += await consume(handle, c.method == "stream-seq");
        files = handles.length;
        break;
      case "text-parallel":
      case "stream-parallel":
        bytes = (await Promise.all(handles.map((h) => consume(h, c.method == "stream-parallel")))).reduce((a, b) => a + b, 0);
        files = handles.length;
        break;
      default: throw new Error(`metodo desconhecido: ${c.method}`);
    }

    return { ms: performance.now() - started, bytes, files };
  };

  return { samples: await repeatSamples(c, once) };
}

async function write(c: Case, root: FileSystemDirectoryHandle): Promise<Partial<CaseResult>> {
  if (!(await canWrite(root))) return { status: "skipped", note: "sem permissao readwrite (handle de drag-and-drop e somente leitura; use o showDirectoryPicker)" };

  const bytes = SIZES[c.size!];
  const blob = new Blob([...chunksOf(bytes)], { type: "text/markdown" });
  const path = `scratch/escrita-${c.size}.md`;

  if (c.method == "sync-access") {
    return {
      samples: await repeatSamples(c, async () => {
        const data = await blob.arrayBuffer();
        const reply = await callWorker({ type: "write", path, data }, [data]);
        if (!reply.ok) throw new Error(reply.error);
        return reply.sample;
      }),
    };
  }

  const handle = await fileOf(root, path, true);
  return {
    samples: await repeatSamples(c, async () => {
      const started = performance.now();
      const stream = await handle.createWritable();
      if (c.method == "createWritable-stream") await blob.stream().pipeTo(stream);
      else { await stream.write(blob); await stream.close(); }
      return { ms: performance.now() - started, bytes };
    }),
  };
}

// ---------------------------------------------------------------- capabilities

const describe = (error: any) => `${error?.name ?? "Error"}: ${String(error?.message ?? error).slice(0, 120)}`;

async function attempt(fn: () => Promise<string>): Promise<string> {
  try { return await fn(); } catch (error) { return describe(error); }
}

async function capabilities(subject: Subject, root: FileSystemDirectoryHandle): Promise<Record<string, string>> {
  const checks: Record<string, string> = {};
  const writable = await canWrite(root);
  const smallPath = singleFilePath("4k");

  checks["raiz: kind / name"] = `${root.kind} / "${root.name}"`;
  checks["queryPermission read"] = await attempt(async () => (root as any).queryPermission({ mode: "read" }));
  checks["queryPermission readwrite"] = await attempt(async () => (root as any).queryPermission({ mode: "readwrite" }));

  const t0 = performance.now();
  const handle = await fileOf(root, smallPath);
  checks["lookup files/arquivo-4k.md (ms, frio)"] = (performance.now() - t0).toFixed(2);
  const t1 = performance.now();
  await fileOf(root, smallPath);
  checks["lookup files/arquivo-4k.md (ms, quente)"] = (performance.now() - t1).toFixed(2);

  const file = await handle.getFile();
  checks["File.type de .md"] = file.type || "(vazio)";
  checks["File.lastModified"] = file.lastModified ? new Date(file.lastModified).toISOString() : String(file.lastModified);
  checks["File instanceof File"] = String(file instanceof File);
  checks["root.resolve(arquivo)"] = await attempt(async () => JSON.stringify(await root.resolve(handle)));
  checks["isSameEntry (dois lookups)"] = await attempt(async () => String(await handle.isSameEntry(await fileOf(root, smallPath))));
  checks["createSyncAccessHandle (worker)"] = await attempt(async () => {
    const reply = await callWorker({ type: "probe", handle });
    return reply.ok ? "ok" : reply.error;
  });
  checks["handle.move / handle.remove"] = `${typeof (handle as any).move} / ${typeof (handle as any).remove}`;
  checks["FileSystemObserver"] = typeof (globalThis as any).FileSystemObserver;

  if (subject == "opfs") {
    checks["storage.persisted()"] = String(await navigator.storage.persisted());
    const estimate = await navigator.storage.estimate();
    checks["storage.estimate usage / quota (MB)"] = `${((estimate.usage ?? 0) / 1048576).toFixed(1)} / ${((estimate.quota ?? 0) / 1048576).toFixed(0)}`;
  }

  if (!writable) {
    checks["createWritable"] = "sem permissao readwrite";
    return checks;
  }

  const scratch = await fileOf(root, "scratch/caps.md", true);
  checks["createWritable"] = await attempt(async () => {
    const stream = await scratch.createWritable();
    await stream.write("versao 1\n");
    await stream.close();
    return "ok";
  });

  checks["entradas extras com writable aberto"] = await attempt(async () => {
    const dir = await root.getDirectoryHandle("scratch");
    const before = new Set<string>();
    for await (const name of (dir as any).keys() as AsyncIterable<string>) before.add(name);
    const stream = await scratch.createWritable();
    await stream.write("rascunho");
    const extra: string[] = [];
    for await (const name of (dir as any).keys() as AsyncIterable<string>) if (!before.has(name)) extra.push(name);
    await stream.abort();
    return extra.length ? extra.join(", ") : "nenhuma";
  });

  checks["createWritable({keepExistingData}) e write posicional"] = await attempt(async () => {
    const stream = await scratch.createWritable({ keepExistingData: true });
    await stream.write({ type: "write", position: 0, data: "V" });
    await stream.close();
    return JSON.stringify((await (await scratch.getFile()).text()).slice(0, 9));
  });

  checks["File antigo depois de escrever no arquivo"] = await attempt(async () => {
    const old = await scratch.getFile();
    await new Promise((resolve) => setTimeout(resolve, 20)); // mtime resolution
    const stream = await scratch.createWritable();
    await stream.write("versao 2, maior que a 1\n");
    await stream.close();
    return `le: ${JSON.stringify((await old.text()).slice(0, 12))}`;
  });

  return checks;
}

// ---------------------------------------------------------------- driver

async function run(c: Case): Promise<CaseResult> {
  const root = roots[c.subject];
  if (!root) return { ...c, status: "skipped", note: `subject ${c.subject} nao esta aberto` };

  try {
    if (c.stage == "capabilities") return { ...c, status: "ok", checks: await capabilities(c.subject, root) };
    const partial = c.stage == "read-file" ? await readFile(c, root)
      : c.stage == "read-workspace" ? await readWorkspace(c, root)
      : await write(c, root);
    return { ...c, status: "ok", ...partial };
  } catch (error) {
    return { ...c, status: "error", note: describe(error) };
  }
}

const api = {
  stages: STAGES,
  subjects: () => Object.keys(roots) as Subject[],
  async openOpfs() { roots.opfs = await opfsRoot(); },
  async openPicker() {
    const picked = await (window as any).showDirectoryPicker({ id: "fs-bench", mode: "readwrite" });
    roots.picker = await picked.getDirectoryHandle(FIXTURE_DIR, { create: true });
  },
  /** Throw away the OPFS fixtures (the runner uses a fresh profile instead). */
  async clearOpfs() { await (await navigator.storage.getDirectory()).removeEntry(FIXTURE_DIR, { recursive: true }); delete roots.opfs; },
  prepare,
  plan,
  run,
  toMarkdown,
  workspaceLayout,
};

window.__fsb = api;

// ---------------------------------------------------------------- manual UI

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const log = (line: string) => { $("#log").textContent += `${line}\n`; };

// A folder dropped on the page is the "local" subject: same backend as the picker, read-only.
document.addEventListener("dragover", (event) => event.preventDefault());
document.addEventListener("drop", async (event) => {
  event.preventDefault();
  const item = [...(event.dataTransfer?.items ?? [])].find((i) => i.kind == "file");
  const handle = await (item as any)?.getAsFileSystemHandle();
  if (handle?.kind != "directory") return log("solte uma pasta, nao um arquivo");
  roots.local = handle;
  document.body.dataset.local = "ready";
  log(`pasta solta: "${handle.name}" (subject local)`);
});

function readOptions(): PlanOptions {
  const stages = [...document.querySelectorAll<HTMLInputElement>("input[name=stage]:checked")].map((i) => i.value) as PlanOptions["stages"];
  const sizes = $<HTMLInputElement>("#sizes").value.split(",").map((s) => s.trim()).filter((s) => s in SIZES);
  return { ...DEFAULT_OPTIONS, stages, sizes, repeat: Number($<HTMLInputElement>("#repeat").value) || DEFAULT_OPTIONS.repeat, subjects: api.subjects() };
}

async function runAll() {
  const options = readOptions();
  const results: CaseResult[] = [];
  $("#report").textContent = "";

  for (const subject of options.subjects) {
    if (subject == "local") continue; // a dropped folder cannot be written: it must already hold the fixtures
    log(`preparando fixtures em ${subject}...`);
    log(`  ${JSON.stringify(await prepare(subject, options))}`);
  }

  const cases = plan(options);
  for (const [i, c] of cases.entries()) {
    const result = await run(c);
    results.push(result);
    log(`[${i + 1}/${cases.length}] ${c.id}: ${result.status}${result.note ? ` (${result.note})` : ""}`);
  }

  const markdown = toMarkdown({ date: new Date().toISOString(), browser: navigator.userAgent, options }, results);
  $("#report").textContent = markdown;
  $<HTMLButtonElement>("#copy").onclick = () => navigator.clipboard.writeText(JSON.stringify({ options, results }, null, 1));
}

$("#run-opfs").addEventListener("click", async () => {
  await api.openOpfs();
  await runAll();
});

$("#run-picker").addEventListener("click", async () => {
  await api.openPicker();
  await api.openOpfs();
  await runAll();
});

$<HTMLInputElement>("#sizes").value = "4k,64k,1m,8m,32m";
for (const stage of STAGES) {
  $("#stages").insertAdjacentHTML("beforeend", `<label><input type="checkbox" name="stage" value="${stage}" checked> ${stage}</label>`);
}
