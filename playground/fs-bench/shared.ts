// Shared by the page (playground/fs-bench/main.ts) and the Node runner (scripts/fs-bench/run.mjs),
// which imports this file directly through Node's type stripping: keep it free of enums,
// parameter properties and anything else that is not erasable TypeScript.

export const FIXTURE_DIR = "stackeditto-fs-bench";
export const HEAD_BYTES = 4096;

export const SIZES: Record<string, number> = {
  "4k": 4 * 1024,
  "64k": 64 * 1024,
  "1m": 1024 * 1024,
  "8m": 8 * 1024 * 1024,
  "32m": 32 * 1024 * 1024,
  "128m": 128 * 1024 * 1024,
};

/** Order matters: "only the first tests" means a prefix of this list. */
export const STAGES = ["capabilities", "read-file", "read-workspace", "write"] as const;
export type StageName = (typeof STAGES)[number];

/** opfs = navigator.storage.getDirectory(); picker = showDirectoryPicker(); local = folder dropped on the page (same local backend as the picker, read-only). */
export const SUBJECTS = ["opfs", "picker", "local"] as const;
export type Subject = (typeof SUBJECTS)[number];

export const READ_METHODS = ["getFile", "text", "arrayBuffer", "stream", "stream-text", "stream-head", "slice-head", "sync-access"] as const;
export const WORKSPACE_METHODS = ["walk", "walk+getFile", "app-getFiles", "text-seq", "text-parallel", "stream-seq", "stream-parallel"] as const;
export const WRITE_METHODS = ["createWritable", "createWritable-stream", "sync-access"] as const;

/** Methods that only exist for OPFS (FileSystemSyncAccessHandle, dedicated worker). */
export const OPFS_ONLY = new Set(["sync-access"]);

export type Case = {
  id: string;
  stage: StageName;
  subject: Subject;
  method?: string;
  size?: string;
  repeat: number;
};

export type Sample = {
  ms: number;
  getFileMs?: number;
  /** Time until the first byte is in JS hands; for text()/arrayBuffer() it is the whole read. */
  firstDataMs?: number | null;
  bytes: number;
  chunks?: number;
  firstChunkBytes?: number;
  files?: number;
};

export type CaseResult = Case & {
  status: "ok" | "skipped" | "error";
  note?: string;
  samples?: Sample[];
  checks?: Record<string, string>;
};

export type PlanOptions = {
  stages: StageName[];
  subjects: Subject[];
  sizes: string[];
  repeat: number;
  workspaceFiles: number;
};

export const DEFAULT_OPTIONS: PlanOptions = {
  stages: [...STAGES],
  subjects: ["opfs", "local"],
  sizes: Object.keys(SIZES),
  repeat: 5,
  workspaceFiles: 1000,
};

// ---------------------------------------------------------------- fixtures

const BLOCK = 64 * 1024;
const blocks = new Map<number, string>();

/** A 64 KB markdown-ish block, ASCII only so that bytes == characters and sizes are exact. */
export function block(index: number): string {
  const key = index % 8;
  let cached = blocks.get(key);

  if (!cached) {
    const lines: string[] = [];
    let length = 0;

    for (let i = 0; length < BLOCK; i++) {
      const line = i % 12 == 0
        ? `## Secao ${key}.${i}\n\n`
        : `- item ${i} do bloco ${key}: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor **incididunt** ut labore [link](./nota-${i}.md).\n`;
      lines.push(line);
      length += line.length;
    }

    cached = lines.join("").slice(0, BLOCK);
    blocks.set(key, cached);
  }

  return cached;
}

/** The content of a fixture of `bytes` bytes, in 64 KB pieces (never one giant string). */
export function* chunksOf(bytes: number): Generator<string> {
  for (let offset = 0, i = 0; offset < bytes; offset += BLOCK, i++) {
    yield block(i).slice(0, Math.min(BLOCK, bytes - offset));
  }
}

export const singleFilePath = (size: string) => `files/arquivo-${size}.md`;

const pad = (n: number, width: number) => String(n).padStart(width, "0");

/** A notes vault: ~sqrt(n)/2 folders, one in five notes one level deeper, 1-24 KB each. */
export function workspaceLayout(fileCount: number): { path: string; bytes: number }[] {
  let seed = 42;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const folders = Math.max(1, Math.round(Math.sqrt(fileCount) / 2));

  return Array.from({ length: fileCount }, (_, i) => ({
    path: `workspace/pasta-${pad(i % folders, 3)}${i % 5 == 0 ? "/sub" : ""}/nota-${pad(i, 5)}.md`,
    bytes: Math.round(1024 + random() * 23 * 1024),
  }));
}

/** Every fixture the selected stages read. */
export function fixtureSpec(options: PlanOptions): { path: string; bytes: number }[] {
  const spec: { path: string; bytes: number }[] = [];

  if (options.stages.includes("read-file") || options.stages.includes("capabilities")) {
    const sizes = new Set(options.stages.includes("read-file") ? options.sizes : []);
    sizes.add("4k"); // capabilities reads one small file
    for (const size of sizes) spec.push({ path: singleFilePath(size), bytes: SIZES[size] });
  }

  if (options.stages.includes("read-workspace")) spec.push(...workspaceLayout(options.workspaceFiles));

  return spec;
}

// ---------------------------------------------------------------- plan

export function plan(options: PlanOptions): Case[] {
  const cases: Case[] = [];
  const add = (c: Omit<Case, "id">) => cases.push({ ...c, id: [c.stage, c.subject, c.size, c.method].filter(Boolean).join("/") });
  // A 128 MB read takes long enough that 3 samples say as much as 7.
  const repeatFor = (size: string) => (SIZES[size] >= 32 * 1024 * 1024 ? Math.min(options.repeat, 3) : options.repeat);

  for (const stage of options.stages) {
    for (const subject of options.subjects) {
      if (stage == "capabilities") add({ stage, subject, repeat: 1 });

      if (stage == "read-file") {
        for (const size of options.sizes) {
          for (const method of READ_METHODS) {
            if (OPFS_ONLY.has(method) && subject != "opfs") continue;
            add({ stage, subject, size, method, repeat: repeatFor(size) });
          }
        }
      }

      if (stage == "read-workspace") {
        for (const method of WORKSPACE_METHODS) add({ stage, subject, method, repeat: Math.min(options.repeat, 3) });
      }

      if (stage == "write") {
        for (const size of options.sizes) {
          for (const method of WRITE_METHODS) {
            if (OPFS_ONLY.has(method) && subject != "opfs") continue;
            add({ stage, subject, size, method, repeat: repeatFor(size) });
          }
        }
      }
    }
  }

  return cases;
}

// ---------------------------------------------------------------- report

const quantile = (values: number[], q: number) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};

export const median = (values: (number | null | undefined)[]) => quantile(values.filter((v): v is number => v != null), 0.5);

export function summarize(result: CaseResult) {
  const samples = result.samples ?? [];
  const ms = median(samples.map((s) => s.ms));
  const bytes = samples[0]?.bytes ?? 0;

  return {
    ms,
    min: samples.length ? Math.min(...samples.map((s) => s.ms)) : null,
    getFileMs: median(samples.map((s) => s.getFileMs)),
    firstDataMs: median(samples.map((s) => s.firstDataMs)),
    mbps: ms && bytes ? bytes / 1048576 / (ms / 1000) : null,
    bytes,
    chunks: samples[0]?.chunks,
    firstChunkBytes: samples[0]?.firstChunkBytes,
    files: samples[0]?.files,
  };
}

const fmtMs = (value: number | null | undefined) =>
  value == null ? "–" : value < 1 ? value.toFixed(2) : value < 100 ? value.toFixed(1) : Math.round(value).toLocaleString("en-US");
const fmtNum = (value: number | null | undefined, digits = 0) => (value == null ? "–" : value.toFixed(digits));
const pct = (a: number | null, b: number | null) => (a == null || b == null || !b ? "–" : `${a <= b ? "" : "+"}${Math.round(((a - b) / b) * 100)}%`);

export type Meta = { date: string; browser: string; options: PlanOptions; notes?: string[] };

export function toMarkdown(meta: Meta, results: CaseResult[]): string {
  const lines = [`# File System Access: OPFS x showDirectoryPicker x stream`, ``, `${meta.date} · ${meta.browser} · stages \`${meta.options.stages.join(",")}\` · repeat ${meta.options.repeat}`, ``];
  for (const note of meta.notes ?? []) lines.push(`> ${note}`, ``);

  const subjects = [...new Set(results.map((r) => r.subject))];
  const by = (stage: string) => results.filter((r) => r.stage == stage);
  const find = (stage: string, subject: string, method: string, size?: string) =>
    results.find((r) => r.stage == stage && r.subject == subject && r.method == method && r.size == size);
  const msOf = (r?: CaseResult) => (r?.status == "ok" ? summarize(r).ms : null);

  const caps = by("capabilities");
  if (caps.length) {
    lines.push(`## 1. Diferencas entre os handles`, ``);
    const keys = [...new Set(caps.flatMap((r) => Object.keys(r.checks ?? {})))];
    lines.push(`| verificacao | ${caps.map((r) => r.subject).join(" | ")} |`, `| --- | ${caps.map(() => "---").join(" | ")} |`);
    for (const key of keys) lines.push(`| ${key} | ${caps.map((r) => (r.checks?.[key] ?? (r.status != "ok" ? `${r.status}: ${r.note}` : "–")).replace(/\|/g, "\\|")).join(" | ")} |`);
    lines.push(``);
  }

  const reads = by("read-file");
  if (reads.length) {
    lines.push(`## 2. Leitura de um arquivo`, ``);
    lines.push(`Tempo = \`getFile()\` + consumo do conteudo (lookup do handle fora). "1o dado" = quando o primeiro byte chega ao JS; para \`text()\`/\`arrayBuffer()\` e a leitura inteira.`, ``);
    lines.push(`| arquivo | subject | metodo | mediana ms | min ms | MB/s | 1o dado ms | getFile ms | chunks (1o chunk) | status |`);
    lines.push(`| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |`);
    for (const r of reads) {
      const s = summarize(r);
      lines.push(`| ${r.size} | ${r.subject} | ${r.method} | ${fmtMs(s.ms)} | ${fmtMs(s.min)} | ${fmtNum(s.mbps)} | ${fmtMs(s.firstDataMs)} | ${fmtMs(s.getFileMs)} | ${s.chunks != null ? `${s.chunks} (${s.firstChunkBytes} B)` : "–"} | ${r.status}${r.note ? `: ${r.note}` : ""} |`);
    }

    lines.push(``, `### Stream x leitura inteira`, ``);
    lines.push(`Comparacoes justas: \`stream-text\` (decodifica) contra \`text()\`, \`stream\` (bytes) contra \`arrayBuffer()\`. Delta negativo = stream mais rapido.`, ``);
    lines.push(`| arquivo | subject | text | stream-text | delta | arrayBuffer | stream | delta | 1o dado: stream x text | ler 4 KB: stream-head / slice-head / text |`);
    lines.push(`| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |`);
    for (const size of meta.options.sizes) {
      for (const subject of subjects) {
        const get = (method: string) => msOf(find("read-file", subject, method, size));
        const first = (method: string) => { const r = find("read-file", subject, method, size); return r?.status == "ok" ? summarize(r).firstDataMs : null; };
        if (get("text") == null && get("stream") == null) continue;
        lines.push(`| ${size} | ${subject} | ${fmtMs(get("text"))} | ${fmtMs(get("stream-text"))} | ${pct(get("stream-text"), get("text"))} | ${fmtMs(get("arrayBuffer"))} | ${fmtMs(get("stream"))} | ${pct(get("stream"), get("arrayBuffer"))} | ${fmtMs(first("stream"))} x ${fmtMs(first("text"))} | ${fmtMs(get("stream-head"))} / ${fmtMs(get("slice-head"))} / ${fmtMs(get("text"))} |`);
      }
    }

    const others = subjects.filter((s) => s != "opfs");
    if (subjects.includes("opfs") && others.length) {
      lines.push(``, `### Disco local x OPFS`, ``, `Razao = tempo no subject / tempo no OPFS (>1 = OPFS mais rapido).`, ``);
      lines.push(`| arquivo | metodo | opfs ms | ${others.map((o) => `${o} ms | razao`).join(" | ")} |`, `| --- | --- | ---: | ${others.map(() => "---: | ---:").join(" | ")} |`);
      for (const size of meta.options.sizes) {
        for (const method of READ_METHODS) {
          const base = msOf(find("read-file", "opfs", method, size));
          if (base == null) continue;
          lines.push(`| ${size} | ${method} | ${fmtMs(base)} | ${others.map((o) => { const v = msOf(find("read-file", o, method, size)); return `${fmtMs(v)} | ${v == null ? "–" : (v / base).toFixed(2)}`; }).join(" | ")} |`);
        }
      }
    }
    lines.push(``);
  }

  const workspace = by("read-workspace");
  if (workspace.length) {
    lines.push(`## 3. Workspace (${meta.options.workspaceFiles} notas)`, ``);
    lines.push(`\`walk*\` e \`app-getFiles\` medem a enumeracao (o \`app-getFiles\` e o \`useFileSystemManipulation().getFiles()\` do app); os demais leem o conteudo de handles ja coletados.`, ``);
    lines.push(`| subject | metodo | mediana ms | min ms | arquivos | MB/s | status |`, `| --- | --- | ---: | ---: | ---: | ---: | --- |`);
    for (const r of workspace) {
      const s = summarize(r);
      lines.push(`| ${r.subject} | ${r.method} | ${fmtMs(s.ms)} | ${fmtMs(s.min)} | ${s.files ?? "–"} | ${r.method!.startsWith("walk") || r.method == "app-getFiles" ? "–" : fmtNum(s.mbps)} | ${r.status}${r.note ? `: ${r.note}` : ""} |`);
    }
    lines.push(``);
  }

  const writes = by("write");
  if (writes.length) {
    lines.push(`## 4. Escrita`, ``, `| arquivo | subject | metodo | mediana ms | min ms | MB/s | status |`, `| --- | --- | --- | ---: | ---: | ---: | --- |`);
    for (const r of writes) {
      const s = summarize(r);
      lines.push(`| ${r.size} | ${r.subject} | ${r.method} | ${fmtMs(s.ms)} | ${fmtMs(s.min)} | ${fmtNum(s.mbps)} | ${r.status}${r.note ? `: ${r.note}` : ""} |`);
    }
    lines.push(``);
  }

  const failed = results.filter((r) => r.status == "error");
  if (failed.length) {
    lines.push(`## Erros`, ``);
    for (const r of failed) lines.push(`- \`${r.id}\`: ${r.note}`);
  }

  return lines.join("\n") + "\n";
}
