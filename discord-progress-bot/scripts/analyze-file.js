import "../src/env.js";
import { readFile } from "node:fs/promises";
import { normalizeConversation } from "../src/conversation.js";
import { analyzeProgress } from "../src/progress.js";
import { dashboardContent } from "../src/dashboard.js";

const filename = process.argv[2];
if (!filename) throw new Error("사용법: npm run analyze:file -- /경로/대화.json");
const source = JSON.parse(await readFile(filename, "utf8"));
const report = await analyzeProgress(normalizeConversation(source));
console.log(JSON.stringify({ report, discord_preview: dashboardContent(report) }, null, 2));
