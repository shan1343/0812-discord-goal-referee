import Head from "next/head";
import { useEffect, useMemo, useState } from "react";

const fixtureAssignments = [
  { id: "fixture-1", task: "Discord Bot · API · 웹 통합", owner: "도윤", confidence: 96, reason: "Bot과 GitHub 연동, 배포를 맡겠다는 명시적 약속", evidence: "09:02 Discord 메시지 · GitHub commit", status: "proposed", blocker: null },
  { id: "fixture-2", task: "가짜 대화 · 파일 Fixture", owner: "서연", confidence: 94, reason: "개인정보 없는 fixture 5개를 만들겠다는 약속", evidence: "09:03 Discord 메시지 · 첨부 JSON", status: "proposed", blocker: null },
];

function apiUrl() {
  const base = process.env.NEXT_PUBLIC_GOAL_REFEREE_API_URL;
  return base ? new URL("/api/goal-referee/latest", base).toString() : "";
}

function asAssignments(result) {
  return result.tasks.map((task, index) => ({
    id: `live-${index}`,
    task: task.title,
    owner: task.ownerName,
    confidence: task.status === "proposed" ? 80 : 0,
    reason: task.reason,
    evidence: task.evidenceMessageIds.length
      ? `Discord 메시지 ${task.evidenceMessageIds.join(", ")}`
      : "추가 근거 필요",
    status: task.status,
    blocker: task.status === "needs_input" ? "담당자 확인 필요" : null,
  }));
}

export default function Home() {
  const [assignments, setAssignments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [loadState, setLoadState] = useState("loading");

  useEffect(() => {
    const url = apiUrl();
    if (!url) {
      setLoadState("not_configured");
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch(url);
        if (response.status === 404) {
          if (alive) setLoadState("waiting");
          return;
        }
        if (!response.ok) throw new Error("dashboard API request failed");
        const next = await response.json();
        const mapped = asAssignments(next);
        if (!alive) return;
        setResult(next);
        setAssignments(mapped);
        setSelected(mapped[0]?.id || null);
        setLoadState("live");
      } catch {
        if (alive) setLoadState("unavailable");
      }
    };
    load();
    const timer = window.setInterval(load, 15000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  const visibleAssignments = assignments.length ? assignments : fixtureAssignments;
  const active = visibleAssignments.find((item) => item.id === selected) || visibleAssignments[0];
  const progress = useMemo(() => visibleAssignments.map((item) => {
    if (!item.owner) return { ...item, percent: null, state: "판단 불가", next: "대화 화자와 Discord 계정을 연결하세요." };
    if (item.blocker) return { ...item, percent: 35, state: "확인 필요", next: "담당자와 제약 조건을 확인하세요." };
    return { ...item, percent: 40, state: "제안됨", next: "사람이 배정을 확인하세요." };
  }), [visibleAssignments]);

  const liveLabel = {
    loading: "대시보드 연결 중",
    live: "Discord 분석 결과 동기화됨",
    waiting: "Discord에서 /goal-referee를 실행하세요",
    unavailable: "대시보드 API 연결 실패",
    not_configured: "대시보드 API 설정 필요",
  }[loadState];

  return <>
    <Head>
      <title>Discord Goal Referee</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="description" content="Evidence-based project coordination for Discord teams" />
    </Head>
    <main>
      <nav><div className="brand"><span className="mark">GR</span><span>Goal Referee</span></div><div className="live"><i /> {liveLabel}</div></nav>
      <header>
        <div><p className="eyebrow">EVIDENCE, NOT ACTIVITY</p><h1>대화를 역할과<br/><em>진행의 근거</em>로.</h1></div>
        <div className="intro">
          <p>{result?.summary || "Discord 프로젝트 채널의 약속·마감·파일을 구조화해 역할을 제안합니다. 사람을 감시하거나 메시지량으로 평가하지 않습니다."}</p>
          <div className="actions"><button onClick={() => window.location.reload()}>최신 결과 새로고침</button></div>
        </div>
      </header>

      <section className="metrics">
        <div><b>{result ? visibleAssignments.reduce((sum, item) => sum + (item.evidence.split(", ").length || 0), 0) : "—"}</b><span>근거 메시지</span></div>
        <div><b>{result ? visibleAssignments.filter((item) => item.owner).length : "—"}</b><span>역할 후보</span></div>
        <div><b>{result ? visibleAssignments.filter((item) => item.status === "needs_input").length : "—"}</b><span>확인 필요</span></div>
        <div><b>0</b><span>자동 확정</span></div>
      </section>

      <section className="workspace">
        <div className="sectionHead"><div><p className="eyebrow">01 / ASSIGNMENT</p><h2>근거 기반 역할 제안</h2></div><span className="hint">{result ? `업데이트 ${new Date(result.generatedAt).toLocaleString("ko-KR")}` : "실제 결과를 기다리는 중"}</span></div>
        <div className="assignmentLayout">
          <div className="cards">{visibleAssignments.map((item) => <button key={item.id} className={`roleCard ${selected === item.id ? "active" : ""}`} onClick={() => setSelected(item.id)}><span className={`state ${item.status}`}>{item.status}</span><strong>{item.owner || "미정"}</strong><p>{item.task}</p><small>{item.confidence ? `confidence ${item.confidence}%` : "확인 필요"}</small></button>)}</div>
          {active && <aside><p className="eyebrow">WHY THIS OWNER</p><h3>{active.owner || "담당 근거 필요"}</h3><p>{active.reason}</p><div className="evidence"><span>행동 증거</span>{active.evidence}</div>{active.blocker && <div className="blocker">Blocker · {active.blocker}</div>}</aside>}
        </div>
      </section>

      <section className="workspace"><div className="sectionHead"><div><p className="eyebrow">02 / PROGRESS</p><h2>증거 기반 진행률</h2></div><span className="hint">메시지 수는 계산에서 제외</span></div><div className="progressGrid">{progress.map((item) => <article key={item.id}><div className="row"><span>{item.state}</span><b>{item.percent === null ? "N/A" : `${item.percent}%`}</b></div><h3>{item.task}</h3><div className="track"><i style={{width: `${item.percent || 0}%`}} /></div><p>{item.next}</p></article>)}</div></section>

      {result?.questions?.length > 0 && <section className="workspace"><div className="sectionHead"><div><p className="eyebrow">03 / QUESTIONS</p><h2>확인이 필요한 내용</h2></div></div><div className="fileList">{result.questions.map((question) => <article key={question}><span className="fileState required">input</span><div><h3>{question}</h3></div></article>)}</div></section>}
      <footer><p>허용 채널만 분석</p><p>위험 행동은 사람 확인</p><p>증거 없는 100% 금지</p><a href="https://github.com/shan1343/0812-discord-goal-referee">GitHub ↗</a></footer>
    </main>
  </>;
}
