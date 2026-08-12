function required(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${name} is required`);
  return value.trim();
}

export function createDashboardPublisher({
  apiBaseUrl,
  ingestToken,
  webBaseUrl,
  fetchImpl = fetch,
  clock = () => new Date(),
} = {}) {
  const api = String(apiBaseUrl || "").replace(/\/$/, "");
  const web = String(webBaseUrl || "").replace(/\/$/, "");

  return Object.freeze({
    configured: Boolean(api && ingestToken),
    dashboardUrl(channelId) {
      if (!web) return null;
      const url = new URL(web);
      url.searchParams.set("channel", required(channelId, "channelId"));
      return url.toString();
    },
    async publish({ guildId, channelId, result, sourceMessageCount }) {
      if (!api || !ingestToken) return { published: false, reason: "not_configured" };
      const payload = {
        schemaVersion: "1.0",
        guildId: required(guildId, "guildId"),
        channelId: required(channelId, "channelId"),
        generatedAt: clock().toISOString(),
        summary: result.summary,
        tasks: result.tasks,
        questions: result.questions,
        sourceMessageCount,
      };
      const response = await fetchImpl(`${api}/api/goal-referee/results`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${ingestToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Dashboard publish failed (${response.status})`);
      return { published: true, payload };
    },
  });
}
