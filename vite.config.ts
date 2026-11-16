import { fileURLToPath, URL } from 'node:url';
import { readdirSync } from "node:fs";

import { ConfigEnv, defineConfig, UserConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
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

  if (env.mode == "playground") {
    baseConfig.base = "/";
    baseConfig.root = "./playground/";
    baseConfig.define = {
      __PLAYGROUNDS__: readdirSync("./playground").filter(e => !e.includes(".") && !e.includes("_"))
    }
  }

  return baseConfig;
});
