"use client";

/**
 * サーバー室：本物のプログラムで動くサーバーを、ブラウザの中で動かす（しくみは room.ts）。
 * - RoomMenu … タブの中の入口。レッスン（room-lessons.ts）の一覧と「自由に作る」
 * - RoomScreen … 全画面（?tab=room&room=…）。レッスンは、フレブル先生の案内で1ステップずつ
 *   （いまやること1つ → ボタン → 返事 → わかったこと）。自由に作るは、プログラム・構成・記録をシートに分けてある
 * どちらも、上に構成の図を出して、お願いがどこを通って、だれが返事をしたかを光らせる。
 */
import Image from "next/image";
import { useEffect, useReducer, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Glyph, type GlyphId } from "./glyphs";
import { MASCOT, Teacher } from "./intro";
import { PARTS } from "./model";
import { METHODS, ServerRoom, bracketHint, hasBody, rawRequest, rawResponse, statusMeaning, type BurstResult, type Entry, type Method, type RoomSettings, type ServerView } from "./room";
import { LESSONS, editedMark, lessonById, quoteInside, splitTerms, type Lesson, type LessonCtx, type LessonStep, type StepResult } from "./room-lessons";
import { ROOM_TEMPLATES, templateById, type Try } from "./room-templates";
import { BottomSheet } from "./sheets";
import { sfx } from "./sound";
import styles from "./infra.module.css";

const KEY = "odekake_infra_room_v1";
const DONE_KEY = "odekake_infra_room_lessons_v1";
const DEFAULT_SETTINGS: RoomSettings = { count: 2, lb: "rr", cdn: false, autoHeal: false };

/* ------------------------------------------------------------ 覚えておくもの */

/** 自由に作る：code … デプロイしたプログラム、draft … 書きかけ（デプロイ前でも、閉じても消えないように） */
type Saved = { code: string; draft: string; template: string; settings: RoomSettings };

function loadSaved(): Saved {
  const first = ROOM_TEMPLATES[0]!;
  const base: Saved = { code: first.code, draft: first.code, template: first.id, settings: DEFAULT_SETTINGS };
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Partial<Saved> | null;
    if (!raw || typeof raw !== "object") return base;
    const s = (raw.settings ?? {}) as Partial<RoomSettings>;
    const code = typeof raw.code === "string" && raw.code.length < 50000 ? raw.code : base.code;
    return {
      code,
      draft: typeof raw.draft === "string" && raw.draft.length < 50000 ? raw.draft : code,
      template: typeof raw.template === "string" && templateById(raw.template) ? raw.template : base.template,
      settings: {
        count: s.count === 1 || s.count === 2 || s.count === 3 ? s.count : DEFAULT_SETTINGS.count,
        lb: s.lb === "least" ? "least" : "rr",
        cdn: s.cdn === true,
        autoHeal: s.autoHeal === true,
      },
    };
  } catch {
    return base;
  }
}

function save(v: Saved) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // 覚えられなくても、この画面のあいだは使える
  }
}

/** 最後までやったレッスン */
function loadDone(): Set<string> {
  try {
    const raw = JSON.parse(window.localStorage.getItem(DONE_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function saveDone(id: string) {
  const done = loadDone();
  done.add(id);
  try {
    window.localStorage.setItem(DONE_KEY, JSON.stringify([...done]));
  } catch {
    // 覚えられなくてもよい（一覧の ✓ が出ないだけ）
  }
}

/* ------------------------------------------------------------ 入口（タブの中） */

export function RoomMenu({ onOpen }: { onOpen: (id: string) => void }) {
  const [done] = useState(loadDone);
  const next = LESSONS.find((l) => !done.has(l.id));
  return (
    <div className={styles.room}>
      <div className={styles.roomIntro}>
        <Teacher sub="サーバー室" />
        <p>この部屋では、本物のプログラムで動くサーバーを、画面の中で動かせます。上から順番にやってみよう！</p>
      </div>
      <ol className={styles.roomLessons}>
        {LESSONS.map((l) => {
          const ok = done.has(l.id);
          return (
            <li key={l.id}>
              <button type="button" className={styles.roomLesson} data-next={next?.id === l.id ? "1" : undefined} data-done={ok ? "1" : undefined} onClick={() => onOpen(l.id)}>
                <span className={styles.roomLessonNo} aria-hidden="true">
                  {ok ? "✓" : l.no}
                </span>
                <span className={styles.roomLessonText}>
                  <small>
                    レッスン {l.no}
                    {ok ? "・できた" : next?.id === l.id ? "・つぎはこれ" : ""}
                  </small>
                  <b>{l.title}</b>
                  <em>{l.sub}</em>
                </span>
                <span className={styles.roomLessonGo} aria-hidden="true">
                  ▶
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <button type="button" className={styles.roomFree} onClick={() => onOpen("free")}>
        <span className={styles.paletteIcon} style={{ "--c": PARTS.app.color } as CSSProperties} aria-hidden="true">
          <Glyph id="app" size={20} />
        </span>
        <span className={styles.roomLessonText}>
          <small>レッスンのあとに</small>
          <b>自由に作る</b>
          <em>プログラムを書きかえて、なんでも試せる</em>
        </span>
        <span className={styles.roomLessonGo} aria-hidden="true">
          ▶
        </span>
      </button>
    </div>
  );
}

/** ?room= の値として正しいか（レッスンの id か "free"） */
export const isRoomScreen = (id: string | null): id is string => id === "free" || Boolean(id && lessonById(id));

/** 全画面のサーバー室（レッスンか、自由に作る） */
export function RoomScreen({ id, onExit, onOpen }: { id: string; onExit: () => void; onOpen: (id: string) => void }) {
  const lesson = lessonById(id);
  if (!lesson) return <RoomFree onExit={onExit} />;
  const next = LESSONS[LESSONS.indexOf(lesson) + 1];
  return <RoomLesson key={lesson.id} lesson={lesson} onExit={onExit} onNext={next ? () => onOpen(next.id) : null} />;
}

/* ------------------------------------------------------------ 共通 */

/** サーバー室を1つ動かす（画面を閉じたら、サーバーも止める） */
function useRoom(make: () => ServerRoom): ServerRoom | null {
  const [room, setRoom] = useState<ServerRoom | null>(null);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const makeRef = useRef(make);
  useEffect(() => {
    const r = makeRef.current();
    setRoom(r);
    const off = r.subscribe(bump);
    return () => {
      off();
      r.dispose();
    };
  }, []);
  return room;
}

/** 画面を閉じたあとに、返事を待っていた処理が画面をさわらないように */
function useAlive() {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return alive;
}

function Screen({ sub, title, onExit, scrollRef, children }: { sub: string; title: string; onExit: () => void; scrollRef?: RefObject<HTMLDivElement | null>; children: ReactNode }) {
  return (
    <div className={styles.home} ref={scrollRef}>
      <header className={styles.homeHeader}>
        <button type="button" className={styles.roundBtn} onClick={onExit} aria-label="サーバー室の一覧へ">
          ‹
        </button>
        <div className={styles.rmHeadText}>
          <small>{sub}</small>
          <h1>{title}</h1>
        </div>
      </header>
      {children}
    </div>
  );
}

type Tone = "ok" | "warn" | "ng";
type Mark = { text: string; tone: Tone };
/**
 * 返事が来たときに、図の上に出すしるし（id が変わるたびに出しなおす）。
 * reach … 返事をしたところ（CDN が返したら、帰りの線は CDN からだけ光らせる）
 */
type Flash = { id: number; marks: Record<string, Mark>; reach: "cdn" | "lb" | "server" };

const toneOf = (status: number): Tone => (status < 400 ? "ok" : status < 500 ? "warn" : "ng");
/** 「サーバー1（失敗）」→「サーバー1」 */
const nameOf = (by: string) => by.replace("（失敗）", "");

function flashOf(r: StepResult): Flash | null {
  if (r.entry) {
    const e = r.entry;
    const reach = e.by === "CDN" ? "cdn" : e.by === "ロードバランサー" ? "lb" : "server";
    return { id: e.id, reach, marks: { [nameOf(e.by)]: { text: e.by === "CDN" ? "HIT" : String(e.res.status), tone: toneOf(e.res.status) } } };
  }
  if (r.burst) {
    const counts: Record<string, number> = {};
    for (const [k, n] of Object.entries(r.burst.by)) counts[nameOf(k)] = (counts[nameOf(k)] ?? 0) + n;
    return { id: -Date.now(), reach: "server", marks: Object.fromEntries(Object.entries(counts).map(([k, n]) => [k, { text: `${n}件`, tone: "ok" as const }])) };
  }
  return null;
}

function serverState(s: ServerView): { text: string; tone: "ok" | "wait" | "ng" | "off" } {
  if (s.status === "starting") return { text: "起動中…", tone: "wait" };
  if (s.status === "frozen") return { text: "固まった", tone: "ng" };
  if (s.status === "stopped") return { text: "止めた", tone: "off" };
  if (s.status === "error") return { text: "エラー", tone: "ng" };
  return s.healthy ? { text: s.inflight ? "仕事中" : "元気", tone: "ok" } : { text: "確認中…", tone: "wait" };
}

/** 構成の図：あなた →（CDN）→ ロードバランサー → サーバー（→ データベース・キャッシュ） */
function RoomMap({ room, uses, sending, flash, onServer }: { room: ServerRoom; uses: { db?: boolean; cache?: boolean }; sending: boolean; flash: Flash | null; onServer?: (i: number) => void }) {
  // 返事が来たら、少しのあいだ、線を「帰り」の向きに光らせる
  const [back, setBack] = useState(false);
  useEffect(() => {
    if (!flash) return;
    setBack(true);
    const t = window.setTimeout(() => setBack(false), 1300);
    return () => window.clearTimeout(t);
  }, [flash]);
  const s = room.settings;
  const data = Boolean(uses.db || uses.cache);
  const mark = (name: string) => flash?.marks[name];
  // 帰りに光らせる線：CDN が返したら最初の1本、ロードバランサーが返したら、ロードバランサーまで
  const reach = flash?.reach ?? "server";
  const lit = (k: number) => reach === "server" || (reach === "cdn" ? k === 0 : k < (s.cdn ? 2 : 1));
  const items: ReactNode[] = [<MapNode key="user" icon="user" color="#9fb4ff" label="あなた" />];
  const link = () => items.push(<MapLink key={`link${items.length}`} on={sending || lit(Math.floor(items.length / 2))} />);
  link();
  if (s.cdn) {
    items.push(<MapNode key="cdn" icon="cdn" color={PARTS.cdn.color} label="CDN" mark={mark("CDN")} flashId={flash?.id} />);
    link();
  }
  items.push(
    <MapNode
      key="lb"
      icon="lb"
      color={PARTS.lb.color}
      label={
        <>
          ロード
          <br />
          バランサー
        </>
      }
      mark={mark("ロードバランサー")}
      flashId={flash?.id}
    />,
  );
  link();
  return (
    <section className={styles.rmap} data-flow={sending ? "go" : back ? "back" : undefined} aria-label="いまの構成">
      {s.autoHeal ? (
        <div className={styles.rmapTop}>
          <span className={styles.rmapWatch}>
            <Glyph id="monitor" size={12} />
            監視がサーバーを見張っています
          </span>
        </div>
      ) : null}
      <div className={styles.rmapGrid} style={{ gridTemplateColumns: `${"auto minmax(14px, 1fr) ".repeat(s.cdn ? 3 : 2)}116px` }}>
        {items}
        <div className={styles.rmapServers} data-stem={data ? "1" : undefined}>
          {room.servers.map((sv, k) => (
            <ServerChip key={sv.name} s={sv} mark={mark(sv.name)} flashId={flash?.id} onClick={onServer ? () => onServer(k) : undefined} />
          ))}
        </div>
        {data ? (
          <div className={styles.rmapData} data-two={uses.db && uses.cache ? "1" : undefined}>
            {uses.db ? <MapNode icon="db" color={PARTS.db.color} label="データベース" pulse={room.touches.db} /> : null}
            {uses.cache ? <MapNode icon="cache" color={PARTS.cache.color} label="キャッシュ" pulse={room.touches.cache} /> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function MapNode({ icon, color, label, mark, flashId, pulse }: { icon: GlyphId; color: string; label: ReactNode; mark?: Mark; flashId?: number; pulse?: number }) {
  return (
    <span className={styles.rmapNode} style={{ "--c": color } as CSSProperties}>
      <span className={styles.rmapIcon}>
        <Glyph id={icon} size={20} />
        {pulse ? <i key={pulse} className={styles.rmapPulse} aria-hidden="true" /> : null}
        {mark ? <Bubble key={flashId} mark={mark} /> : null}
      </span>
      <span className={styles.rmapLabel}>{label}</span>
    </span>
  );
}

const MapLink = ({ on }: { on: boolean }) => (
  <span className={styles.rmapLink} data-on={on ? "1" : undefined} aria-hidden="true">
    <i />
  </span>
);

const Bubble = ({ mark }: { mark: Mark }) => (
  <b className={styles.rmapBubble} data-tone={mark.tone}>
    {mark.text}
  </b>
);

function ServerChip({ s, mark, flashId, onClick }: { s: ServerView; mark?: Mark; flashId?: number; onClick?: () => void }) {
  const st = serverState(s);
  const props = {
    className: styles.rmapServer,
    "data-tone": st.tone,
    "data-busy": s.inflight ? "1" : undefined,
    style: { "--c": PARTS.app.color } as CSSProperties,
  };
  const inner = (
    <>
      <Glyph id="app" size={16} />
      <span>
        <b>{s.name}</b>
        <small>{st.text}</small>
      </span>
      {mark ? <Bubble key={flashId} mark={mark} /> : null}
    </>
  );
  return onClick ? (
    <button type="button" {...props} onClick={onClick} aria-label={`${s.name}（${st.text}）`}>
      {inner}
    </button>
  ) : (
    <span {...props}>{inner}</span>
  );
}

/** 文の中の **ことば** を目立たせる */
const Rich = ({ text }: { text: string }) => (
  <>
    {splitTerms(text).map((t, k) =>
      k % 2 ? (
        <b key={k} className={styles.term}>
          {t}
        </b>
      ) : (
        t
      ),
    )}
  </>
);

/** JSON なら読みやすく */
function pretty(body: string): { text: string; json: boolean } {
  try {
    const v = JSON.parse(body) as unknown;
    if (v && typeof v === "object") return { text: JSON.stringify(v, null, 2), json: true };
  } catch {
    // JSON でなければ、そのまま
  }
  return { text: body, json: false };
}

/** 1回の返事：ステータス・だれが返事をしたか・本文（本物の HTTP は開いたときだけ） */
function EntryView({ e }: { e: Entry }) {
  const [raw, setRaw] = useState(false);
  const cache = e.res.headers.find(([k]) => k === "x-cache")?.[1];
  const who =
    e.by === "CDN"
      ? "CDN が覚えていた返事"
      : e.by === "ロードバランサー"
        ? "ロードバランサーが返事"
        : `${nameOf(e.by)} ${e.by.includes("失敗") ? "から返事がない" : "が返事"}${cache ? `（CDN ${cache}）` : ""}`;
  const body = pretty(e.res.body);
  return (
    <div className={styles.rcEntry}>
      <div className={styles.rcHead}>
        <span className={styles.roomStatus} data-tone={toneOf(e.res.status)}>
          {e.res.status}
        </span>
        <b>{statusMeaning(e.res.status)}</b>
        <small>
          {who}・{e.ms}ms
        </small>
      </div>
      <pre className={styles.rcBody} data-json={body.json ? "1" : undefined}>
        {body.text || "（本文なし）"}
      </pre>
      <button type="button" className={styles.rcRawBtn} onClick={() => setRaw(!raw)} aria-expanded={raw}>
        本物の HTTP を見る {raw ? "▴" : "▾"}
      </button>
      {raw ? (
        <div className={styles.roomRaw}>
          <small>送ったリクエスト</small>
          <pre className={styles.codeBlock}>{rawRequest(e.req)}</pre>
          <small>返ってきたレスポンス</small>
          <pre className={styles.codeBlock}>{rawResponse(e.res)}</pre>
        </div>
      ) : null}
    </div>
  );
}

/** まとめて送ったとき：どのサーバーが何件返事をしたか、ステータスごとの数 */
function BurstView({ b }: { b: BurstResult }) {
  const by: Record<string, number> = {};
  for (const [k, n] of Object.entries(b.by)) by[nameOf(k)] = (by[nameOf(k)] ?? 0) + n;
  const max = Math.max(1, ...Object.values(by));
  return (
    <div className={styles.rcEntry}>
      <div className={styles.rcHead}>
        <b>
          {b.total}回のうち 成功 {b.ok}・失敗 {b.fail}
        </b>
        <small>平均 {b.avgMs}ms</small>
      </div>
      <div className={styles.rcBars}>
        {Object.entries(by)
          .sort(([x], [y]) => x.localeCompare(y, "ja", { numeric: true }))
          .map(([k, n]) => (
          <div key={k}>
            <span>{k}</span>
            <span className={styles.rcTrack}>
              <i style={{ width: `${(n / max) * 100}%` }} />
            </span>
            <b>{n}件</b>
          </div>
        ))}
      </div>
      <div className={styles.rcCodes}>
        {Object.entries(b.codes).map(([code, n]) => (
          <span key={code}>
            <span className={styles.roomStatus} data-tone={toneOf(Number(code))}>
              {code}
            </span>
            {statusMeaning(Number(code))} ×{n}
          </span>
        ))}
      </div>
    </div>
  );
}

function DbView({ room }: { room: ServerRoom }) {
  const rows = [...room.db].slice(0, 60);
  if (!rows.length) return <p className={styles.roomNote}>からっぽです</p>;
  return (
    <ul className={styles.rcDb}>
      {rows.map(([k, v]) => (
        <li key={k}>
          <b>{k}</b>
          <span>{JSON.stringify(v)}</span>
        </li>
      ))}
    </ul>
  );
}

const KEYWORDS = new Set(["async", "function", "const", "let", "var", "return", "if", "else", "await", "new", "throw", "while", "for", "of", "true", "false", "null", "typeof"]);

/** 1行を、色分けした部品にする（コメント・文字列・よく使うことば） */
function colorize(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let plain = "";
  const flush = () => {
    for (const w of plain.split(/(\b[A-Za-z_]\w*\b)/)) {
      if (!w) continue;
      out.push(
        KEYWORDS.has(w) ? (
          <span key={out.length} className={styles.tkKw}>
            {w}
          </span>
        ) : (
          w
        ),
      );
    }
    plain = "";
  };
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === "/" && line[i + 1] === "/") {
      flush();
      out.push(
        <span key={out.length} className={styles.tkCom}>
          {line.slice(i)}
        </span>,
      );
      return out;
    }
    if (c === '"' || c === "'" || c === "`") {
      flush();
      let j = i + 1;
      while (j < line.length && line[j] !== c) j += line[j] === "\\" ? 2 : 1;
      out.push(
        <span key={out.length} className={styles.tkStr}>
          {line.slice(i, j + 1)}
        </span>,
      );
      i = j;
      continue;
    }
    plain += c;
  }
  flush();
  return out;
}

/**
 * プログラムを、行番号つき・色分けで見せる。marks をふくむ行を光らせる。
 * around … 光らせる行のまわりだけ（前後1行）を見せる
 */
function CodeView({ code, marks, around }: { code: string; marks: string[]; around?: boolean }) {
  const lines = code.split("\n");
  const hit = lines.map((l) => marks.some((m) => m && l.includes(m)));
  let from = 0;
  let to = lines.length;
  if (around) {
    const first = hit.indexOf(true);
    if (first < 0) return null;
    const last = hit.lastIndexOf(true);
    from = Math.max(0, first - 1);
    to = Math.min(lines.length, last + 2, first + 8);
    while (from < first && !lines[from]!.trim()) from++;
    while (to > first + 1 && !lines[to - 1]!.trim()) to--;
  }
  return (
    <pre className={styles.rcCode}>
      {lines.slice(from, to).map((l, k) => (
        <span key={from + k} className={styles.rcLine} data-hit={hit[from + k] ? "1" : undefined}>
          <i>{from + k + 1}</i>
          <span>{colorize(l)}</span>
        </span>
      ))}
    </pre>
  );
}

const clock = (at: number) => new Date(at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** やりとりの記録（本物の HTTP）と、サーバーのログ */
function Records({ room }: { room: ServerRoom }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div>
      <h2 className={styles.sheetTitle}>やりとりの記録</h2>
      {room.entries.length ? (
        <ul className={styles.roomLog}>
          {room.entries.slice(0, 30).map((e) => (
            <LogItem key={e.id} e={e} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} />
          ))}
        </ul>
      ) : (
        <p className={styles.roomNote}>まだありません</p>
      )}
      <h3 className={styles.roomTitle} style={{ margin: "16px 0 6px" }}>
        サーバーのログ <small>console.log もここに出ます</small>
      </h3>
      <ul className={styles.roomConsole}>
        {room.logs.slice(0, 40).map((l) => (
          <li key={l.id}>
            <time>{clock(l.at)}</time> <b>{l.server}</b> {l.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LogItem({ e, open, onToggle }: { e: Entry; open: boolean; onToggle: () => void }) {
  const cache = e.res.headers.find(([k]) => k === "x-cache")?.[1];
  return (
    <li className={styles.roomEntry}>
      <button type="button" onClick={onToggle} aria-expanded={open}>
        <span className={styles.roomStatus} data-tone={toneOf(e.res.status)}>
          {e.res.status}
        </span>
        <span className={styles.roomEntryMain}>
          <b>
            {e.req.method} {e.req.path}
          </b>
          <small>
            {clock(e.at)}・{statusMeaning(e.res.status)}・{e.by}
            {cache ? `・CDN ${cache}` : ""}・{e.ms}ms
          </small>
        </span>
      </button>
      {open ? (
        <div className={styles.roomRaw}>
          <small>送ったリクエスト</small>
          <pre className={styles.codeBlock}>{rawRequest(e.req)}</pre>
          <small>返ってきたレスポンス</small>
          <pre className={styles.codeBlock}>{rawResponse(e.res)}</pre>
        </div>
      ) : null}
    </li>
  );
}

/* ------------------------------------------------------------ レッスン */

type Phase = "idle" | "running" | "done" | "retry";

const defaultText = (s: LessonStep) => (s.action.kind === "edit" ? s.action.find : s.action.kind === "send" ? (s.action.editBody ?? "") : "");

/** サーバーがみんな起動して、ヘルスチェックに合格したか（まだなら、待つ理由） */
function booting(room: ServerRoom): string | null {
  if (room.servers.some((s) => s.status === "error")) return "プログラムにまちがいがあって、サーバーが動けません";
  return room.ready() ? null : "サーバーを起動しています…";
}

function RoomLesson({ lesson, onExit, onNext }: { lesson: Lesson; onExit: () => void; onNext: (() => void) | null }) {
  const tpl = templateById(lesson.template) ?? ROOM_TEMPLATES[0]!;
  const room = useRoom(() => new ServerRoom(tpl.code, lesson.settings, { persist: false }));
  const alive = useAlive();
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<StepResult | null>(null);
  const [finished, setFinished] = useState(false);
  const [text, setText] = useState(() => defaultText(lesson.steps[0]!));
  const [flash, setFlash] = useState<Flash | null>(null);
  const [sheet, setSheet] = useState<"code" | "log" | null>(null);
  const ctx = useRef<LessonCtx>({});
  /** やったあと、step.until を待っている結果 */
  const pending = useRef<StepResult | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const step = lesson.steps[i]!;
  const a = step.action;

  // 時間で変わるもの（キャッシュが消えるまでの秒数・監視の再起動）を見るために、ときどき描きなおす
  const [, tick] = useReducer((n: number) => n + 1, 0);
  const timed = Boolean(step.wait || step.until);
  useEffect(() => {
    if (!timed || finished) return;
    const t = window.setInterval(tick, 500);
    return () => window.clearInterval(t);
  }, [timed, finished]);

  const finish = (r: StepResult, ok: boolean) => {
    setResult(r);
    setPhase(ok ? "done" : "retry");
    sfx(ok ? "good" : "wrong");
    window.requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };

  // やったあと待つステップ：そうなったら、結果を出す
  useEffect(() => {
    const r = pending.current;
    if (!room || !r || phase !== "running" || !step.until?.(room, ctx.current)) return;
    pending.current = null;
    finish(r, step.ok ? step.ok(r, ctx.current) : true);
  });

  const blocker = !room ? "サーバーを起動しています…" : (step.wait?.(room, ctx.current) ?? (a.kind === "send" ? booting(room) : null));

  const run = async () => {
    if (!room || phase === "running" || phase === "done" || blocker) return;
    setPhase("running");
    setFlash(null);
    const r: StepResult = {};
    if (a.kind === "send") {
      const body = a.editBody != null ? text : (a.body ?? null);
      if ((a.times ?? 1) > 1) r.burst = await room.burst(a.method, a.path, body, a.times ?? 1);
      else r.entry = await room.send(a.method, a.path, body);
      if (!alive.current) return;
      setFlash(flashOf(r));
    } else if (a.kind === "set") room.setSettings(a.patch);
    else if (a.kind === "edit") {
      const word = text.trim();
      ctx.current.edited = word;
      room.deploy(room.code.replace(a.find, () => quoteInside(word)));
    }
    step.remember?.(r, ctx.current, room);
    if (step.until) pending.current = r;
    else finish(r, step.ok ? step.ok(r, ctx.current) : true);
  };

  const toTop = () => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  const next = () => {
    if (i + 1 >= lesson.steps.length) {
      saveDone(lesson.id);
      setFinished(true);
      sfx("clear");
      toTop();
      return;
    }
    setI(i + 1);
    setPhase("idle");
    setResult(null);
    setText(defaultText(lesson.steps[i + 1]!));
    toTop();
  };

  const marks = typeof step.code === "function" ? step.code(ctx.current) : (step.code ?? []);
  const learn = phase !== "done" ? "" : typeof step.learn === "function" ? step.learn(result ?? {}, ctx.current) : step.learn;
  const label = phase === "running" ? (step.waiting ?? (a.kind === "send" ? "送っています…" : "…")) : (blocker ?? a.label);
  const disabled = !room || phase === "running" || Boolean(blocker) || (a.kind === "edit" && !text.trim());

  return (
    <Screen sub={`レッスン ${lesson.no}`} title={lesson.title} onExit={onExit} scrollRef={scrollRef}>
      {room ? <RoomMap room={room} uses={lesson.uses} sending={phase === "running" && a.kind === "send"} flash={flash} /> : null}

      {finished ? (
        <LessonClear lesson={lesson} onExit={onExit} onNext={onNext} />
      ) : (
        <section className={styles.rlStep} key={i} aria-label={`ステップ ${i + 1}`}>
          <div className={styles.rlCount}>
            <span>
              ステップ {i + 1} / {lesson.steps.length}
            </span>
            <span className={styles.rlDots} aria-hidden="true">
              {lesson.steps.map((_, k) => (
                <i key={k} data-on={k < i ? "1" : undefined} data-cur={k === i ? "1" : undefined} />
              ))}
            </span>
          </div>
          <div className={styles.rlSay}>
            <span className={styles.teacherFace} aria-hidden="true">
              <Image src={MASCOT} alt="" width={128} height={128} />
            </span>
            <p>
              <Rich text={step.say} />
            </p>
          </div>

          {a.kind === "edit" && phase !== "done" && room ? (
            <>
              <label className={styles.rlField}>
                <span>{a.field}</span>
                <input value={text} onChange={(e) => setText(e.target.value)} maxLength={30} spellCheck={false} enterKeyHint="done" disabled={phase === "running"} />
              </label>
              <div className={styles.rlCodeBox}>
                <small>プログラムのこの行が、こう変わります</small>
                <CodeView code={room.code.replace(a.find, () => quoteInside(text.trim() || "…"))} marks={[editedMark(text.trim() || "…")]} around />
              </div>
            </>
          ) : null}
          {a.kind === "send" && a.editBody != null && phase !== "done" ? (
            <label className={styles.rlField}>
              <span>送る文</span>
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={60} spellCheck={false} enterKeyHint="send" disabled={phase === "running"} />
            </label>
          ) : null}

          {phase !== "done" ? (
            <button type="button" className={`${styles.btnPrimary} ${styles.rlAction}`} onClick={() => void run()} disabled={disabled}>
              <span>{label}</span>
              {a.kind === "send" ? (
                <small>
                  {a.method} {a.path}
                  {(a.times ?? 1) > 1 ? ` ×${a.times}回` : ""}
                </small>
              ) : null}
            </button>
          ) : null}

          {phase === "done" || phase === "retry" ? (
            <div className={styles.rlResult} ref={endRef} aria-live="polite">
              {result?.entry ? <EntryView e={result.entry} /> : null}
              {result?.burst ? <BurstView b={result.burst} /> : null}
              {a.kind === "db" && room ? <DbView room={room} /> : null}
              {phase === "done" ? (
                <p className={styles.rlLearn}>
                  <Rich text={learn} />
                </p>
              ) : (
                <p className={styles.rlRetry}>{step.retry ?? "もう一度ためしてみよう"}</p>
              )}
              {phase === "done" && marks.length && room ? (
                <div className={styles.rlCodeBox}>
                  <small>このとき動いたプログラム</small>
                  <CodeView code={room.code} marks={marks} around />
                </div>
              ) : null}
              {phase === "done" ? (
                <button type="button" className={`${styles.btnPrimary} ${styles.rlNext}`} onClick={next}>
                  {i + 1 >= lesson.steps.length ? "レッスンを終える" : "つぎへ"}
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      )}

      <div className={styles.rlLinks}>
        <button type="button" onClick={() => setSheet("code")}>
          プログラム全体
        </button>
        <button type="button" onClick={() => setSheet("log")}>
          やりとりの記録
        </button>
      </div>

      <BottomSheet open={sheet === "code"} onClose={() => setSheet(null)} label="サーバーのプログラム">
        {room ? (
          <div>
            <h2 className={styles.sheetTitle}>サーバーのプログラム</h2>
            <p className={styles.exportLead}>
              このプログラムが、{room.servers.map((s) => s.name).join("・")} の中で動いています（バージョン {room.version}）。
              {marks.length ? "光っている行が、いまのステップで使うところです" : ""}
            </p>
            <CodeView code={room.code} marks={marks} />
          </div>
        ) : null}
      </BottomSheet>
      <BottomSheet open={sheet === "log"} onClose={() => setSheet(null)} label="やりとりの記録">
        {room ? <Records room={room} /> : null}
      </BottomSheet>
    </Screen>
  );
}

function LessonClear({ lesson, onExit, onNext }: { lesson: Lesson; onExit: () => void; onNext: (() => void) | null }) {
  return (
    <section className={styles.rlStep} aria-label="レッスンクリア">
      <div className={styles.rlClear}>
        <span aria-hidden="true">🎉</span>
        <b>レッスン{lesson.no} クリア！</b>
        <small>{lesson.title}</small>
      </div>
      <p className={styles.rlSumHead}>わかったこと</p>
      <ul className={styles.rlSummary}>
        {lesson.summary.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <div className={styles.rlClearBtns}>
        {onNext ? (
          <button type="button" className={styles.btnPrimary} onClick={onNext}>
            つぎのレッスンへ
          </button>
        ) : null}
        <button type="button" className={onNext ? styles.btnGhost : styles.btnPrimary} onClick={onExit}>
          レッスンの一覧へ
        </button>
      </div>
      {onNext ? null : <p className={styles.rlSumNote}>全部のレッスンができました！ 一覧の「自由に作る」で、自分のプログラムを書いてみよう</p>}
    </section>
  );
}

/* ------------------------------------------------------------ 自由に作る */

type FreeSheet = "code" | "config" | "log" | "db" | { server: number };

function RoomFree({ onExit }: { onExit: () => void }) {
  const [saved] = useState(loadSaved);
  const savedRef = useRef(saved);
  const room = useRoom(() => new ServerRoom(saved.code, saved.settings));
  const alive = useAlive();
  const [draft, setDraft] = useState(saved.draft);
  const [template, setTemplate] = useState(saved.template);
  const [method, setMethod] = useState<Method>("GET");
  const [path, setPath] = useState("/");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<StepResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [sheet, setSheet] = useState<FreeSheet | null>(null);

  const persist = (patch: Partial<Saved>) => {
    savedRef.current = { ...savedRef.current, ...patch };
    save(savedRef.current);
  };

  // 書きかけのプログラムも、少し待ってから覚えておく（デプロイしないで閉じても消えないように）
  useEffect(() => {
    const t = window.setTimeout(() => {
      savedRef.current = { ...savedRef.current, draft };
      save(savedRef.current);
    }, 600);
    return () => window.clearTimeout(t);
  }, [draft]);

  const tpl = templateById(template) ?? ROOM_TEMPLATES[0]!;
  const changed = room ? draft !== room.code : false;
  const errors = room ? [...new Set(room.servers.filter((s) => s.status === "error" && s.error).map((s) => s.error!))] : [];
  const hint = errors.length && room ? bracketHint(room.code) : null;

  const deploy = () => {
    if (!room) return;
    room.deploy(draft);
    persist({ code: draft, draft, template });
    setResult(null);
    setSheet(null);
    sfx("start");
  };

  const applyTry = (t: Try) => {
    setMethod(t.method);
    setPath(t.path);
    setBody(t.body ?? "");
  };

  const choose = (id: string) => {
    const t = templateById(id);
    if (!t || !room) return;
    const edited = draft !== tpl.code && draft !== room.code;
    if (edited && !window.confirm("書きかえたプログラムは消えます。お手本に入れかえますか？")) return;
    setTemplate(id);
    setDraft(t.code);
    const first = t.tries[0];
    if (first) applyTry(first);
  };

  const send = async (n: number) => {
    if (!room || busy) return;
    setBusy(true);
    setFlash(null);
    try {
      const b = hasBody(method) ? body : null;
      const r: StepResult = n === 1 ? { entry: await room.send(method, path, b) } : { burst: await room.burst(method, path, b, n) };
      if (!alive.current) return;
      setResult(r);
      setFlash(flashOf(r));
      const bad = r.entry ? r.entry.res.status >= 400 : (r.burst?.fail ?? 0) > 0;
      sfx(bad ? "wrong" : "good");
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const setSettings = (patch: Partial<RoomSettings>) => {
    if (!room) return;
    room.setSettings(patch);
    persist({ settings: room.settings });
  };

  const settings = room?.settings ?? saved.settings;
  const server = sheet && typeof sheet === "object" ? sheet.server : null;

  return (
    <Screen sub="サーバー室" title="自由に作る" onExit={onExit}>
      <p className={styles.rfLead}>プログラムを書きかえて、なんでも試せます。サーバーをタップすると、止めたり再起動したりできます</p>
      {room ? <RoomMap room={room} uses={{ db: true, cache: true }} sending={busy} flash={flash} onServer={(k) => setSheet({ server: k })} /> : null}

      {errors.length ? (
        <div className={styles.rfError}>
          {errors.map((e) => (
            <p key={e} className={styles.roomError}>
              {e}
            </p>
          ))}
          {hint ? <p className={styles.roomError}>ヒント：{hint}</p> : null}
          <button type="button" className={styles.btnGhost} onClick={() => setSheet("code")}>
            プログラムを直す
          </button>
        </div>
      ) : null}

      <div className={styles.rfTools}>
        <button type="button" className={styles.btnGhost} data-on={changed ? "1" : undefined} onClick={() => setSheet("code")}>
          {changed ? "プログラム（書きかけ）" : "プログラムを書く"}
        </button>
        <button type="button" className={styles.btnGhost} onClick={() => setSheet("config")}>
          構成を変える
        </button>
      </div>

      <section className={styles.roomPanel}>
        <h3 className={styles.roomTitle}>お願いを送る</h3>
        <div className={styles.exportTabs}>
          {tpl.tries.map((t, k) => (
            <button key={k} type="button" onClick={() => applyTry(t)} data-on={method === t.method && path === t.path ? "1" : undefined}>
              {t.method} {t.path}
            </button>
          ))}
        </div>
        <div className={styles.roomReqRow}>
          <select value={method} onChange={(e) => setMethod(e.target.value as Method)} aria-label="メソッド">
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input value={path} onChange={(e) => setPath(e.target.value)} aria-label="パス" spellCheck={false} autoCapitalize="off" autoCorrect="off" />
        </div>
        {hasBody(method) ? <textarea className={styles.roomBody} value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="送る本文" aria-label="本文" /> : null}
        <div className={styles.rfSend}>
          <button type="button" className={styles.btnPrimary} onClick={() => void send(1)} disabled={!room || busy}>
            {busy ? "送っています…" : "送る"}
          </button>
          <button type="button" className={styles.btnGhost} onClick={() => void send(20)} disabled={!room || busy}>
            20回まとめて
          </button>
        </div>
      </section>

      {result ? (
        <section className={styles.roomPanel} aria-live="polite">
          <h3 className={styles.roomTitle}>返事</h3>
          {result.entry ? <EntryView e={result.entry} /> : null}
          {result.burst ? <BurstView b={result.burst} /> : null}
        </section>
      ) : null}

      <div className={styles.rlLinks}>
        <button type="button" onClick={() => setSheet("log")}>
          やりとりの記録
        </button>
        <button type="button" onClick={() => setSheet("db")}>
          データベースの中
        </button>
      </div>

      <BottomSheet open={sheet === "code"} onClose={() => setSheet(null)} label="プログラム">
        <div>
          <div className={styles.rfCodeHead}>
            <h2 className={styles.sheetTitle}>プログラム</h2>
            <button type="button" className={styles.btnPrimary} onClick={deploy} disabled={!room}>
              デプロイ
            </button>
          </div>
          <p className={styles.exportLead}>
            {changed ? "書きかえたら「デプロイ」で、サーバーに入れます。" : `いまはバージョン ${room?.version ?? 0} が動いています。`}
            お手本を選んで、書きかえてみよう
          </p>
          <div className={styles.exportTabs} role="radiogroup" aria-label="お手本">
            {ROOM_TEMPLATES.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={template === t.id} data-on={template === t.id ? "1" : undefined} onClick={() => choose(t.id)}>
                {t.name}
              </button>
            ))}
          </div>
          <p className={styles.roomNote}>{tpl.note}</p>
          <textarea
            className={styles.roomCode}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            rows={16}
            aria-label="サーバーのプログラム"
          />
          {errors.map((e) => (
            <p key={e} className={styles.roomError}>
              {e}
            </p>
          ))}
          {hint ? <p className={styles.roomError}>ヒント：{hint}</p> : null}
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "config"} onClose={() => setSheet(null)} label="構成を変える">
        <div className={styles.rfConfig}>
          <h2 className={styles.sheetTitle}>構成を変える</h2>
          <Choice label="サーバーの数" value={settings.count} options={[1, 2, 3].map((n) => ({ v: n, label: `${n}台` }))} onChange={(v) => setSettings({ count: v })} />
          <Choice
            label="ロードバランサーの振り分け方"
            value={settings.lb}
            options={[
              { v: "rr" as const, label: "順番に" },
              { v: "least" as const, label: "すいている方へ" },
            ]}
            onChange={(v) => setSettings({ lb: v })}
          />
          <Choice
            label="CDN（使い回してよい返事を覚える）"
            value={settings.cdn}
            options={[
              { v: false, label: "なし" },
              { v: true, label: "あり" },
            ]}
            onChange={(v) => setSettings({ cdn: v })}
          />
          <Choice
            label="監視（固まったサーバーを自動で再起動）"
            value={settings.autoHeal}
            options={[
              { v: false, label: "なし" },
              { v: true, label: "あり" },
            ]}
            onChange={(v) => setSettings({ autoHeal: v })}
          />
        </div>
      </BottomSheet>

      <BottomSheet open={server != null} onClose={() => setSheet(null)} label="サーバー">
        {room && server != null ? <ServerSheet room={room} index={server} /> : null}
      </BottomSheet>

      <BottomSheet open={sheet === "log"} onClose={() => setSheet(null)} label="やりとりの記録">
        {room ? <Records room={room} /> : null}
      </BottomSheet>

      <BottomSheet open={sheet === "db"} onClose={() => setSheet(null)} label="データベースの中">
        {room ? (
          <div>
            <h2 className={styles.sheetTitle}>データベースの中</h2>
            <p className={styles.exportLead}>サーバーのプログラムが env.db で読み書きするデータです。この端末に保存されます</p>
            <DbView room={room} />
            <div className={styles.sheetActions}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => {
                  if (window.confirm("データベースの中身を、全部消します。よいですか？")) room.clearDb();
                }}
                disabled={!room.db.size}
              >
                データベースを空にする
              </button>
            </div>
          </div>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

function ServerSheet({ room, index }: { room: ServerRoom; index: number }) {
  const s = room.servers[index];
  if (!s) return <p className={styles.roomNote}>このサーバーは、もうありません</p>;
  const st = serverState(s);
  return (
    <div>
      <div className={styles.partHead} style={{ "--c": PARTS.app.color } as CSSProperties}>
        <span className={styles.partIcon}>
          <Glyph id="app" size={34} strokeWidth={1.7} />
        </span>
        <div>
          <p className={styles.partEn}>SERVER</p>
          <h2 className={styles.partName}>{s.name}</h2>
          <p className={styles.partRole}>
            {st.text}
            {s.error ? `：${s.error}` : ""}
          </p>
        </div>
      </div>
      <dl className={styles.liveStats}>
        <div>
          <dt>返事をした数</dt>
          <dd>{s.served}件</dd>
        </div>
        <div>
          <dt>起動した回数</dt>
          <dd>{s.boots}回</dd>
        </div>
      </dl>
      <div className={styles.sheetActions}>
        <button type="button" className={styles.btnGhost} onClick={() => room.stop(index)} disabled={s.status === "stopped"}>
          止める
        </button>
        <button type="button" className={styles.btnPrimary} onClick={() => room.restart(index)}>
          再起動
        </button>
      </div>
    </div>
  );
}

function Choice<T extends string | number | boolean>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className={styles.roomChoice}>
      <span>{label}</span>
      <div className={styles.speed} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.v)} type="button" role="radio" aria-checked={value === o.v} data-on={value === o.v ? "1" : undefined} onClick={() => onChange(o.v)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
