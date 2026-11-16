import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";

export const URL = "http://localhost:5199/stackeditto/";
export const W = 1100, H = 640;

// Conteúdo do vault de exemplo: semeado no OPFS (um diretório real do navegador),
// devolvido pelo stub de showDirectoryPicker — o seletor nativo do SO não aparece em vídeo.
export const VAULT = {
  "README.md": "# Meu vault\n\nEste é um **vault de exemplo** aberto no Stackeditto.\n\n- Notas ficam na pasta notas\n- O diário fica na pasta diario\n",
  "notas/ideias.md": "# Ideias\n\n> Escrever é pensar duas vezes.\n\n1. Editor markdown no navegador\n2. Extensões em JavaScript\n3. Sem servidor\n\n| recurso | status |\n| --- | --- |\n| tabelas | ok |\n| listas | ok |\n",
  "notas/reuniao.md": "# Reunião de segunda\n\n- [ ] revisar o roadmap\n- [ ] testar extensões\n\n```js\nconsole.log(\"olá\")\n```\n",
  "diario/2026-11-16.md": "# 16/11/2026\n\nHoje gravei os GIFs do guia.\n",
  "config.json": "{\n  \"tema\": \"claro\",\n  \"fonte\": \"JetBrains Mono\"\n}\n",
};

const initScript = ({ vault, extra }) => {
  const files = { ...vault, ...(extra || {}) };
  window.showDirectoryPicker = async () => {
    const opfs = await navigator.storage.getDirectory();
    try { await opfs.removeEntry("meu-vault", { recursive: true }); } catch { }
    const root = await opfs.getDirectoryHandle("meu-vault", { create: true });
    for (const [p, content] of Object.entries(files)) {
      const parts = p.split("/");
      let dir = root;
      for (const d of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(d, { create: true });
      const fh = await dir.getFileHandle(parts.at(-1), { create: true });
      const w = await fh.createWritable(); await w.write(content); await w.close();
    }
    window.__vault = root;
    return root;
  };

  // cursor falso + "ripple" de clique (o vídeo do Playwright não mostra o mouse)
  const install = () => {
    const c = document.createElement("div");
    c.id = "__cursor";
    c.style.cssText = "position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;transform:translate(-3px,-2px);transition:none";
    c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l16 10-7 1.5L9.5 21z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    document.addEventListener("mousemove", e => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
    const ripple = (e, color) => {
      const r = document.createElement("div");
      r.style.cssText = `position:fixed;left:${e.clientX - 18}px;top:${e.clientY - 18}px;width:36px;height:36px;border-radius:50%;background:${color};z-index:2147483646;pointer-events:none;transform:scale(.3);opacity:.9;transition:transform .45s ease-out,opacity .45s ease-out`;
      document.body.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = "scale(1.4)"; r.style.opacity = "0"; });
      setTimeout(() => r.remove(), 600);
    };
    document.addEventListener("mousedown", e => ripple(e, e.button === 2 ? "rgba(230,90,40,.55)" : "rgba(40,120,255,.5)"), true);
    // legenda
    const cap = document.createElement("div");
    cap.id = "__caption";
    cap.style.cssText = "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:rgba(20,20,30,.86);color:#fff;font:600 15px system-ui,sans-serif;padding:8px 16px;border-radius:8px;z-index:2147483645;pointer-events:none;opacity:0;transition:opacity .25s;white-space:nowrap";
    document.body.appendChild(cap);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install); else install();
};

export async function record(name, outDir, fn, { extra } = {}) {
  const tmp = path.join(outDir, "_video_" + name);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: tmp, size: { width: W, height: H } } });
  await ctx.addInitScript(initScript, { vault: VAULT, extra });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("[pageerror]", name, e.message));
  const t0 = Date.now();
  await page.goto(URL);
  await page.waitForSelector("#welcome");
  await page.mouse.move(W / 2, H / 2);
  const skipMs = Date.now() - t0; // corta o carregamento inicial
  const h = helpers(page);
  await fn(page, h);
  await page.waitForTimeout(900);
  await ctx.close(); await browser.close();
  const webm = path.join(tmp, readdirSync(tmp).find(f => f.endsWith(".webm")));
  const gif = path.join(outDir, name + ".gif");
  const ss = Math.max(0, skipMs / 1000 - 0.2).toFixed(2);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", ss, "-i", webm,
    "-vf", "fps=12,scale=880:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
    "-loop", "0", gif]);
  rmSync(tmp, { recursive: true, force: true });
  console.log("ok", gif);
}

function helpers(page) {
  let pos = { x: W / 2, y: H / 2 };
  const moveTo = async (x, y) => {
    const steps = Math.max(8, Math.round(Math.hypot(x - pos.x, y - pos.y) / 18));
    await page.mouse.move(x, y, { steps });
    pos = { x, y };
  };
  const center = async (loc) => {
    await loc.waitFor({ state: "visible" });
    const b = await loc.boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const h = {
    wait: (ms) => page.waitForTimeout(ms),
    async caption(text) {
      await page.evaluate(t => { const c = document.getElementById("__caption"); c.textContent = t; c.style.opacity = t ? "1" : "0"; }, text);
    },
    async hover(loc) { const p = await center(loc); await moveTo(p.x, p.y); await page.waitForTimeout(250); },
    async click(loc, { button = "left", pause = 600 } = {}) {
      const p = await center(loc);
      await moveTo(p.x, p.y);
      await page.waitForTimeout(250);
      await page.mouse.click(p.x, p.y, { button });
      await page.waitForTimeout(pause);
    },
    async clickEnd(loc) {
      await loc.waitFor({ state: "visible" });
      const p = await loc.evaluate(el => {
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let last = null, n;
        while ((n = w.nextNode())) if (n.textContent.length) last = n;
        const r = document.createRange(); r.setStart(last, last.length - 1); r.setEnd(last, last.length);
        const b = r.getBoundingClientRect(); return { x: b.right + 2, y: b.top + b.height / 2 };
      });
      await moveTo(p.x, p.y); await page.waitForTimeout(250);
      await page.mouse.click(p.x, p.y); await page.waitForTimeout(200);
    },
    async type(text, delay = 70) { await page.keyboard.type(text, { delay }); },
    async press(key) { await page.keyboard.press(key); await page.waitForTimeout(120); },
    btn: (name) => page.locator("button", { hasText: name }).first(),
    tree: (name) => page.locator("#workspace-tab").getByText(name, { exact: true }).first(),
    async openVault() {
      await h.caption("Clique em “Workspace” e escolha uma pasta do seu computador");
      await h.click(h.btn("Workspace"), { pause: 400 });
      await page.waitForSelector("#workspace-tab");
      await page.waitForTimeout(700);
    },
  };
  return h;
}