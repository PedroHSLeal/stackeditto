import { fileURLToPath, URL } from 'node:url';

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
        '<md>': fileURLToPath(new URL('./md', import.meta.url))
      },
    },
    plugins: [
      ...basePlugins
    ]
  };

  if (env.mode == "playground") {
    baseConfig.base = "/";
    baseConfig.root = "./playground/";
  }

  return baseConfig;
});
