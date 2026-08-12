import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";

mkdirSync("dist/server", { recursive: true });
mkdirSync("dist/.openai", { recursive: true });
copyFileSync(".openai/hosting.json", "dist/.openai/hosting.json");
writeFileSync(
  "dist/server/index.js",
  "export default { async fetch(request, env) { const url = new URL(request.url); if (url.pathname === '/') url.pathname = '/index.html'; return env.ASSETS.fetch(new Request(url, request)); } };\n",
);
