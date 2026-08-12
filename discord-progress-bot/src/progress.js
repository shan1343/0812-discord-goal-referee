import { transcriptForModel } from "./conversation.js";

export const progressSchema = {
  type: "object",
  additionalProperties: false,
  required: ["overall_percent", "overall_status", "headline", "members", "done", "in_progress", "next_actions", "risks", "evidence_note"],
  properties: {
    overall_percent: { type: "integer", minimum: 0, maximum: 100 },
    overall_status: { type: "string", enum: ["on_track", "attention", "blocked", "complete"] },
    headline: { type: "string", maxLength: 120 },
    members: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "percent", "status", "completed", "working_on", "next_action", "blockers", "evidence_ids"],
        properties: {
          name: { type: "string", maxLength: 80 },
          percent: { type: "integer", minimum: 0, maximum: 100 },
          status: { type: "string", enum: ["done", "working", "waiting", "blocked", "unknown"] },
          completed: { type: "array", items: { type: "string", maxLength: 120 }, maxItems: 5 },
          working_on: { type: "array", items: { type: "string", maxLength: 120 }, maxItems: 5 },
          next_action: { type: "string", maxLength: 160 },
          blockers: { type: "array", items: { type: "string", maxLength: 120 }, maxItems: 4 },
          evidence_ids: { type: "array", items: { type: "string" }, maxItems: 8 }
        }
      }
    },
    done: { type: "array", items: { type: "string", maxLength: 120 }, maxItems: 10 },
    in_progress: { type: "array", items: { type: "string", maxLength: 120 }, maxItems: 10 },
    next_actions: { type: "array", items: { type: "string", maxLength: 160 }, maxItems: 8 },
    risks: { type: "array", items: { type: "string", maxLength: 160 }, maxItems: 6 },
    evidence_note: { type: "string", maxLength: 180 }
  }
};

const INSTRUCTIONS = `You are GoalReferee, an evidence-based project progress analyst.
Analyze only the provided Korean Discord conversation. Never invent a task, owner, completion, deadline, or blocker.
Treat direct reports such as \"완료\", \"끝\", \"제출 완료\" as evidence. Plans, intentions, and bot summaries alone are weaker evidence than a member's direct report.
Overall percent measures required project completion, not chat activity. Do not report 100 unless a final required delivery/submission is explicitly reported complete. When overall_status is complete, risks must contain only currently active blockers (not past, resolved, hypothetical, or joking concerns). Return Korean strings, concise and factual.
Each member evidence_ids must contain source message IDs supporting their status. If evidence is insufficient, use unknown and say 판단 근거 부족.`;

export async function analyzeProgress(messages, { apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL || "gpt-5-mini" } = {}) {
  if (!apiKey) throw new Error("OPENAI_API_KEY가 없습니다. .env를 설정하세요.");
  if (!messages?.length) throw new Error("분석할 메시지가 없습니다.");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      store: false,
      input: `${INSTRUCTIONS}\n\n<conversation>\n${transcriptForModel(messages)}\n</conversation>`,
      text: {
        format: {
          type: "json_schema",
          name: "discord_project_progress",
          strict: true,
          schema: progressSchema
        }
      }
    })
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI API 요청 실패 (${response.status}): ${detail.slice(0, 300)}`);
  }
  const payload = await response.json();
  // output_text는 공식 SDK의 편의 속성입니다. REST JSON에서는 message.content를 읽습니다.
  const outputText = payload.output_text || payload.output
    ?.filter((item) => item.type === "message")
    .flatMap((item) => item.content || [])
    .find((content) => content.type === "output_text")
    ?.text;
  if (!outputText) {
    const reason = payload.incomplete_details?.reason || payload.status || "unknown";
    throw new Error(`OpenAI API가 분석 결과를 반환하지 않았습니다 (${reason}).`);
  }
  return JSON.parse(outputText);
}

