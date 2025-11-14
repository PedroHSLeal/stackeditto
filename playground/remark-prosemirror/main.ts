import "@/main.scss";

import "~/prosemirror-view/style/prosemirror.css";

import { createApp } from 'vue';
import { createPinia } from 'pinia';

import Playground from './Playground.vue';

const app = createApp(Playground);

app.use(createPinia());

app.mount('#stackedit');