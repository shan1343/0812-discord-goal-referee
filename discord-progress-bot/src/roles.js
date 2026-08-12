import { transcriptForModel } from "./conversation.js";

export const rolesSchema = {
  type: "object",
  additionalProperties: false,
  required: ["project_goal", "scope", "assignments", "risks"],
  properties: {
    project_goal: { type: "string", maxLength: 220 },
    scope: { type: "string", maxLength: 400 },
    assignments: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["person", "suggested_role", "tasks", "deadline", "reason", "evidence_ids", "status"],
        properties: {
          person: { type: "string", maxLength: 80 },
          suggested_role: { type: "string", maxLength: 100 },
          tasks: { type: "array", maxItems: 5, items: { type: "string", maxLength: 180 } },
          deadline: { type: "string", maxLength: 120 },
          reason: { type: "string", maxLength: 280 },
          evidence_ids: { type: "array", maxItems: 8, items: { type: "string", maxLength: 80 } },
          status: { type: "string", enum: ["proposal"] }
        }
      }
    },
    risks: { type: "array", maxItems: 6, items: { type: "string", maxLength: 220 } }
  }
};

const INSTRUCTIONS = `You are GoalReferee, an evidence-based project role assignment assistant.
Analyze only the provided Korean Discord conversation. Propose, never confirm, assignments: every status must be "proposal".
Do not invent people, skills, tasks, deadlines, or evidence. Each assignment must cite only source message IDs from the transcript that support its reason or task.
Use evidence IDs in the form of the transcript source number. When the conversation lacks evidence for a necessary role or decision, put it in risks.
Return Korean strings, concise and actionable.`;

export async function analyzeRoles(messages, { apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL || "gpt-5-mini" } = {}) {
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
          name: "discord_role_proposals",
          strict: true,
          schema: rolesSchema
        }
      }
    })
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI API 요청 실패 (${response.status}): ${detail.slice(0, 300)}`);
  }
  const payload = await response.json();
  const outputText = payload.output_text || payload.output
    ?.filter((item) => item.type === "message")
    .flatMap((item) => item.content || [])
    .find((content) => content.type === "output_text")
    ?.text;
  if (!outputText) {
    const reason = payload.incomplete_details?.reason || payload.status || "unknown";
    throw new Error(`OpenAI API가 역할 분담 결과를 반환하지 않았습니다 (${reason}).`);
  }
  return JSON.parse(outputText);
}
