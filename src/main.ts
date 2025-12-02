import "@/main.scss";

import "prosemirror-view/style/prosemirror.css";

import "driver.js/dist/driver.css";
import "@/services/tour/style.scss";

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from '@/App.vue';

import "@/monaco/workers";

const app = createApp(App);

app.use(createPinia());

app.mount('#stackedit');
