import Head from "next/head";
import { useMemo, useState } from "react";

const initialAssignments = [
  { id: "a", task: "Discord Bot · API · 웹 통합", owner: "도윤", confidence: 96, reason: "Bot과 GitHub 연동, 배포를 맡겠다는 명시적 약속", evidence: "09:02 Discord 메시지 · GitHub commit", status: "proposed", blocker: null },
  { id: "b", task: "가짜 대화 · 파일 Fixture", owner: "서연", confidence: 94, reason: "개인정보 없는 fixture 5개를 만들겠다는 약속", evidence: "09:03 Discord 메시지 · 첨부 JSON", status: "proposed", blocker: null },
  { id: "c", task: "정답셋 · 보안 Red Team", owner: "민재", confidence: 91, reason: "정답셋과 보안 공격 테스트를 맡겠다는 약속", evidence: "09:04 Discord 메시지", status: "proposed", blocker: "14:00 수업" },
  { id: "d", task: "제출 카피 최종 검수", owner: null, confidence: 0, reason: "담당자를 정할 행동 증거가 부족합니다.", evidence: "추가 입력 필요", status: "needs_input", blocker: "근거 부족" }
];

const artifacts = [
  { name: "demo_v1.zip", task: "Bot · 웹 통합", version: "v1", status: "candidate", checksum: "d1c24bdcdf94" },
  { name: "discord_happy_path_v1.json", task: "Fixture", version: "v1", status: "valid", checksum: "fc1c0e0c7ae8" },
  { name: "security_report.md", task: "보안 테스트", version: "missing", status: "required", checksum: "—" }
];

export default function Home() {
  const [seeded, setSeeded] = useState(false);
  const [assigned, setAssigned] = useState(false);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [selected, setSelected] = useState("a");

  const active = assignments.find((item) => item.id === selected) || assignments[0];
  const progress = useMemo(() => assignments.map((item) => {
    if (!item.owner) return { ...item, percent: null, state: "판단 불가", next: "담당 근거를 추가하세요." };
    if (item.blocker) return { ...item, percent: 35, state: "막힘", next: "일정 제약을 해결하거나 대안을 확인하세요." };
    if (item.status === "confirmed") return { ...item, percent: 90, state: "검토 대기", next: "테스트와 완료 승인이 필요합니다." };
    return { ...item, percent: 40, state: "진행 중", next: "사람이 배정을 확인하세요." };
  }), [assignments]);

  const confirm = (id) => setAssignments((items) => items.map((item) => item.id === id ? { ...item, status: "confirmed" } : item));

  return <>
    <Head><title>Discord Goal Referee</title><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="description" content="Evidence-based project coordination for Discord teams" /></Head>
    <main>
      <nav><div className="brand"><span className="mark">GR</span><span>Goal Referee</span></div><div className="live"><i /> Fixture fallback ready</div></nav>
      <header>
        <div><p className="eyebrow">EVIDENCE, NOT ACTIVITY</p><h1>대화를 역할과<br/><em>진행의 근거</em>로.</h1></div>
        <div className="intro"><p>Discord 프로젝트 채널의 약속·마감·파일을 구조화해 역할을 제안합니다. 사람을 감시하거나 메시지량으로 평가하지 않습니다.</p><div className="actions"><button onClick={() => setSeeded(true)}>1. 데모 입력</button><button className="ghost" disabled={!seeded} onClick={() => setAssigned(true)}>2. 역할 제안</button></div></div>
      </header>

      <section className="metrics"><div><b>{seeded ? "6" : "0"}</b><span>근거 메시지</span></div><div><b>{assigned ? "3" : "0"}</b><span>역할 후보</span></div><div><b>{assigned ? "1" : "0"}</b><span>확인 필요</span></div><div><b>0</b><span>자동 확정</span></div></section>

      <section className="workspace">
        <div className="sectionHead"><div><p className="eyebrow">01 / ASSIGNMENT</p><h2>근거 기반 역할 제안</h2></div><span className="hint">카드를 선택해 근거를 확인하세요</span></div>
        {!assigned ? <div className="empty"><span>01</span><p>{seeded ? "역할 제안 만들기를 눌러 분석을 시작하세요." : "먼저 안전한 가짜 대화를 입력하세요."}</p></div> : <div className="assignmentLayout"><div className="cards">{assignments.map((item) => <button key={item.id} className={`roleCard ${selected === item.id ? "active" : ""}`} onClick={() => setSelected(item.id)}><span className={`state ${item.status}`}>{item.status}</span><strong>{item.owner || "미정"}</strong><p>{item.task}</p><small>confidence {item.confidence}%</small></button>)}</div><aside><p className="eyebrow">WHY THIS OWNER</p><h3>{active.owner || "담당 근거 필요"}</h3><p>{active.reason}</p><div className="evidence"><span>행동 증거</span>{active.evidence}</div>{active.blocker && <div className="blocker">Blocker · {active.blocker}</div>}{active.owner && <button onClick={() => confirm(active.id)} disabled={active.status === "confirmed"}>{active.status === "confirmed" ? "사람 확인 완료" : "이 배정 확인"}</button>}</aside></div>}
      </section>

      {assigned && <><section className="workspace"><div className="sectionHead"><div><p className="eyebrow">02 / PROGRESS</p><h2>증거 기반 진행률</h2></div><span className="hint">메시지 수는 계산에서 제외</span></div><div className="progressGrid">{progress.map((item) => <article key={item.id}><div className="row"><span>{item.state}</span><b>{item.percent === null ? "N/A" : `${item.percent}%`}</b></div><h3>{item.task}</h3><div className="track"><i style={{width:`${item.percent || 0}%`}} /></div><p>{item.next}</p></article>)}</div></section>
      <section className="workspace"><div className="sectionHead"><div><p className="eyebrow">03 / FILES</p><h2>모든 파일과 최신 상태</h2></div><span className="hint">version · checksum · missing</span></div><div className="fileList">{artifacts.map((file) => <article key={file.name}><span className={`fileState ${file.status}`}>{file.status}</span><div><h3>{file.name}</h3><p>{file.task}</p></div><b>{file.version}</b><code>{file.checksum}</code></article>)}</div></section></>}
      <footer><p>허용 채널만 분석</p><p>위험 행동은 사람 확인</p><p>증거 없는 100% 금지</p><a href="https://github.com/shan1343/0812-discord-goal-referee">GitHub ↗</a></footer>
    </main>
  </>;
}
