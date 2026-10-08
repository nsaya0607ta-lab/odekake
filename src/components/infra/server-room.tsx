"use client";

/**
 * サーバー室：本物のプログラムで動くサーバーを、ブラウザの中に立ち上げて、本物の HTTP でやりとりする（room.ts）。
 * プログラムを書きかえて「デプロイ」→ リクエストを送る → 返事（ステータス・ヘッダー・本文）を見る。
 */
import { useEffect, useReducer, useRef, useState, type CSSProperties } from "react";
import { Glyph } from "./glyphs";
import { PARTS } from "./model";
import { ROOM_TEMPLATES, templateById, type Try } from "./room-templates";
import { METHODS, ServerRoom, bracketHint, hasBody, rawRequest, rawResponse, statusMeaning, type BurstResult, type Entry, type Method, type RoomSettings, type ServerStatus } from "./room";
import { sfx } from "./sound";
import styles from "./infra.module.css";

const KEY = "odekake_infra_room_v1";
const DEFAULT_SETTINGS: RoomSettings = { count: 2, lb: "rr", cdn: false, autoHeal: false };

/** code … デプロイしたプログラム、draft … 書きかけ（デプロイ前でも、閉じても消えないように） */
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

const STATUS: Record<ServerStatus, string> = { starting: "起動中…", up: "動いている", frozen: "返事がない", stopped: "止めた", error: "エラー" };

export function ServerRoomView() {
  const [saved] = useState(loadSaved);
  const [room, setRoom] = useState<ServerRoom | null>(null);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [draft, setDraft] = useState(saved.draft);
  const [template, setTemplate] = useState(saved.template);
  const [method, setMethod] = useState<Method>("GET");
  const [path, setPath] = useState("/");
  const [body, setBody] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [burst, setBurst] = useState<BurstResult | null>(null);
  const [busy, setBusy] = useState(false);
  const savedRef = useRef(saved);

  // サーバーは、この画面を開いているあいだだけ動かす
  useEffect(() => {
    const r = new ServerRoom(savedRef.current.code, savedRef.current.settings);
    setRoom(r);
    const off = r.subscribe(bump);
    return () => {
      off();
      r.dispose();
    };
  }, []);

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

  const deploy = () => {
    if (!room) return;
    room.deploy(draft);
    persist({ code: draft, draft, template });
    setBurst(null);
    sfx("start");
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

  const applyTry = (t: Try) => {
    setMethod(t.method);
    setPath(t.path);
    setBody(t.body ?? "");
  };

  const send = async (n: number) => {
    if (!room || busy) return;
    setBusy(true);
    setBurst(null);
    try {
      if (n === 1) {
        const e = await room.send(method, path, hasBody(method) ? body : null);
        setOpen(e.id);
        sfx(e.res.status < 400 ? "good" : "wrong");
      } else {
        const r = await room.burst(method, path, hasBody(method) ? body : null, n);
        setBurst(r);
        setOpen(null);
        sfx(r.fail ? "wrong" : "good");
      }
    } finally {
      setBusy(false);
    }
  };

  const setSettings = (patch: Partial<RoomSettings>) => {
    if (!room) return;
    room.setSettings(patch);
    persist({ settings: room.settings });
  };

  const settings = room?.settings ?? saved.settings;
  const dbRows = room ? [...room.db].slice(0, 60) : [];
  const errors = room ? [...new Set(room.servers.filter((s) => s.status === "error" && s.error).map((s) => s.error!))] : [];
  const hint = errors.length && room ? bracketHint(room.code) : null;

  return (
    <div className={styles.room}>
      <p className={styles.glossaryLead}>
        本物のプログラムで動くサーバーを、ブラウザの中に立ち上げる部屋です。プログラムを書いて「デプロイ」し、リクエストを送ると、本物の HTTP の返事が返ってきます。サーバーはこの画面の中だけで動き、プログラムからは外とつながる道具（fetch など）を使えないようにしてあります。
      </p>

      {/* 構成図 */}
      <section className={styles.roomTopo} aria-label="いまの構成">
        <Node icon="user" color="#9fb4ff" name="あなた" sub="リクエストを送る" />
        <Arrow />
        {settings.cdn ? (
          <>
            <Node icon="cdn" color={PARTS.cdn.color} name="CDN" sub="使い回せる返事を覚える" />
            <Arrow />
          </>
        ) : null}
        <Node icon="lb" color={PARTS.lb.color} name="ロードバランサー" sub={settings.lb === "rr" ? "順番に振り分ける" : "すいている方へ"} />
        <Arrow />
        <div className={styles.roomServers}>
          {(room?.servers ?? []).map((s, i) => (
            <div key={s.name} className={styles.roomServer} data-status={s.status} data-healthy={s.healthy ? "1" : undefined} style={{ "--c": PARTS.app.color } as CSSProperties}>
              <span className={styles.roomServerHead}>
                <Glyph id="app" size={18} />
                <b>{s.name}</b>
              </span>
              <small>
                {STATUS[s.status]}
                {s.status === "up" ? (s.healthy ? "・元気" : "・様子見中") : ""}
              </small>
              <small>
                処理 {s.served}件{s.inflight ? `・いま ${s.inflight}件` : ""}
              </small>
              <span className={styles.roomServerBtns}>
                <button type="button" onClick={() => room?.stop(i)} disabled={s.status === "stopped"}>
                  止める
                </button>
                <button type="button" onClick={() => room?.restart(i)}>
                  再起動
                </button>
              </span>
            </div>
          ))}
        </div>
        <Arrow />
        <div className={styles.roomData}>
          <Node icon="db" color={PARTS.db.color} name="データベース" sub={`env.db・${room?.db.size ?? 0}件`} />
          <Node icon="cache" color={PARTS.cache.color} name="キャッシュ" sub="env.cache" />
        </div>
      </section>

      {/* 設定 */}
      <section className={styles.roomPanel}>
        <Choice label="サーバーの数" value={settings.count} options={[1, 2, 3].map((n) => ({ v: n, label: `${n}台` }))} onChange={(v) => setSettings({ count: v })} />
        <Choice
          label="振り分け方"
          value={settings.lb}
          options={[
            { v: "rr" as const, label: "順番に" },
            { v: "least" as const, label: "すいている方" },
          ]}
          onChange={(v) => setSettings({ lb: v })}
        />
        <Choice
          label="CDN"
          value={settings.cdn}
          options={[
            { v: false, label: "なし" },
            { v: true, label: "あり" },
          ]}
          onChange={(v) => setSettings({ cdn: v })}
        />
        <Choice
          label="監視（固まったら自動で再起動）"
          value={settings.autoHeal}
          options={[
            { v: false, label: "なし" },
            { v: true, label: "あり" },
          ]}
          onChange={(v) => setSettings({ autoHeal: v })}
        />
      </section>

      {/* プログラム */}
      <section className={styles.roomPanel}>
        <h3 className={styles.roomTitle}>
          プログラム <small>いま動いているのは バージョン {room?.version ?? 0}</small>
        </h3>
        <div className={styles.exportTabs} role="radiogroup" aria-label="お手本">
          {ROOM_TEMPLATES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={template === t.id} data-on={template === t.id ? "1" : undefined} onClick={() => choose(t.id)}>
              {t.name}
            </button>
          ))}
        </div>
        <p className={styles.roomNote}>{tpl.note}</p>
        <ol className={styles.roomSteps} aria-label="やってみよう">
          {tpl.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
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
        <div className={styles.labRow} style={{ padding: "8px 0 0" }}>
          <button type="button" className={styles.btnPrimary} style={{ flex: 1 }} onClick={deploy} disabled={!room}>
            {changed ? "デプロイ（書きかえを反映）" : "もう一度デプロイ"}
          </button>
        </div>
      </section>

      {/* リクエスト */}
      <section className={styles.roomPanel}>
        <h3 className={styles.roomTitle}>リクエストを送る</h3>
        <div className={styles.exportTabs}>
          {tpl.tries.map((t, i) => (
            <button key={i} type="button" onClick={() => applyTry(t)} data-on={method === t.method && path === t.path ? "1" : undefined}>
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
        <div className={styles.labRow} style={{ padding: "8px 0 0" }}>
          <button type="button" className={styles.btnPrimary} style={{ flex: 1 }} onClick={() => void send(1)} disabled={!room || busy}>
            送る
          </button>
          <button type="button" className={styles.btnGhost} onClick={() => void send(20)} disabled={!room || busy}>
            20回まとめて
          </button>
        </div>
        {burst ? (
          <p className={styles.roomBurst}>
            {burst.total}回のうち 成功 {burst.ok}・失敗 {burst.fail}／平均 {burst.avgMs}ms／
            {Object.entries(burst.by)
              .map(([k, v]) => `${k} ${v}`)
              .join("・")}
          </p>
        ) : null}
      </section>

      {/* やりとりの記録 */}
      <section className={styles.roomPanel}>
        <h3 className={styles.roomTitle}>
          やりとりの記録 <small>タップで中身（本物の HTTP）</small>
        </h3>
        {room?.entries.length ? (
          <ul className={styles.roomLog}>
            {room.entries.slice(0, 30).map((e) => (
              <LogItem key={e.id} e={e} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} />
            ))}
          </ul>
        ) : (
          <p className={styles.roomNote}>まだありません。「送る」を押してみよう</p>
        )}
      </section>

      {/* サーバーのログ */}
      <section className={styles.roomPanel}>
        <h3 className={styles.roomTitle}>
          サーバーのログ <small>console.log もここに出ます</small>
        </h3>
        <ul className={styles.roomConsole}>
          {(room?.logs ?? []).slice(0, 40).map((l) => (
            <li key={l.id}>
              <time>{clock(l.at)}</time> <b>{l.server}</b> {l.text}
            </li>
          ))}
        </ul>
      </section>

      {/* データベース */}
      <section className={styles.roomPanel}>
        <h3 className={styles.roomTitle}>
          データベースの中身 <small>この端末に保存</small>
        </h3>
        {dbRows.length ? (
          <ul className={styles.roomConsole}>
            {dbRows.map(([k, v]) => (
              <li key={k}>
                <b>{k}</b> {JSON.stringify(v)}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.roomNote}>からっぽです</p>
        )}
        <div className={styles.sheetActions}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => {
              if (room && window.confirm("データベースの中身を、全部消します。よいですか？")) room.clearDb();
            }}
            disabled={!dbRows.length}
          >
            データベースを空にする
          </button>
        </div>
      </section>
    </div>
  );
}

function LogItem({ e, open, onToggle }: { e: Entry; open: boolean; onToggle: () => void }) {
  const tone = e.res.status >= 500 ? "ng" : e.res.status >= 400 ? "warn" : "ok";
  const cache = e.res.headers.find(([k]) => k === "x-cache")?.[1];
  return (
    <li className={styles.roomEntry}>
      <button type="button" onClick={onToggle} aria-expanded={open}>
        <span className={styles.roomStatus} data-tone={tone}>
          {e.res.status}
        </span>
        <span className={styles.roomEntryMain}>
          <b>
            {e.req.method} {e.req.path}
          </b>
          <small>
            {statusMeaning(e.res.status)}・{e.by}
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

function Node({ icon, color, name, sub }: { icon: "user" | "cdn" | "lb" | "db" | "cache"; color: string; name: string; sub: string }) {
  return (
    <div className={styles.roomNode} style={{ "--c": color } as CSSProperties}>
      <span className={styles.paletteIcon}>
        <Glyph id={icon} size={18} />
      </span>
      <span>
        <b>{name}</b>
        <small>{sub}</small>
      </span>
    </div>
  );
}

const clock = (at: number) => new Date(at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const Arrow = () => (
  <span className={styles.roomArrow} aria-hidden="true">
    ↓
  </span>
);

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
