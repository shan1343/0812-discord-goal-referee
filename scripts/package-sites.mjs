import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

mkdirSync("dist/server", { recursive: true });
mkdirSync("dist/.openai", { recursive: true });
copyFileSync(".openai/hosting.json", "dist/.openai/hosting.json");
const html = readFileSync("dist/index.html", "utf8")
  .replace(/<link rel="stylesheet"[^>]*>/g, "")
  .replace("</head>", `<style>
    body{margin:0;background:#0b0c10;color:#f4f1ea;font-family:Arial,sans-serif}main{max-width:960px;margin:auto;padding:64px 24px}.tag{color:#8c7aff;letter-spacing:.12em;font-weight:bold;font-size:12px}h1{font-size:clamp(44px,8vw,84px);line-height:.95;margin:18px 0}h1 span{color:#8c7aff}.lead{max-width:620px;color:#aaa8a4;font-size:18px;line-height:1.7}.card{margin-top:42px;padding:28px;border:1px solid #2a2b32;border-radius:18px;background:#14151b}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-top:18px}.item{padding:16px;background:#1a1b22;border-radius:12px}.item b{display:block;font-size:22px;color:#6fe0a9}.muted{color:#aaa8a4}</style></head>`)
  .replace(/<body>[\s\S]*?<\/body>/, `<body><main><p class="tag">EVIDENCE, NOT ACTIVITY</p><h1>Discord Goal<br/><span>Referee</span></h1><p class="lead">Discord 프로젝트 채널의 약속·마감·파일을 근거로 역할을 제안하고, 사람이 확인한 뒤 진행률을 보여주는 웹 데모입니다.</p><section class="card"><p class="tag">DEMO READY</p><h2>근거 기반 역할 제안</h2><div class="grid"><div class="item"><b>도윤</b><span class="muted">Bot · API · 웹 통합</span></div><div class="item"><b>서연</b><span class="muted">Fixture · 파일</span></div><div class="item"><b>민재</b><span class="muted">정답셋 · 보안</span></div><div class="item"><b>미정</b><span class="muted">근거 추가 필요</span></div></div></section><section class="card"><p class="tag">SAFETY</p><p class="muted">허용 채널만 분석 · 메시지량 점수화 금지 · 위험 행동은 사람 확인</p></section></main></body>`);
writeFileSync("dist/server/index.js", `const html = ${JSON.stringify(html)}; export default { async fetch() { return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }); } };\n`);
