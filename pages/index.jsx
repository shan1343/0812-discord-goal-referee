import Head from "next/head";
import { useEffect, useMemo, useState } from "react";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

function ResultView({ result }) {
  const proposed = result.tasks.filter(({ status }) => status === "proposed").length;
  const needsInput = result.tasks.length - proposed;
  return <>
    <section className="metrics">
      <article><b>{result.sourceMessageCount}</b><span>분석 메시지</span></article>
      <article><b>{result.tasks.length}</b><span>추출 작업</span></article>
      <article><b>{proposed}</b><span>근거 있는 제안</span></article>
      <article><b>{needsInput}</b><span>추가 확인 필요</span></article>
    </section>
    <section className="panel">
      <p className="eyebrow">01 / LATEST DISCORD RESULT</p>
      <h2>{result.summary}</h2>
      <p className="timestamp">최근 분석 {new Date(result.generatedAt).toLocaleString("ko-KR")}</p>
      <div className="taskGrid">
        {result.tasks.map((task, index) => <article className="task" key={`${task.title}-${index}`}>
          <span className={`badge ${task.status}`}>{task.status === "proposed" ? "역할 제안" : "확인 필요"}</span>
          <h3>{task.title}</h3>
          <strong>{task.ownerName || "담당자 미정"}</strong>
          <p>{task.reason}</p>
          <small>근거 메시지: {task.evidenceMessageIds.join(", ") || "없음"}</small>
        </article>)}
      </div>
    </section>
    <section className="panel questions">
      <p className="eyebrow">02 / HUMAN CHECK</p>
      <h2>사람이 확인할 항목</h2>
      {result.questions.length
        ? <ul>{result.questions.map((question) => <li key={question}>{question}</li>)}</ul>
        : <p className="muted">현재 추가 질문이 없습니다.</p>}
    </section>
  </>;
}

export default function Home() {
  const [channel, setChannel] = useState("");
  const [result, setResult] = useState(null);
  const [state, setState] = useState(API_BASE ? "loading" : "not_configured");
  const requestUrl = useMemo(() => {
    if (!API_BASE) return null;
    const query = channel ? `?channel_id=${encodeURIComponent(channel)}` : "";
    return `${API_BASE}/api/goal-referee/results/latest${query}`;
  }, [channel]);

  useEffect(() => {
    const selected = new URLSearchParams(location.search).get("channel") || "";
    setChannel(selected);
  }, []);

  useEffect(() => {
    if (!requestUrl) return;
    let active = true;
    setState("loading");
    fetch(requestUrl, { headers: { accept: "application/json" } })
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        setResult(data);
        setState(data ? "ready" : "empty");
      })
      .catch(() => active && setState("error"));
    return () => { active = false; };
  }, [requestUrl]);

  return <>
    <Head>
      <title>Discord Goal Referee</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="description" content="Discord 근거 기반 역할 제안 대시보드" />
    </Head>
    <main>
      <nav><div className="brand"><span>GR</span> GoalReferee</div><div className={`live ${state}`}><i /> {state === "ready" ? "Discord 동기화됨" : "동기화 확인 중"}</div></nav>
      <header>
        <p className="eyebrow">EVIDENCE, NOT ACTIVITY</p>
        <h1>Discord 대화를<br /><em>실행 근거</em>로.</h1>
        <p>메시지 수가 아니라 직접 약속한 역할과 출처 메시지를 연결합니다. AI 제안은 사람이 확인하기 전까지 확정되지 않습니다.</p>
      </header>
      {state === "ready" && result && <ResultView result={result} />}
      {state !== "ready" && <section className="panel empty">
        <h2>{state === "not_configured" ? "웹 API 주소가 설정되지 않았습니다." : state === "error" ? "동기화 API에 연결할 수 없습니다." : state === "empty" ? "아직 게시된 Discord 분석이 없습니다." : "최신 Discord 분석을 불러오는 중입니다."}</h2>
        <p>Discord에서 <code>/goal-referee</code>를 실행한 뒤 응답의 ‘웹 대시보드 열기’를 선택하세요.</p>
      </section>}
      <footer>허용 채널만 분석 · 근거 없는 담당자 자동 확정 금지 · 원문과 API 키는 화면에 표시하지 않음</footer>
    </main>
  </>;
}
