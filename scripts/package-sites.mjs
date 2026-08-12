import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

mkdirSync("dist/server", { recursive: true });
mkdirSync("dist/.openai", { recursive: true });
copyFileSync(".openai/hosting.json", "dist/.openai/hosting.json");

const apiBaseUrl = String(process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const html = readFileSync("sites/index.html", "utf8")
  .replace("__API_BASE_URL__", JSON.stringify(apiBaseUrl));

writeFileSync(
  "dist/server/index.js",
  `const html=${JSON.stringify(html)};export default{async fetch(){return new Response(html,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-cache","content-security-policy":"default-src 'self'; connect-src 'self' https:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'"}})}};\n`,
);
