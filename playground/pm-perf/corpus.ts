import fixtureRaw from "<md>/huge-file.md?raw";

/**
 * Test documents. md/huge-file.md has no fenced code and no tables, so repeating
 * it alone never exercises Shiki's grammars or the table handlers. The other
 * kinds isolate one block type each. Generation is deterministic, and the File is
 * assembled from repeated parts so no giant string exists before the "read" stage.
 */
export type CorpusKind = "fixture" | "prose" | "fenced" | "tables" | "lists" | "html" | "giant-block";

const fixture = fixtureRaw.replace(/\r\n/g, "\n");

const LOREM = "The quick brown fox jumps over the lazy dog while **strong words** and *emphasis* sit next to `inline code` and a [link](https://example.com/page) in the same sentence.";

const TS_SAMPLE = `export async function load<T>(url: string, retries = 3): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (response.ok) return (await response.json()) as T;
    console.warn(\`attempt \${attempt} failed: \${response.status}\`);
  }
  throw new Error("giving up on " + url);
}`;

const PY_SAMPLE = `def fibonacci(limit: int) -> list[int]:
    values = [0, 1]
    while values[-1] + values[-2] < limit:
        values.append(values[-1] + values[-2])
    return values  # the sequence so far`;

function unit(kind: Exclude<CorpusKind, "fixture" | "giant-block">): string {
  const parts: string[] = [];

  for (let i = 0; i < 200; i++) {
    switch (kind) {
      case "prose":
        parts.push(i % 20 == 0 ? `## Section ${i}\n\n${LOREM}\n\n` : `${LOREM} ${LOREM}\n\n`);
        break;
      case "fenced":
        parts.push(`Paragraph ${i} before the code.\n\n\`\`\`${i % 2 ? "python" : "typescript"}\n${i % 2 ? PY_SAMPLE : TS_SAMPLE}\n\`\`\`\n\n`);
        break;
      case "tables":
        parts.push(`| id | name | note |\n| --- | --- | --- |\n${Array.from({ length: 8 }, (_, r) => `| ${r} | row ${r} of ${i} | ${LOREM.slice(0, 40)} |`).join("\n")}\n\n`);
        break;
      case "lists":
        parts.push(`${Array.from({ length: 10 }, (_, r) => `- item ${r} of ${i}: ${LOREM.slice(0, 60)}`).join("\n")}\n\n`);
        break;
      case "html":
        parts.push(`Paragraph ${i} before the block.\n\n<x-perf-block>\ncontent of block ${i}\n</x-perf-block>\n\n`);
        break;
    }
  }

  return parts.join("");
}

export function buildCorpus(kind: CorpusKind, sizeMB: number): File {
  const target = Math.round(sizeMB * 1024 * 1024);
  const name = `${kind}-${sizeMB}mb.md`;

  if (kind == "giant-block") {
    // One top-level node holding everything: the worst case for windowing by block.
    const line = "const value = compute(input, 42); // one line of a very long block\n";
    const lines = Math.ceil(target / line.length);
    return new File(["```typescript\n", ...Array(lines).fill(line), "```\n"], name);
  }

  const piece = kind == "fixture" ? `${fixture}\n\n` : unit(kind);
  const pieceBytes = new Blob([piece]).size;
  // sizeMB == 0 means "the fixture exactly as it is".
  const copies = target == 0 ? 1 : Math.max(1, Math.round(target / pieceBytes));

  return new File(Array(copies).fill(piece), name);
}
