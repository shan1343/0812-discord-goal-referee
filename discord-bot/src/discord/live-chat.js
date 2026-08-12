const DISCORD_MESSAGE_LIMIT = 2_000;
const MAX_HISTORY_TURNS = 20;
const MAX_COOLDOWN_MS = 30_000;

function clampInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function safeDate(message) {
  const date = message?.createdAt instanceof Date
    ? message.createdAt
    : new Date(message?.createdTimestamp ?? Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function botId(message, config) {
  return message?.client?.user?.id ?? config?.discord?.applicationId ?? null;
}

function isMentioned(message, id) {
  if (!id) return false;
  if (message?.mentions?.users?.has?.(id)) return true;
  return new RegExp(`<@!?${String(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}>`).test(message?.content ?? "");
}

function settingsFor(project, config) {
  const defaults = config?.liveChat ?? config?.discord?.liveChat ?? {};
  const liveChat = project?.liveChat ?? {};
  const trigger = liveChat.trigger
    ?? liveChat.mode
    ?? (liveChat.requirePrefix ? "prefix" : null)
    ?? (liveChat.mentionOnly ? "mention" : null)
    ?? defaults.trigger
    ?? "all";
  return {
    enabled: liveChat.enabled === true,
    channelId: String(liveChat.channelId ?? project?.channelId ?? ""),
    trigger,
    prefix: String(liveChat.prefix ?? defaults.prefix ?? "!gpt").trim(),
    historyEnabled: liveChat.historyEnabled !== false,
    historyLimit: clampInteger(liveChat.historyLimit ?? defaults.historyLimit ?? defaults.maxHistory, 8, 0, MAX_HISTORY_TURNS),
    cooldownMs: clampInteger(liveChat.cooldownMs ?? defaults.cooldownMs, 750, 0, MAX_COOLDOWN_MS),
    showTrace: liveChat.showTrace ?? defaults.showTrace ?? defaults.showDiagnostics ?? true,
  };
}

function triggeredContent(message, settings, id) {
  let content = String(message?.content ?? "").trim();
  const hasPrefix = Boolean(settings.prefix) && content.startsWith(settings.prefix);
  const hasMention = isMentioned(message, id);

  if (settings.trigger === "prefix" && !hasPrefix) return null;
  if (settings.trigger === "mention" && !hasMention) return null;
  if (settings.trigger === "prefix_or_mention" && !hasPrefix && !hasMention) return null;
  if (!["all", "prefix", "mention", "prefix_or_mention"].includes(settings.trigger)) return null;

  if (hasPrefix) content = content.slice(settings.prefix.length).trim();
  if (hasMention && id) {
    content = content.replace(new RegExp(`<@!?${String(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}>`, "g"), "").trim();
  }
  return content || null;
}

function expandStoredTurns(turns) {
  const expanded = [];
  for (const turn of Array.isArray(turns) ? turns : []) {
    if (turn?.role && (turn.content ?? turn.text)) {
      expanded.push({ role: turn.role, content: turn.content ?? turn.text });
      continue;
    }
    if (turn?.userText) expanded.push({ role: "user", content: turn.userText });
    if (turn?.assistantText) expanded.push({ role: "assistant", content: turn.assistantText });
  }
  return expanded;
}

function recentHistory(project, settings) {
  if (!settings.historyEnabled || settings.historyLimit <= 0) return [];
  const stored = project?.liveChatTurns ?? project?.liveChat?.history ?? project?.liveChat?.turns ?? [];
  return expandStoredTurns(stored).slice(-settings.historyLimit);
}

function traceHeader(historyCount) {
  return [
    "🔎 1/3 Discord 메시지 수신 완료",
    `🧾 입력 준비 완료 · 현재 메시지 1개 · 최근 대화 ${historyCount}개`,
    "🤖 2/3 GPT API 전송 중…",
  ].join("\n");
}

function diagnosticReply(result, historyCount) {
  const diagnostics = result?.diagnostics ?? {};
  const usage = diagnostics.usage ?? {};
  const responseId = diagnostics.responseId ?? "없음(mock)";
  const header = [
    "✅ 3/3 GPT 응답 수신 완료",
    `입력: 현재 메시지 1개 + 최근 대화 ${historyCount}개`,
    `모드/모델: ${diagnostics.mode ?? "unknown"} / ${diagnostics.model ?? "unknown"}`,
    `응답 ID: ${responseId}`,
    `토큰: 입력 ${usage.inputTokens ?? 0} · 출력 ${usage.outputTokens ?? 0} · 합계 ${usage.totalTokens ?? 0}`,
    `응답 시간: ${diagnostics.latencyMs ?? 0}ms`,
    "",
  ].join("\n");
  const available = Math.max(0, DISCORD_MESSAGE_LIMIT - header.length - 1);
  const output = String(result?.text ?? "").slice(0, available);
  return `${header}${output}`;
}

async function editOrReply(message, statusMessage, content) {
  const payload = { content, allowedMentions: { parse: [], repliedUser: false } };
  if (typeof statusMessage?.edit === "function") return statusMessage.edit(payload);
  return message.reply(payload);
}

async function hydrate(message) {
  if (message?.partial && typeof message.fetch === "function") return message.fetch();
  return message;
}

function authorName(message) {
  return message?.member?.displayName
    ?? message?.author?.globalName
    ?? message?.author?.username
    ?? null;
}

export function createLiveChatHandler({ service, responder, config = {}, logger = console } = {}) {
  if (typeof service?.getProject !== "function") throw new TypeError("service.getProject is required");
  if (typeof responder?.respond !== "function") throw new TypeError("responder.respond is required");

  const queues = new Map();
  const lastStartedAt = new Map();
  const processed = new Map();

  async function processMessage(message) {
    const project = await service.getProject(message.guildId, message.channelId);
    if (!project) return { processed: false, reason: "project_not_found" };

    const settings = settingsFor(project, config);
    if (!settings.enabled) return { processed: false, reason: "disabled" };
    if (settings.channelId && settings.channelId !== String(message.channelId)) {
      return { processed: false, reason: "channel_mismatch" };
    }

    const content = triggeredContent(message, settings, botId(message, config));
    if (!content) return { processed: false, reason: "trigger_not_matched" };

    const key = `${message.guildId}:${message.channelId}`;
    const waitMs = Math.max(0, (lastStartedAt.get(key) ?? 0) + settings.cooldownMs - Date.now());
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastStartedAt.set(key, Date.now());

    const history = recentHistory(project, settings);
    let statusMessage = null;
    if (settings.showTrace) {
      statusMessage = await message.reply({
        content: traceHeader(history.length),
        allowedMentions: { parse: [], repliedUser: false },
      });
    } else {
      await message.channel?.sendTyping?.().catch?.(() => undefined);
    }

    try {
      const result = await responder.respond({
        project,
        history,
        message: {
          id: message.id,
          authorId: message.author?.id ?? null,
          authorName: authorName(message),
          content,
          createdAt: safeDate(message),
          source: `discord-message#${message.channelId}/${message.id}`,
        },
      });

      if (settings.historyEnabled && typeof service.recordLiveChatTurn === "function") {
        try {
          await service.recordLiveChatTurn({
            guildId: message.guildId,
            channelId: message.channelId,
            maxTurns: settings.historyLimit,
            userTurn: {
              id: message.id,
              authorId: message.author?.id ?? null,
              authorName: authorName(message),
              content,
              occurredAt: safeDate(message),
              source: `discord-message#${message.channelId}/${message.id}`,
            },
            assistantTurn: {
              id: `assistant-${message.id}`,
              content: result.text,
              occurredAt: new Date().toISOString(),
              source: `openai-response#${result.diagnostics?.responseId ?? "mock"}`,
            },
            diagnostics: result.diagnostics,
            turn: {
              messageId: message.id,
              responseId: result.diagnostics?.responseId ?? null,
              model: result.diagnostics?.model ?? null,
              usage: result.diagnostics?.usage ?? null,
            },
          });
        } catch (error) {
          logger.warn?.("Live chat history could not be saved", {
            guildId: message.guildId,
            channelId: message.channelId,
            messageId: message.id,
            errorName: error?.name ?? "Error",
          });
        }
      }

      await editOrReply(message, statusMessage, diagnosticReply(result, history.length));
      logger.info?.("Live chat response completed", {
        guildId: message.guildId,
        channelId: message.channelId,
        messageId: message.id,
        responseId: result.diagnostics?.responseId ?? null,
        model: result.diagnostics?.model ?? null,
        latencyMs: result.diagnostics?.latencyMs ?? null,
      });
      return { processed: true, result };
    } catch (error) {
      logger.error?.("Live chat request failed", {
        guildId: message.guildId,
        channelId: message.channelId,
        messageId: message.id,
        errorName: error?.name ?? "Error",
      });
      await editOrReply(
        message,
        statusMessage,
        "❌ GPT API 호출에 실패했습니다. 설정과 사용량 한도를 확인한 뒤 다시 보내주세요. 채팅 원문과 API 키는 로그에 기록하지 않았습니다.",
      ).catch(() => undefined);
      return { processed: false, reason: "api_error" };
    }
  }

  return async function handleLiveChat(originalMessage) {
    const message = await hydrate(originalMessage).catch(() => null);
    if (!message) return { processed: false, reason: "message_unavailable" };
    if (!message.guildId || !message.channelId) return { processed: false, reason: "direct_message" };
    if (message.author?.bot) return { processed: false, reason: "bot" };
    if (message.webhookId) return { processed: false, reason: "webhook" };
    if (!String(message.content ?? "").trim()) return { processed: false, reason: "empty" };

    const key = `${message.guildId}:${message.channelId}`;
    const messageKey = `${key}:${message.id}`;
    if (processed.has(messageKey)) return processed.get(messageKey);
    const previous = queues.get(key) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(() => processMessage(message));
    queues.set(key, current);
    processed.set(messageKey, current);
    current.finally(() => {
      if (queues.get(key) === current) queues.delete(key);
      setTimeout(() => processed.delete(messageKey), 5 * 60_000).unref?.();
    }).catch(() => undefined);
    return current;
  };
}

export { diagnosticReply, recentHistory, settingsFor, triggeredContent };
