const STATUS = {
  on_track: ["🟢", "순항 중", 0x57f287],
  attention: ["🟡", "확인 필요", 0xfee75c],
  blocked: ["🔴", "막힘", 0xed4245],
  complete: ["🎉", "완료", 0x5865f2],
  done: ["✅", "완료"],
  working: ["🔄", "진행 중"],
  waiting: ["⏳", "대기"],
  blocked_member: ["🔴", "막힘"],
  unknown: ["⚪", "판단 보류"]
};

export function progressBar(percent, width = 12) {
  const filled = Math.round((Math.max(0, Math.min(100, percent)) / 100) * width);
  return `${"▰".repeat(filled)}${"▱".repeat(width - filled)}`;
}

export function memberStatus(member) {
  const [icon, label] = STATUS[member.status] || STATUS.unknown;
  return `${icon} ${member.name} · **${member.percent}%** (${label})\n${progressBar(member.percent, 10)}\n${member.next_action || "다음 행동 확인 필요"}`;
}

function bullet(items, empty = "없음") {
  return items?.length ? items.map((item) => `• ${item}`).join("\n") : empty;
}

/** Discord 의존성을 분리해 UI 내용을 단위 테스트할 수 있게 합니다. */
export function dashboardContent(report, updatedAt = new Date()) {
  const [icon, statusText] = STATUS[report.overall_status] || STATUS.attention;
  return {
    title: `${icon} 프로젝트 진행 현황 · ${report.overall_percent}%`,
    description: `**${report.headline}**\n\`${progressBar(report.overall_percent)}\` **${report.overall_percent}%** · ${statusText}`,
    fields: [
      { name: "✅ 완료", value: bullet(report.done), inline: true },
      { name: "🔄 진행 중", value: bullet(report.in_progress), inline: true },
      { name: "👉 지금 할 일", value: bullet(report.next_actions), inline: false },
      { name: report.risks?.length ? "⚠️ 위험 / 막힘" : "✨ 확인된 막힘 없음", value: bullet(report.risks, "대화상 확인된 blocker가 없습니다."), inline: false },
      ...report.members.slice(0, 8).map((member) => ({ name: "‎", value: memberStatus(member), inline: true }))
    ],
    footer: `대화 근거 기반 · ${report.evidence_note}`,
    timestamp: updatedAt.toISOString()
  };
}

export async function createDashboard(report, { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle }, updatedAt) {
  const [,, color] = STATUS[report.overall_status] || STATUS.attention;
  const content = dashboardContent(report, updatedAt);
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(content.title)
    .setDescription(content.description)
    .addFields(content.fields)
    .setFooter({ text: content.footer })
    .setTimestamp(updatedAt || new Date());
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("progress:refresh").setLabel("새로고침").setEmoji("↻").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("progress:details").setLabel("개인별 상세").setEmoji("👥").setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [embed], components: [buttons] };
}

export function detailContent(report) {
  return report.members.map((member) => ({
    name: `${member.name} · ${member.percent}%`,
    value: `${memberStatus(member)}\n완료: ${bullet(member.completed)}\n진행: ${bullet(member.working_on)}${member.blockers?.length ? `\n막힘: ${bullet(member.blockers)}` : ""}`.slice(0, 1024),
    inline: false
  }));
}

