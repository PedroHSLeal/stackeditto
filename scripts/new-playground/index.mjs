import fs from "node:fs/promises";

const projectName = process.argv[2];
const projectPath = `./playground/${projectName}`;

const mainTs = await fs.readFile("./scripts/new-playground/template/index.ts.txt", { encoding: "utf8" });
const indexHtml = await fs.readFile("./scripts/new-playground/template/index.html.txt", { encoding: "utf8" });
const playgroundVue = await fs.readFile("./scripts/new-playground/template/Playground.vue.txt", { encoding: "utf8" });

const projectDir = await fs.mkdir(projectPath);

await fs.writeFile(`${projectPath}/main.ts`, mainTs);
await fs.writeFile(`${projectPath}/index.html`, indexHtml.replaceAll("{{ PROJECT_NAME }}", projectName));
await fs.writeFile(`${projectPath}/Playground.vue`, playgroundVue);

const entrypoint = await fs.readFile("./playground/index.html", { encoding: "utf8" });
const closingAnchor = "</a>";
const link = `<a href="./${projectName}/">${projectName}</a>`;

const newEntrypoint = entrypoint.substring(0, entrypoint.lastIndexOf(closingAnchor) + closingAnchor.length) +
  `\n${" ".repeat(6)}${link}` +
  entrypoint.substring(entrypoint.lastIndexOf(closingAnchor) + closingAnchor.length);

await fs.writeFile("./playground/index.html", newEntrypoint);