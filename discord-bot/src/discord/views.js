import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
} from "discord.js";

const COLORS = {
  assignment: 0x5865f2,
  status: 0x2b9f72,
  chat: 0x5865f2,
  chatSuccess: 0x2b9f72,
  error: 0xed4245,
};

const STATE_LABELS = {
  proposed: "제안",
  needs_input: "확인 필요",
  confirmed: "확정",
  not_started: "시작 전",
  in_progress: "진행 중",
  review_pending: "검토 대기",
  blocked: "막힘",
  done: "완료",
  unknown: "확인 필요",
};

const CONFIDENCE_LABELS = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

const CHAT_MODE_LABELS = {
  mention: "봇 멘션에만 응답",
  prefix: "지정 접두사에만 응답",
  all: "모든 채팅에 응답",
};

function text(value, fallback = "-") {
  if (value === null || value === undefined) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
}

function clip(value, maxLength, fallback = "-") {
  const normalized = text(value, fallback);
  if (normalized.length <= maxLength) return normalized;
  if (maxLength <= 1) return normalized.slice(0, maxLength);
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function projectId(project) {
  return text(project?.id ?? project?.project_id ?? project?.projectId, "default");
}

function projectName(project) {
  return text(
    project?.name ?? project?.title ?? project?.goal?.title,
    "팀 프로젝트",
  );
}

function buildLookup(items, idKeys, valueKeys) {
  const lookup = new Map();
  for (const item of list(items)) {
    const id = idKeys.map((key) => item?.[key]).find(Boolean);
    const value = valueKeys.map((key) => item?.[key]).find(Boolean);
    if (id) lookup.set(String(id), text(value, String(id)));
  }
  return lookup;
}

function taskLookup(project) {
  return buildLookup(
    project?.tasks,
    ["id", "task_id", "taskId"],
    ["text", "title", "name"],
  );
}

function memberLookup(project) {
  return buildLookup(
    project?.members,
    ["id", "member_id", "memberId", "discord_id"],
    ["display_name", "displayName", "name", "username"],
  );
}

function compactComponentId(action, id, revision) {
  const revisionToken = revision === undefined
    ? ""
    : clip(revision, 24, "0");
  const suffix = revision === undefined ? "" : `|r${revisionToken}`;
  const prefix = `${action}|`;
  const available = Math.max(1, 100 - prefix.length - suffix.length);
  return `${prefix}${clip(id, available, "default")}${suffix}`;
}

function limitedEmbed({ title, description, color, fields, footer }) {
  const safeTitle = clip(title, 256);
  const safeDescription = clip(description, 1200);
  const safeFooter = clip(footer, 500);
  const characterLimit = 5800;
  let used = safeTitle.length + safeDescription.length + safeFooter.length;
  let omitted = 0;
  const accepted = [];

  for (const field of list(fields)) {
    if (accepted.length >= 24) {
      omitted += 1;
      continue;
    }

    const name = clip(field?.name, 256);
    const remaining = characterLimit - used - name.length;
    if (remaining < 24) {
      omitted += 1;
      continue;
    }

    const value = clip(field?.value, Math.min(1024, remaining));
    accepted.push({ name, value, inline: Boolean(field?.inline) });
    used += name.length + value.length;
  }

  if (omitted > 0 && accepted.length < 25) {
    const name = "더 있음";
    const value = `${omitted}개 항목은 Discord 표시 한도 때문에 생략했습니다.`;
    if (used + name.length + value.length <= characterLimit) {
      accepted.push({ name, value, inline: false });
    }
  }

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(safeTitle)
    .setDescription(safeDescription)
    .addFields(accepted)
    .setFooter({ text: safeFooter })
    .toJSON();
}

function evidenceSummary(assignment, evidenceById) {
  const quotes = list(assignment?.evidence_ids ?? assignment?.evidenceIds)
    .slice(0, 2)
    .map((id) => evidenceById.get(String(id)))
    .filter(Boolean)
    .map((quote) => `“${clip(quote, 180)}”`);

  if (quotes.length > 0) return quotes.join("\n");
  return clip(assignment?.reason, 360, "사용자 확인이 필요한 배정입니다.");
}

function assignmentFields(result, project) {
  const tasks = taskLookup(project);
  const members = memberLookup(project);
  const evidenceById = buildLookup(
    result?.evidence,
    ["id", "evidence_id", "evidenceId"],
    ["quote", "text", "raw_text"],
  );

  const fields = list(result?.assignments).map((assignment) => {
    const taskId = text(
      assignment?.task_id ?? assignment?.taskId ?? assignment?.task,
      "unknown-task",
    );
    const ownerId = assignment?.owner_id ?? assignment?.ownerId ?? assignment?.owner;
    const taskName = tasks.get(taskId) ?? taskId;
    const ownerName = ownerId
      ? members.get(String(ownerId)) ?? String(ownerId)
      : "미배정";
    const status = STATE_LABELS[assignment?.status] ?? text(assignment?.status, "제안");
    const confidence = CONFIDENCE_LABELS[assignment?.confidence]
      ?? text(assignment?.confidence, "확인 필요");
    const blockers = list(assignment?.blockers).filter(Boolean);

    const lines = [
      `담당: **${clip(ownerName, 120)}** · 상태: ${clip(status, 40)} · 근거 확실성: ${clip(confidence, 40)}`,
      `근거: ${evidenceSummary(assignment, evidenceById)}`,
    ];
    if (blockers.length > 0) {
      lines.push(`막힘: ${clip(blockers.join(" · "), 300)}`);
    }

    return {
      name: clip(`${taskId} · ${taskName}`, 256),
      value: clip(lines.join("\n"), 900),
      inline: false,
    };
  });

  const unassigned = list(result?.unassigned).filter(Boolean);
  if (unassigned.length > 0) {
    fields.push({
      name: "담당자 확인 필요",
      value: clip(unassigned.join(", "), 800),
      inline: false,
    });
  }

  const questions = list(result?.questions).filter(Boolean);
  if (questions.length > 0) {
    fields.push({
      name: "팀이 답해야 할 질문",
      value: clip(questions.map((item) => `• ${item}`).join("\n"), 1000),
      inline: false,
    });
  }

  const warnings = list(result?.warnings)
    .map((item) => item?.message ?? item)
    .filter(Boolean);
  if (warnings.length > 0) {
    fields.push({
      name: "확인 사항",
      value: clip(warnings.map((item) => `• ${item}`).join("\n"), 1000),
      inline: false,
    });
  }

  return fields;
}

/** Buttons and a select menu used to confirm or continue an assignment run. */
export function actionRows(id, revision = 0) {
  const safeProjectId = text(id, "default");
  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(compactComponentId("assignment.confirm", safeProjectId, revision))
      .setLabel("배정 확정")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(compactComponentId("assignment.reassign", safeProjectId, revision))
      .setLabel("조건 반영 후 재배정")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(compactComponentId("progress.refresh", safeProjectId))
      .setLabel("상태 보기")
      .setStyle(ButtonStyle.Secondary),
  );

  const selectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(compactComponentId("project.next", safeProjectId, revision))
      .setPlaceholder("다음 작업 선택")
      .addOptions(
        {
          label: "진행 상태 확인",
          description: "근거가 확인된 Task 진행 상태를 봅니다",
          value: "status",
        },
        {
          label: "산출물 등록 안내",
          description: "Task에 파일을 등록하는 명령을 안내합니다",
          value: "artifact",
        },
        {
          label: "제출 패키지 만들기",
          description: "검증된 산출물을 ZIP으로 묶습니다",
          value: "package",
        },
      ),
  );

  return [buttonRow.toJSON(), selectRow.toJSON()];
}

export function assignmentView(result = {}, project = {}) {
  const id = projectId(project);
  const revision = result?.revision ?? project?.revision ?? 0;
  const goal = text(project?.goal?.title ?? project?.goal, "등록된 목표를 기준으로 검토해 주세요.");
  const mode = text(result?.mode, "unknown");
  const fields = assignmentFields(result, project);

  if (fields.length === 0) {
    fields.push({
      name: "배정 결과 없음",
      value: "Task와 멤버를 등록한 뒤 다시 배정을 실행해 주세요.",
      inline: false,
    });
  }

  return {
    embeds: [
      limitedEmbed({
        title: `${projectName(project)} 역할 배정안`,
        description: `목표: ${goal}\n각 배정의 근거와 막힘을 확인한 뒤 확정해 주세요.`,
        color: COLORS.assignment,
        fields,
        footer: `project ${id} · revision ${revision} · mode ${mode}`,
      }),
    ],
    components: actionRows(id, revision),
    allowedMentions: { parse: [] },
  };
}

function progressBar(percent) {
  if (!Number.isFinite(percent)) return "확인 필요";
  const bounded = Math.max(0, Math.min(100, percent));
  const completed = Math.round(bounded / 10);
  return `${"█".repeat(completed)}${"░".repeat(10 - completed)} ${Math.round(bounded)}%`;
}

function statusComponents(id, taskProgress) {
  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(compactComponentId("progress.refresh", id))
      .setLabel("상태 새로고침")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(compactComponentId("package.create", id))
      .setLabel("제출 ZIP 만들기")
      .setStyle(ButtonStyle.Success),
  );

  const rows = [buttonRow.toJSON()];
  const taskOptions = list(taskProgress).slice(0, 25).map((item, index) => {
    const taskId = text(item?.task_id ?? item?.taskId, `task-${index + 1}`);
    const state = STATE_LABELS[item?.state] ?? text(item?.state, "확인 필요");
    return {
      label: clip(taskId, 100),
      description: clip(`상태: ${state}`, 100),
      value: clip(taskId, 100),
    };
  });

  if (taskOptions.length > 0) {
    rows.push(
      new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(compactComponentId("progress.task", id))
            .setPlaceholder("자세히 볼 Task 선택")
            .addOptions(taskOptions),
        )
        .toJSON(),
    );
  }

  return rows;
}

export function statusView(progress = {}, project = {}) {
  const id = projectId(project);
  const tasks = taskLookup(project);
  const goalProgress = progress?.goal_progress ?? progress?.goalProgress ?? {};
  const taskProgress = list(progress?.task_progress ?? progress?.taskProgress);
  const percent = Number(
    goalProgress?.percent
      ?? progress?.goalPercentage
      ?? progress?.overallPercentage,
  );
  const safePercent = Number.isFinite(percent) ? percent : null;
  const overallStateValue = goalProgress?.state
    ?? progress?.overallState
    ?? progress?.state;
  const overallState = STATE_LABELS[overallStateValue]
    ?? text(overallStateValue, "확인 필요");

  const fields = taskProgress.map((item) => {
    const taskId = text(item?.task_id ?? item?.taskId, "unknown-task");
    const taskName = tasks.get(taskId) ?? taskId;
    const state = STATE_LABELS[item?.state] ?? text(item?.state, "확인 필요");
    const taskPercentValue = Number(item?.percent ?? item?.percentage);
    const taskPercent = Number.isFinite(taskPercentValue)
      ? ` · ${Math.round(Math.max(0, Math.min(100, taskPercentValue)))}%`
      : "";
    const lines = [`상태: **${state}**${taskPercent}`];
    const taskBlockers = list(item?.blockers).filter(Boolean);
    const blocker = item?.blocker ?? (taskBlockers.length > 0 ? taskBlockers.join(" · ") : null);
    if (blocker) lines.push(`막힘: ${clip(blocker, 320)}`);
    lines.push(`다음 행동: ${clip(item?.next_action ?? item?.nextAction, 420, "추가 확인 필요")}`);
    const evidenceCount = list(item?.evidence_ids ?? item?.evidenceIds).length;
    lines.push(`확인된 근거: ${evidenceCount}개`);
    return {
      name: clip(`${taskId} · ${taskName}`, 256),
      value: clip(lines.join("\n"), 900),
      inline: false,
    };
  });

  const blockers = list(progress?.blockers).filter(Boolean);
  if (blockers.length > 0) {
    fields.push({
      name: "프로젝트 막힘",
      value: clip(blockers.map((item) => `• ${item}`).join("\n"), 1000),
      inline: false,
    });
  }

  const unknownTaskIds = list(goalProgress?.unknown_task_ids ?? goalProgress?.unknownTaskIds);
  if (unknownTaskIds.length > 0) {
    fields.push({
      name: "근거 확인이 필요한 Task",
      value: clip(unknownTaskIds.join(", "), 900),
      inline: false,
    });
  }

  const questions = list(progress?.questions).filter(Boolean);
  if (questions.length > 0) {
    fields.push({
      name: "팀이 답해야 할 질문",
      value: clip(questions.map((item) => `• ${item}`).join("\n"), 1000),
      inline: false,
    });
  }

  if (fields.length === 0) {
    fields.push({
      name: "진행 근거 없음",
      value: "Task 상태, 체크리스트 또는 산출물을 등록해 주세요.",
      inline: false,
    });
  }

  return {
    embeds: [
      limitedEmbed({
        title: `${projectName(project)} 준비 상태`,
        description: `전체 상태: **${overallState}**\n${progressBar(safePercent)}`,
        color: COLORS.status,
        fields,
        footer: `project ${id} · mode ${text(progress?.mode, "unknown")}`,
      }),
    ],
    components: statusComponents(id, taskProgress),
    allowedMentions: { parse: [] },
  };
}

function chatMessagePreview(item, index) {
  if (typeof item === "string") return `${index + 1}. ${clip(item, 420)}`;
  const author = text(
    item?.authorName
      ?? item?.author_name
      ?? item?.displayName
      ?? item?.author?.displayName
      ?? item?.author?.username,
    "알 수 없는 사용자",
  );
  const content = text(
    item?.content ?? item?.text ?? item?.message,
    "(본문 없음)",
  );
  return `${index + 1}. **${clip(author, 80)}**: ${clip(content, 380)}`;
}

/** Show whether live chat forwarding is enabled without exposing credentials. */
export function chatStatusView(status = {}) {
  const enabled = Boolean(status?.enabled ?? status?.active);
  const modeValue = text(status?.mode, "mention");
  const mode = CHAT_MODE_LABELS[modeValue] ?? modeValue;
  const historyLimit = Number(status?.historyLimit ?? status?.history_limit ?? 10);
  const safeHistoryLimit = Number.isFinite(historyLimit)
    ? Math.max(1, Math.min(20, Math.round(historyLimit)))
    : 10;
  const prefix = text(status?.prefix, "설정 안 됨");
  const model = text(status?.model ?? status?.openaiModel, "환경 설정값 사용");
  const aiMode = text(status?.aiMode ?? status?.ai_mode, "live");
  const messageIntent = status?.messageContentIntent
    ?? status?.message_content_intent;
  const lastResult = status?.lastResult ?? status?.last_result;

  const fields = [
    {
      name: "응답 방식",
      value: enabled ? mode : "꺼짐",
      inline: true,
    },
    {
      name: "함께 보내는 최근 채팅",
      value: `${safeHistoryLimit}개`,
      inline: true,
    },
    {
      name: "GPT 연결",
      value: `${aiMode} · ${model}`,
      inline: false,
    },
  ];

  if (modeValue === "prefix") {
    fields.splice(1, 0, {
      name: "접두사",
      value: clip(prefix, 64),
      inline: true,
    });
  }

  if (messageIntent !== undefined) {
    fields.push({
      name: "채팅 읽기 권한",
      value: messageIntent ? "사용 가능" : "꺼짐 — Developer Portal에서 켜야 합니다",
      inline: false,
    });
  }

  if (lastResult) {
    fields.push({
      name: "최근 처리",
      value: clip(
        lastResult?.summary
          ?? lastResult?.message
          ?? lastResult,
        600,
      ),
      inline: false,
    });
  }

  return {
    embeds: [
      limitedEmbed({
        title: "실시간 GPT 채팅 연결 상태",
        description: enabled
          ? "이 채널의 새 메시지를 설정한 방식으로 GPT에 전달합니다."
          : "현재 이 채널의 자동 전달은 꺼져 있습니다.",
        color: enabled ? COLORS.chatSuccess : COLORS.chat,
        fields,
        footer: "토큰과 API 키 값은 화면에 표시하지 않습니다.",
      }),
    ],
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  };
}

/** Show the exact bounded chat preview sent to GPT and the returned text. */
export function chatTestView(result = {}) {
  const inputMessages = list(
    result?.inputMessages
      ?? result?.input_messages
      ?? result?.messages
      ?? result?.history,
  );
  const shownMessages = inputMessages.slice(-10);
  const preview = shownMessages.length > 0
    ? shownMessages.map(chatMessagePreview).join("\n")
    : "불러온 채팅이 없습니다.";
  const output = text(
    result?.output
      ?? result?.answer
      ?? result?.response?.output_text
      ?? result?.response?.text
      ?? result?.response,
    "GPT 출력이 없습니다.",
  );
  const model = text(result?.model, "환경 설정값 사용");
  const responseId = text(result?.responseId ?? result?.response_id, "없음");
  const elapsedValue = Number(result?.elapsedMs ?? result?.elapsed_ms ?? result?.latencyMs);
  const elapsed = Number.isFinite(elapsedValue) ? `${Math.max(0, Math.round(elapsedValue))}ms` : "측정 안 됨";
  const sentCountValue = Number(
    result?.sentCount
      ?? result?.sent_count
      ?? result?.inputMessageCount
      ?? inputMessages.length,
  );
  const sentCount = Number.isFinite(sentCountValue)
    ? Math.max(0, Math.round(sentCountValue))
    : inputMessages.length;

  return {
    embeds: [
      limitedEmbed({
        title: "GPT 채팅 연결 테스트 성공",
        description: "Discord 채팅을 불러와 GPT에 전달하고 출력까지 받았습니다.",
        color: COLORS.chatSuccess,
        fields: [
          {
            name: `GPT에 전달한 최근 채팅 (${sentCount}개)`,
            value: clip(preview, 1024),
            inline: false,
          },
          {
            name: "GPT 출력",
            value: clip(output, 1024),
            inline: false,
          },
          {
            name: "처리 정보",
            value: clip(`모델: ${model}\n응답 ID: ${responseId}\n처리 시간: ${elapsed}`, 600),
            inline: false,
          },
        ],
        footer: inputMessages.length > shownMessages.length
          ? `가장 최근 ${shownMessages.length}개만 미리보기로 표시했습니다.`
          : "이 결과는 명령을 실행한 사용자에게만 표시됩니다.",
      }),
    ],
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  };
}

export function errorView(message) {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.error)
        .setTitle("요청을 처리하지 못했습니다")
        .setDescription(clip(message, 1800, "잠시 후 다시 시도해 주세요."))
        .setFooter({ text: "입력값을 확인한 뒤 다시 실행해 주세요." })
        .toJSON(),
    ],
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  };
}
