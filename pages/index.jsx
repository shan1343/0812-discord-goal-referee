import Head from "next/head";
import { useState } from "react";

const messages = [
  { id: "1001", time: "09:51", author: "예린", text: "강의실 데이터 구조와 샘플 데이터는 내가 오늘 저녁까지 정리할게" },
  { id: "1002", time: "09:59", author: "민재", text: "FastAPI로 /rooms, /available-rooms API는 내가 맡을게" },
  { id: "1003", time: "10:20", author: "현우", text: "검색 화면 프로토타입은 내가 화요일 저녁까지 1차 완료할게" },
  { id: "1004", time: "10:17", author: "예린", text: "5분 발표 자료 초안은 내가 만들게" },
  { id: "1005", time: "10:10", author: "지수", text: "사용자 테스트도 해야 하지 않을까?" },
];

const base = [
  { id: "data", task: "강의실 데이터 구조·샘플 데이터", owner: "예린", reason: "데이터 구조와 샘플 데이터를 직접 정리하겠다고 명시했습니다.", evidence: "[09:51] 예린 · 강의실 데이터 구조와 샘플 데이터는 내가 오늘 저녁까지 정리할게", deadline: "오늘 저녁", status: "proposed" },
  { id: "backend", task: "FastAPI 기반 강의실 API", owner: "민재", reason: "FastAPI API 경로를 맡겠다고 명시했습니다.", evidence: "[09:59] 민재 · FastAPI로 /rooms, /available-rooms API는 내가 맡을게", deadline: "수요일 저녁", status: "proposed" },
  { id: "frontend", task: "검색 화면 프로토타입", owner: "현우", reason: "검색 화면 프로토타입의 1차 완료를 명시했습니다.", evidence: "[10:20] 현우 · 검색 화면 프로토타입은 내가 화요일 저녁까지 1차 완료할게", deadline: "화요일 저녁", status: "proposed" },
  { id: "slides", task: "5분 발표 자료", owner: "예린", reason: "발표 자료 초안을 만들겠다고 명시했습니다.", evidence: "[10:17] 예린 · 5분 발표 자료 초안은 내가 만들게", deadline: "목요일 밤", status: "proposed" },
  { id: "test", task: "사용자 테스트 설계", owner: null, reason: "필요성은 언급되었지만, 맡겠다는 명시적 약속은 없습니다.", evidence: "추가 입력 필요", deadline: "목요일 16:00", status: "needs_input" },
];

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const [assigned, setAssigned] = useState(false);
  const [items, setItems] = useState(base);
  const [selected, setSelected] = useState("data");
  const active = items.find((item) => item.id === selected) || items[0];
  const confirm = (id) => setItems((current) => current.map((item) => item.id === id ? { ...item, status: "confirmed" } : item));
  return <>
    <Head><title>Discord Goal Referee</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
    <main>
      <nav><div className="brand"><span className="mark">GR</span><span>Goal Referee</span></div><div className="live"><i /> Discord mock event ready</div></nav>
      <header><div><p className="eyebrow">EVIDENCE, NOT ACTIVITY</p><h1>대화에서 찾는<br /><em>근거 기반 역할 제안</em></h1></div><div className="intro"><p>Discord 메시지를 정규화한 뒤, 실제로 맡겠다고 말한 근거와 마감만 사용합니다. 자동 확정이나 메시지 수 평가는 하지 않습니다.</p><div className="actions"><button onClick={() => setLoaded(true)}>1. EmptyRoom 대화 불러오기</button><button className="ghost" disabled={!loaded} onClick={() => setAssigned(true)}>2. 역할 제안 만들기</button></div></div></header>
      <section className="metrics"><div><b>{loaded ? messages.length : 0}</b><span>정규화된 Discord 메시지</span></div><div><b>{assigned ? 4 : 0}</b><span>근거 있는 역할 제안</span></div><div><b>{assigned ? 1 : 0}</b><span>추가 입력 필요</span></div><div><b>0</b><span>자동 확정</span></div></section>
      {loaded && <section className="workspace transcript"><div className="sectionHead"><div><p className="eyebrow">00 / DISCORD INPUT</p><h2>EmptyRoom 모의 Discord 대화</h2></div><span className="hint">bot·빈 메시지·짧은 반응은 제외</span></div><div className="messageList">{messages.map((message) => <article key={message.id}><b>{message.time}</b><strong>{message.author}</strong><p>{message.text}</p><code>message_id: {message.id}</code></article>)}</div></section>}
      <section className="workspace"><div className="sectionHead"><div><p className="eyebrow">01 / ASSIGNMENT</p><h2>근거 기반 역할 제안</h2></div><span className="hint">카드를 선택해 근거를 확인하세요</span></div>{!assigned ? <div className="empty"><span>01</span><p>{loaded ? "역할 제안 만들기를 눌러 명시적 약속만 역할 후보로 바꾸세요." : "먼저 EmptyRoom 모의 대화를 불러오세요."}</p></div> : <div className="assignmentLayout"><div className="cards">{items.map((item) => <button key={item.id} className={`roleCard ${selected === item.id ? "active" : ""}`} onClick={() => setSelected(item.id)}><span className={`state ${item.status}`}>{item.status}</span><strong>{item.owner || "미정"}</strong><p>{item.task}</p><small>{item.deadline}</small></button>)}</div><aside><p className="eyebrow">WHY THIS OWNER</p><h3>{active.owner || "담당 근거 필요"}</h3><p>{active.reason}</p><div className="evidence"><span>직접 근거</span>{active.evidence}</div><div className="deadline">마감 · {active.deadline}</div>{!active.owner && <div className="blocker">근거 부족</div>}{active.owner && <button onClick={() => confirm(active.id)} disabled={active.status === "confirmed"}>{active.status === "confirmed" ? "사람 확인 완료" : "이 배정 확인"}</button>}</aside></div>}</section>
      {assigned && <section className="workspace"><div className="sectionHead"><div><p className="eyebrow">02 / STATUS</p><h2>확정 전 진행 상태</h2></div><span className="hint">완료율은 제출물·확인 근거가 생긴 뒤 계산</span></div><div className="progressGrid">{items.map((item) => { const percent = !item.owner ? null : item.status === "confirmed" ? 80 : 40; return <article key={item.id}><div className="row"><span>{!item.owner ? "입력 필요" : item.status === "confirmed" ? "검토 대기" : "제안됨"}</span><b>{percent === null ? "N/A" : `${percent}%`}</b></div><h3>{item.task}</h3><div className="track"><i style={{ width: `${percent || 0}%` }} /></div><p>{item.owner ? `${item.owner}의 확인 또는 제출물 대기` : "담당자 입력 필요"}</p></article>; })}</div></section>}
      <footer><p>허용 채널만 분석</p><p>사람 확인 전까지는 제안</p><p>근거 없는 자동 배정 금지</p><a href="https://github.com/shan1343/0812-discord-goal-referee">GitHub 보기</a></footer>
    </main>
  </>;
}
