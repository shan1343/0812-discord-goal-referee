import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

mkdirSync("dist/server", { recursive: true });
mkdirSync("dist/.openai", { recursive: true });
copyFileSync(".openai/hosting.json", "dist/.openai/hosting.json");

const apiBaseUrl = String(process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const html = readFileSync("sites/index.html", "utf8")
  .replace("__API_BASE_URL__", JSON.stringify(apiBaseUrl));

const worker = `
const html=${JSON.stringify(html)};
let latest=null;
const channels=new Map();
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
function publicResult(value){return {schemaVersion:value.schemaVersion||"1.0",generatedAt:value.generatedAt,summary:value.summary,tasks:value.tasks,questions:value.questions||[],sourceMessageCount:value.sourceMessageCount||0};}
export default{async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==="/api/goal-referee/results"&&request.method==="POST"){
    const expected=String(env?.GOAL_REFEREE_INGEST_TOKEN||"");
    const supplied=String(request.headers.get("authorization")||"").replace(/^Bearer\\s+/i,"");
    if(!expected)return json({detail:"Goal Referee ingest is not configured."},503);
    if(!supplied||supplied!==expected)return json({detail:"Invalid Goal Referee ingest token."},401);
    let payload;try{payload=await request.json()}catch{return json({detail:"Invalid JSON."},400)}
    if(!payload?.channelId||!payload?.summary||!Array.isArray(payload?.tasks))return json({detail:"Invalid Goal Referee result."},422);
    latest=payload;channels.set(String(payload.channelId),payload);return json({accepted:true,channel_id:String(payload.channelId)},202);
  }
  if(url.pathname==="/api/goal-referee/results/latest"&&request.method==="GET"){
    const channel=url.searchParams.get("channel_id");const value=channel?channels.get(channel):latest;
    return value?json(publicResult(value)):json({detail:"No Goal Referee result has been published yet."},404);
  }
  if(url.pathname==="/health")return json({status:"ok",dashboard_bridge:"ready"});
  return new Response(html,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-cache","content-security-policy":"default-src 'self'; connect-src 'self' https:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'"}});
}};
`;
writeFileSync("dist/server/index.js", worker);
