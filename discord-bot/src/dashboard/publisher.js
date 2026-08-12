function endpoint(apiUrl) {
  return new URL("/api/goal-referee/results", apiUrl).toString();
}

export function createDashboardPublisher({ apiUrl = "", ingestToken = "", fetchImpl = fetch, logger = console } = {}) {
  const enabled = Boolean(apiUrl && ingestToken);

  async function publish({ guildId, channelId, result }) {
    if (!enabled) return { published: false, reason: "disabled" };

    let response;
    try {
      response = await fetchImpl(endpoint(apiUrl), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goal-referee-token": ingestToken,
        },
        body: JSON.stringify({
          guildId,
          channelId,
          generatedAt: new Date().toISOString(),
          ...result,
        }),
      });
    } catch (error) {
      logger.warn?.("Dashboard publish failed", { message: error.message });
      return { published: false, reason: "network_error" };
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      logger.warn?.("Dashboard publish rejected", { status: response.status, detail: detail.slice(0, 300) });
      return { published: false, reason: "rejected" };
    }
    return { published: true };
  }

  return { enabled, publish };
}
