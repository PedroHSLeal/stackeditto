// node --import ./register.mjs : swaps prosemirror-model's dist for the lab copy (lab/ has a globalThis.__PM_OFF switch)
import { register } from "node:module";
register("./hooks.mjs", import.meta.url);
