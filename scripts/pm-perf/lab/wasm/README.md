# Laboratório WASM (agente wasm, 2026-11-15)

Reexecutar (fora da raiz do repositório, para não mexer no `node_modules` do app):

```bash
cp -r scripts/pm-perf/lab/wasm /tmp/wasm-lab && cd /tmp/wasm-lab
MD_DIR=/caminho/para/lumpy/md   # pasta com huge-file.md (padrão: ../../../../md)
npm i ironmark@3.1.0 comrak@0.48.0-rc.0 md4w@0.2.7 markdown-wasm@1.2.0 unified@11 remark-parse@11 remark-gfm remark-frontmatter markdown-it shiki@3.14.0
node run-matrix.mjs && node summarize.mjs results.jsonl   # parse: 1 processo por amostra (pico de RSS), variantes intercaladas
node conformance.mjs      # remark vs markdown-rs (mdast), contagem de nós e diferenças
node md4w-conf.mjs        # md4w mdToJSON (falha no markdown-it-test-file.md: título sem aspas)
node bisect2.mjs          # quais construções tornam o markdown-rs quadrático
node shiki-bench.mjs      # Oniguruma (WASM) vs motor RegExp de JS do Shiki
node search-bench.mjs     # busca/indexação: JS vs WASM
```

`mdrs/` = crate Rust (markdown 1.0.0 + serde_json) exportando `to_mdast_json`; `srch/` = memchr + contagem de palavras.
Recompilar: `rustup target add wasm32-unknown-unknown && cargo build --release --target wasm32-unknown-unknown`
(`srch` com `RUSTFLAGS="-C target-feature=+simd128"`). Os `.wasm` já compilados estão incluídos.
`results.jsonl` / `results-md4wjson.jsonl` = amostras brutas desta análise.
