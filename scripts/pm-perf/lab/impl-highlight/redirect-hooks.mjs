import { pathToFileURL } from "node:url"; import path from "node:path";
const target = pathToFileURL(path.resolve(process.env.PV_REDIRECT)).href;
export async function resolve(spec, ctx, next) { if (spec === "prosemirror-view") return { url: target, shortCircuit: true }; return next(spec, ctx); }
