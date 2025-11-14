import "@/main.scss";
import "prosemirror-view/style/prosemirror.css";

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from '@/App.vue';

import "@/monaco/workers";

const app = createApp(App);

app.use(createPinia());

app.mount('#stackedit');
