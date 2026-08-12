import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  SlashCommandBuilder,
} from "discord.js";

const PROGRESS_STATES = [
  ["시작 전", "not_started"],
  ["진행 중", "in_progress"],
  ["검토 대기", "review_pending"],
  ["막힘", "blocked"],
  ["완료", "done"],
  ["확인 필요", "unknown"],
];

function addTaskId(option) {
  return option
    .setName("task")
    .setDescription("Task ID")
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(100);
}

/**
 * Return application-command definitions that can be sent directly to
 * Discord's command registration endpoint.
 */
export function buildCommands() {
  const project = new SlashCommandBuilder()
    .setName("project")
    .setDescription("이 채널의 프로젝트를 관리합니다")
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("프로젝트 목표와 완료 조건을 등록합니다")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("프로젝트 이름")
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(100),
        )
        .addStringOption((option) =>
          option
            .setName("goal")
            .setDescription("팀이 달성할 목표")
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(300),
        )
        .addStringOption((option) =>
          option
            .setName("deadline")
            .setDescription("마감 일시 (예: 2026-08-15 18:00+09:00)")
            .setRequired(true)
            .setMinLength(10)
            .setMaxLength(40),
        )
        .addStringOption((option) =>
          option
            .setName("done")
            .setDescription("완료로 판단할 조건")
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(1000),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("members")
        .setDescription("프로젝트 멤버를 조회하거나 변경합니다")
        .addStringOption((option) =>
          option
            .setName("action")
            .setDescription("수행할 작업")
            .setRequired(true)
            .addChoices(
              { name: "목록 보기", value: "list" },
              { name: "멤버 추가", value: "add" },
              { name: "멤버 제외", value: "remove" },
            ),
        )
        .addUserOption((option) =>
          option
            .setName("member")
            .setDescription("추가하거나 제외할 Discord 멤버")
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete")
        .setDescription("이 채널의 프로젝트 데이터를 삭제합니다")
        .addBooleanOption((option) =>
          option
            .setName("confirm")
            .setDescription("삭제를 확인합니다")
            .setRequired(true),
        ),
    );

  const task = new SlashCommandBuilder()
    .setName("task")
    .setDescription("프로젝트 Task를 관리합니다")
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("새 Task를 추가합니다")
        .addStringOption((option) =>
          option
            .setName("text")
            .setDescription("해야 할 일")
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(1000),
        )
        .addStringOption((option) =>
          option
            .setName("skills")
            .setDescription("필요한 기술 (쉼표로 구분)")
            .setRequired(false)
            .setMaxLength(500),
        )
        .addNumberOption((option) =>
          option
            .setName("effort")
            .setDescription("예상 작업량 (기본값 1)")
            .setRequired(false)
            .setMinValue(0.1)
            .setMaxValue(100),
        )
        .addStringOption((option) =>
          option
            .setName("deadline")
            .setDescription("Task 마감 일시")
            .setRequired(false)
            .setMinLength(10)
            .setMaxLength(40),
        )
        .addStringOption((option) =>
          option
            .setName("required_files")
            .setDescription("필수 파일 이름 (쉼표로 구분)")
            .setRequired(false)
            .setMaxLength(1000),
        )
        .addStringOption((option) =>
          option
            .setName("dependencies")
            .setDescription("선행 Task ID (쉼표로 구분)")
            .setRequired(false)
            .setMaxLength(500),
        )
        .addStringOption((option) =>
          option
            .setName("done_conditions")
            .setDescription("완료조건 (세미콜론으로 구분)")
            .setRequired(false)
            .setMaxLength(1000),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("update")
        .setDescription("Task 내용이나 진행 상태를 갱신합니다")
        .addStringOption(addTaskId)
        .addStringOption((option) =>
          option
            .setName("text")
            .setDescription("변경할 해야 할 일")
            .setRequired(false)
            .setMinLength(1)
            .setMaxLength(1000),
        )
        .addUserOption((option) =>
          option
            .setName("owner")
            .setDescription("사용자가 확정하는 담당자")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("state")
            .setDescription("현재 진행 상태")
            .setRequired(false)
            .addChoices(
              ...PROGRESS_STATES.map(([name, value]) => ({ name, value })),
            ),
        )
        .addStringOption((option) =>
          option
            .setName("blocker")
            .setDescription("진행을 막는 요소, 없으면 생략")
            .setRequired(false)
            .setMaxLength(1000),
        )
        .addStringOption((option) =>
          option
            .setName("next_action")
            .setDescription("다음에 할 구체적인 행동")
            .setRequired(false)
            .setMinLength(1)
            .setMaxLength(1000),
        )
        .addStringOption((option) =>
          option
            .setName("deadline")
            .setDescription("변경할 Task 마감 일시")
            .setRequired(false)
            .setMinLength(10)
            .setMaxLength(40),
        ),
    );

  const assign = new SlashCommandBuilder()
    .setName("assign")
    .setDescription("등록된 근거와 제약으로 역할 배정안을 만듭니다")
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("task")
        .setDescription("이 Task만 배정할 때 입력하는 Task ID")
        .setRequired(false)
        .setMinLength(1)
        .setMaxLength(100),
    )
    .addStringOption((option) =>
      option
        .setName("note")
        .setDescription("이번 배정에서 반드시 고려할 조건")
        .setRequired(false)
        .setMaxLength(1000),
    );

  const status = new SlashCommandBuilder()
    .setName("status")
    .setDescription("근거가 확인된 프로젝트 준비 상태를 보여줍니다")
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("task")
        .setDescription("특정 Task만 볼 때 입력하는 Task ID")
        .setRequired(false)
        .setMinLength(1)
        .setMaxLength(100),
    );

  const packageCommand = new SlashCommandBuilder()
    .setName("package")
    .setDescription("검증된 산출물과 manifest를 ZIP으로 묶습니다")
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("artifacts")
        .setDescription("묶을 Artifact ID (쉼표로 구분, 생략 시 전체)")
        .setRequired(false)
        .setMaxLength(1000),
    );

  const artifact = new SlashCommandBuilder()
    .setName("artifact")
    .setDescription("Task 산출물을 관리합니다")
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("upload")
        .setDescription("Task에 산출물 파일을 등록합니다")
        .addStringOption(addTaskId)
        .addAttachmentOption((option) =>
          option
            .setName("file")
            .setDescription("등록할 산출물 파일")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("version")
            .setDescription("산출물 버전 (예: v1)")
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(100),
        )
        .addBooleanOption((option) =>
          option
            .setName("required")
            .setDescription("완료에 반드시 필요한 파일인지 표시")
            .setRequired(false),
        ),
    );

  const chat = new SlashCommandBuilder()
    .setName("chat")
    .setDescription("Discord 채팅을 GPT에 연결하고 동작을 확인합니다")
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("setup")
        .setDescription("이 채널의 실시간 GPT 연결 방식을 설정하고 켭니다")
        .addStringOption((option) =>
          option
            .setName("mode")
            .setDescription("GPT가 응답할 채팅을 선택합니다")
            .setRequired(true)
            .addChoices(
              { name: "봇 멘션에만 응답", value: "mention" },
              { name: "지정 접두사에만 응답", value: "prefix" },
              { name: "모든 채팅에 응답 (인텐트 필요)", value: "all" },
            ),
        )
        .addStringOption((option) =>
          option
            .setName("prefix")
            .setDescription("접두사 모드에서 사용할 시작 문자열 (예: !gpt)")
            .setRequired(false)
            .setMinLength(1)
            .setMaxLength(32),
        )
        .addIntegerOption((option) =>
          option
            .setName("history_limit")
            .setDescription("GPT에 함께 보낼 최근 채팅 수 (기본값 10)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(20),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("off")
        .setDescription("이 채널의 실시간 GPT 연결을 끕니다"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("status")
        .setDescription("이 채널의 연결 방식과 최근 처리 상태를 확인합니다"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("test")
        .setDescription("최근 채팅이 GPT에 전달되고 답변되는지 한 번 확인합니다")
        .addStringOption((option) =>
          option
            .setName("prompt")
            .setDescription("최근 채팅과 함께 GPT에 보낼 테스트 질문")
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(2000),
        ),
    );

  const addAsEvidence = new ContextMenuCommandBuilder()
    .setName("근거로 추가")
    .setType(ApplicationCommandType.Message)
    .setDMPermission(false);

  const goalReferee = new SlashCommandBuilder()
    .setName("goal-referee")
    .setDescription("최근 채널 대화로 역할과 할 일을 제안합니다")
    .setDMPermission(false)
    .addIntegerOption((option) => option
      .setName("messages")
      .setDescription("분석할 최근 메시지 수 (기본 40)")
      .setRequired(false)
      .setMinValue(30)
      .setMaxValue(50));

  return [
    project,
    task,
    assign,
    status,
    packageCommand,
    artifact,
    chat,
    goalReferee,
    addAsEvidence,
  ].map((command) => command.toJSON());
}
