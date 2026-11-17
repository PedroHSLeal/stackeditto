import { fileURLToPath, URL } from 'node:url';
import { readdirSync } from "node:fs";

import { ConfigEnv, defineConfig, UserConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import react from '@vitejs/plugin-react';
// import vueDevTools from 'vite-plugin-vue-devtools';

// https://vite.dev/config/
export default defineConfig((env: ConfigEnv) => {
  let basePlugins = [
    vueJsx(),
    vue(),
    // vueDevTools(),
  ]

  let baseConfig: UserConfig = {
    base: "/stackeditto/",
    resolve: {
      alias: {
        "~": fileURLToPath(new URL('./node_modules', import.meta.url)),
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '<md>': fileURLToPath(new URL('./md', import.meta.url)),
        '<p>': fileURLToPath(new URL('./playground', import.meta.url)),
      },
    },
    plugins: [
      ...basePlugins
    ],
    build: {
      // o highlighter do Shiki é criado com top-level await (prosemirror/plugins/shiki-code-block.ts),
      // que o target padrão do Vite (es2020/chrome87) não aceita; o app já exige Chromium recente pela File System Access API
      target: "es2022",
    },
  };

  if (env.mode == "playground" || env.mode == "playground-react") {
    baseConfig.base = "/";
    baseConfig.root = "./playground/";
    baseConfig.define = {
      __PLAYGROUNDS__: readdirSync("./playground").filter(e => !e.includes(".") && !e.includes("_"))
    }
  }

  // Experimento react-prosemirror (branch react-prosemirror): o módulo ./react-pm é um app React separado
  // que reaproveita src/services. "playground-react" é o playground do pm-perf com a mesma troca de view,
  // para o harness comparar os dois editores lado a lado.
  if (env.mode == "react-pm" || env.mode == "playground-react") {
    withReactProsemirror(baseConfig, env.mode);
  }

  if (env.mode == "react-pm") {
    baseConfig.base = env.command == "build" || env.isPreview ? "/stackeditto/react-pm/" : "/";
    baseConfig.root = "./react-pm/";
    baseConfig.plugins = [react()];
    baseConfig.build = { ...baseConfig.build, outDir: "../dist-react-pm", emptyOutDir: true };
  }

  return baseConfig;
});

/**
 * @handlewithcare/react-prosemirror estende o EditorView por dentro e exige prosemirror-view 1.42.3 exato;
 * o app Vue continua na 1.41.0 com os patches de patches/. A 1.42.3 está instalada como prosemirror-view-react
 * e só estes modos a enxergam como "prosemirror-view" (todas as importações do bundle, inclusive as de src/,
 * passam a usar a mesma classe). O cache de dependências é separado porque o pré-bundle é diferente.
 */
function withReactProsemirror(config: UserConfig, mode: string) {
  const reactView = fileURLToPath(new URL('./node_modules/prosemirror-view-react', import.meta.url));

  config.cacheDir = `node_modules/.vite-${mode}`;
  config.resolve!.alias = [
    { find: /^prosemirror-view$/, replacement: reactView },
    { find: /^prosemirror-view\/(.*)$/, replacement: `${reactView}/$1` },
    ...Object.entries(config.resolve!.alias as Record<string, string>).map(([find, replacement]) => ({ find, replacement })),
  ];
}
