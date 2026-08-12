/**
 * Discord.js Message 객체와 과제용 JSON export를 같은 분석 입력으로 바꿉니다.
 * 봇 메시지는 사람이 실제로 보고한 작업 상태가 아니므로 기본적으로 제외합니다.
 */
export function normalizeConversation(source, { includeBots = false, limit = 120 } = {}) {
  const raw = Array.isArray(source) ? source : source?.messages;
  if (!Array.isArray(raw)) throw new Error("messages 배열을 찾지 못했습니다.");

  return raw
    .map((message, index) => ({ message, sourceIndex: index + 1 }))
    .filter(({ message }) => includeBots || !(message.is_bot || message.author?.bot))
    .map(({ message, sourceIndex }) => ({
      id: String(message.id ?? `source-${sourceIndex}`),
      author: message.author?.globalName || message.author?.displayName || message.author?.username || message.author || "알 수 없음",
      content: String(message.content ?? "").trim(),
      timestamp: message.createdTimestamp
        ? new Date(message.createdTimestamp).toISOString()
        : [message.day, message.timestamp].filter(Boolean).join(" ") || "시간 정보 없음",
      sourceIndex
    }))
    .filter((message) => message.content)
    .slice(-limit);
}

export function transcriptForModel(messages) {
  return messages.map((message) =>
    `[${message.sourceIndex} | ${message.timestamp} | ${message.author}] ${message.content}`
  ).join("\n");
}

