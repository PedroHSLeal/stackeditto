import { useSyncExternalStore } from "react";

/**
 * Números ao vivo do editor, para a barra de status: o mesmo tipo de medida que o harness
 * (scripts/pm-perf) faz em lote, mas no uso real, arquivo a arquivo.
 */
export type Metrics = {
  bytes?: number;
  topLevelBlocks?: number;
  parseMs?: number;
  stateMs?: number;
  /** Do setState com o novo EditorState até o frame seguinte ao commit do React estar pintado. */
  mountMs?: number;
  serializeMs?: number;
  domNodes?: number;
  /** Latência de cada tecla: do keydown até o frame seguinte (as últimas 50). */
  keyLatencies: number[];
};

let current: Metrics = { keyLatencies: [] };
const listeners = new Set<() => void>();

export const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => {
  const channel = new MessageChannel();
  channel.port1.onmessage = () => resolve();
  channel.port2.postMessage(0);
}));

export const metrics = {
  get: () => current,
  set(patch: Partial<Metrics>) {
    current = { ...current, ...patch };
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

let mountStartedAt: number | null = null;

export function markMountStart() {
  mountStartedAt = performance.now();
}

export async function markMounted() {
  if (mountStartedAt == null) return;
  const started = mountStartedAt;
  mountStartedAt = null;
  await nextFrame();
  metrics.set({ mountMs: performance.now() - started, domNodes: document.getElementsByTagName("*").length });
}

/** Instala uma vez: mede toda tecla pressionada dentro do editor. */
export function installKeyLatencyProbe(isEditorTarget: (target: EventTarget | null) => boolean) {
  window.addEventListener("keydown", (event) => {
    if (!isEditorTarget(event.target)) return;
    const pressed = event.timeStamp;

    void nextFrame().then(() => {
      metrics.set({ keyLatencies: [...current.keyLatencies.slice(-49), performance.now() - pressed] });
    });
  }, { capture: true });
}

export function quantile(values: number[], q: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

export const useMetrics = () => useSyncExternalStore(metrics.subscribe, metrics.get);
