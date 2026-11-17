import { quantile, useMetrics } from "../metrics";

const ms = (value?: number | null) => (value == null ? "–" : `${Math.round(value).toLocaleString("pt-BR")} ms`);
const size = (bytes?: number) => (bytes == null ? "–" : bytes < 1048576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`);

/** Medidas ao vivo do arquivo aberto (ver react-pm/src/metrics.ts). */
export function StatusBar({ opened }: { opened: string | null }) {
  const m = useMetrics();
  const p50 = quantile(m.keyLatencies, 0.5);
  const p95 = quantile(m.keyLatencies, 0.95);

  return (
    <footer style={{ display: "flex", gap: 16, alignItems: "center", height: 26, padding: "0 12px", borderTop: "1px solid #eee", fontSize: 11, color: "#666", background: "#fafafa", whiteSpace: "nowrap", overflow: "hidden" }}>
      <span>react-prosemirror 3.3 · prosemirror-view 1.42.3</span>
      {opened && (
        <>
          <span>{size(m.bytes)} · {m.topLevelBlocks ?? "–"} blocos</span>
          <span>parse {ms(m.parseMs)}</span>
          <span>state {ms(m.stateMs)}</span>
          <span>montagem {ms(m.mountMs)}</span>
          <span>serializar {ms(m.serializeMs)}</span>
          <span>tecla p50 {ms(p50)} · p95 {ms(p95)} ({m.keyLatencies.length})</span>
          <span>{m.domNodes?.toLocaleString("pt-BR") ?? "–"} nós DOM</span>
        </>
      )}
    </footer>
  );
}
