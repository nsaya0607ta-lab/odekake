"use client";

/**
 * ラボ（自由設計）：パーツを好きな数だけ置いて、線を自由につなぎ、アクセスを流して実験する。
 * 組み立てた構成は「本物の設定にする」で、docker-compose・Terraform の設定ファイルとして見られる（export.ts）。
 * 使えるパーツは、ステージで習ったものから増えていく。設計図はこの端末に覚えておく（design.ts）。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Board } from "./board";
import { addPart, autoWire, countOf, designWarnings, loadDesign, removePart, resizePart, saveDesign, toggleLink, LIMITS, type Design } from "./design";
import { exportDesign } from "./export";
import { Glyph } from "./glyphs";
import { USERS, lineCount, linkBetween } from "./layout";
import { PARTS, PART_KINDS, partCost, slotLabel, yen, type NodeId, type PartKind } from "./model";
import { BottomSheet, PartSheet } from "./sheets";
import { InfraSim, type Rates, type SimSetup, type Tone } from "./sim";
import { sfx } from "./sound";
import styles from "./infra.module.css";

type Controls = { rate: number; staticPct: number; writePct: number; heavyPct: number; attack: number; far: number };
type Note = { id: number; text: string; tone: "ok" | "ng" };

const FAR_USERS = 3;
const NO_FIXED = new Set<NodeId>();
/** 「もとにもどす」でもどれる回数 */
const UNDO_MAX = 40;
const nameOf = (id: string) => (id === USERS ? "利用者" : slotLabel(id));

export function Lab({ parts }: { parts: ReadonlySet<PartKind> }) {
  const dnsOn = parts.has("dns");
  // ラボはブラウザの中でだけ描く（infra-app.tsx が、進み具合を読んでから出す）ので、はじめから覚えておいた設計図を読める
  const [design, setDesignState] = useState<Design>(() => loadDesign(parts));
  const designRef = useRef(design);
  const history = useRef<Design[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  /** 設計図を変える（ひとつ前の形を「もとにもどす」用にとっておく） */
  const setDesign = useCallback((d: Design) => {
    history.current = [...history.current, designRef.current].slice(-UNDO_MAX);
    setCanUndo(true);
    designRef.current = d;
    setDesignState(d);
    saveDesign(d);
  }, []);
  const undo = () => {
    const prev = history.current.pop();
    if (!prev) return;
    designRef.current = prev;
    setDesignState(prev);
    saveDesign(prev);
    setCanUndo(history.current.length > 0);
    setLinkFrom(null);
    setSheet(null);
    sfx("remove");
    flash("ひとつ前の形にもどしました");
  };

  const [sim, setSim] = useState<InfraSim | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [sheet, setSheet] = useState<NodeId | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [palette, setPalette] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [ctl, setCtlState] = useState<Controls>({ rate: 6, staticPct: 25, writePct: 10, heavyPct: 0, attack: 0, far: 0 });
  const ctlRef = useRef(ctl);
  const spikeUntil = useRef(-1);
  const [stats, setStats] = useState<{ success: number | null; latency: number | null; rate: number; cost: number }>({ success: null, latency: null, rate: 0, cost: 0 });
  const [banner, setBanner] = useState<{ id: number; text: string; tone: Tone } | null>(null);

  const slots = useMemo(() => design.placements.map((p) => p.slot), [design]);
  // 行が増えたら盤面を縦にのばす（行と行のあいだは 112px くらい）
  const lines = lineCount(slots);
  const boardHeight = Math.max(420, 180 + Math.max(0, lines - 1) * 112 + 100);
  const rowRange = useMemo(() => ({ top: 180 / boardHeight, bottom: (boardHeight - 100) / boardHeight }), [boardHeight]);
  // 線をつなぐモードで選んだものと、つなげる相手
  const targets = useMemo(() => {
    const out = new Set<string>();
    if (!linking || !linkFrom) return out;
    for (const c of [USERS, ...slots]) if (c !== linkFrom && linkBetween(linkFrom, c)) out.add(c);
    return out;
  }, [linking, linkFrom, slots]);
  const warnings = useMemo(() => {
    const list = designWarnings(design);
    if (dnsOn && !slots.includes("dns")) list.unshift("DNS がないと、利用者はお店の住所をしらべられません");
    return list;
  }, [design, dnsOn, slots]);

  const flash = (text: string, tone: Note["tone"] = "ok") => {
    const id = Date.now();
    setNote({ id, text, tone });
    window.setTimeout(() => setNote((cur) => (cur?.id === id ? null : cur)), 2600);
  };

  const setCtl = (patch: Partial<Controls>) => {
    const next = { ...ctlRef.current, ...patch };
    ctlRef.current = next;
    setCtlState(next);
    if (sim) sim.setup.farRatio = next.far / 100;
  };

  const setup = useMemo<SimSetup>(
    () => ({
      requiresDns: dnsOn,
      farRatio: 0,
      duration: Infinity,
      events: [],
      traffic: (t: number): Rates => {
        const c = ctlRef.current;
        const base = c.rate * (t < spikeUntil.current ? 2.5 : 1);
        const st = c.staticPct / 100, wr = c.writePct / 100, hv = c.heavyPct / 100;
        const page = Math.max(0, 1 - st - wr - hv);
        return { page: base * page, static: base * st, write: base * wr, heavy: base * hv, attack: c.attack };
      },
    }),
    [dnsOn],
  );

  const start = () => {
    sfx("start");
    const s = new InfraSim({ ...setup, farRatio: 0.5 }, design.placements, (Date.now() % 100000) + 1, design.links);
    s.setup.farRatio = ctlRef.current.far / 100;
    spikeUntil.current = -1;
    setSim(s);
    setPaused(false);
  };
  const stop = () => {
    setSim(null);
    setStats({ success: null, latency: null, rate: 0, cost: 0 });
  };

  const onTick = useCallback((s: InfraSim) => {
    const r = s.recent(10);
    setStats({ success: r.success, latency: r.latency, rate: r.rate, cost: s.cost() });
    s.tips = [];
    if (s.banners.length) {
      const b = s.banners[s.banners.length - 1]!;
      s.banners = [];
      if (b.tone === "danger") sfx("alarm");
      setBanner({ id: Date.now(), ...b });
      window.setTimeout(() => setBanner((cur) => (cur && Date.now() - cur.id > 2400 ? null : cur)), 2600);
    }
  }, []);

  /** 線をつなぐモード：2つを順にタップすると、つなぐ（つながっていたら外す） */
  const pick = (id: string) => {
    if (!linkFrom) {
      setLinkFrom(id);
      return;
    }
    if (linkFrom === id) {
      setLinkFrom(null);
      return;
    }
    const r = toggleLink(design, linkFrom, id);
    if (!r) {
      sfx("wrong");
      flash(`${nameOf(linkFrom)} と ${nameOf(id)} は、つなげません`, "ng");
      setLinkFrom(id === USERS ? null : id);
      return;
    }
    setDesign(r.design);
    sfx(r.added ? "place" : "remove");
    flash(r.added ? `${nameOf(linkFrom)} → ${nameOf(id)} をつなぎました` : `${nameOf(linkFrom)} と ${nameOf(id)} の線を外しました`);
    setLinkFrom(null);
  };

  const add = (kind: PartKind) => {
    const r = addPart(design, kind);
    if (!r) return;
    setDesign(r.design);
    sfx("place");
    setPalette(false);
    flash(r.rewired ? `${slotLabel(r.id)} を置いて、入口のつなぎ方を組みなおしました` : `${slotLabel(r.id)} を置きました`);
  };

  const cost = design.placements.reduce((sum, p) => sum + partCost(p.kind, p.size), 0);
  const total = ctl.rate;
  const kinds = PART_KINDS.filter((k) => parts.has(k));

  return (
    <div className={styles.lab}>
      <p className={styles.glossaryLead}>
        パーツを好きな数だけ置いて、線を自由につないで実験できる設計室です。組み立てた構成は、本物のインフラの設定ファイルにできます。使えるパーツは、ステージをクリアすると増えていきます。
      </p>

      <div className={styles.labTools}>
        <button type="button" className={styles.btn} onClick={() => setPalette(true)}>
          ＋ パーツ
        </button>
        <button
          type="button"
          className={styles.btnGhost}
          data-on={linking ? "1" : undefined}
          aria-pressed={linking}
          onClick={() => {
            setLinking((v) => !v);
            setLinkFrom(null);
            setSheet(null);
          }}
        >
          {linking ? "つなぐのをやめる" : "線をつなぐ"}
        </button>
        <button
          type="button"
          className={styles.btnGhost}
          onClick={() => {
            setDesign(autoWire(design));
            setLinkFrom(null);
            sfx("place");
            flash("ふつうのつなぎ方に組みなおしました（「↶」でもどせます）");
          }}
        >
          自動でつなぐ
        </button>
        <button type="button" className={styles.btnGhost} onClick={undo} disabled={!canUndo} aria-label="もとにもどす" title="もとにもどす">
          ↶
        </button>
        <button type="button" className={styles.btnPrimary} onClick={() => setExporting(true)}>
          本物の設定にする
        </button>
      </div>

      {linking ? (
        <p className={styles.labHint} role="status">
          {linkFrom
            ? targets.size
              ? `「${nameOf(linkFrom)}」から… 光っている相手をタップ（つながっていたら外れます）`
              : `「${nameOf(linkFrom)}」とつなげる相手が、いまはありません`
            : "つなぎたい2つを順にタップ。つながっていたら外れます。いちばん上の利用者の列もタップできます"}
        </p>
      ) : null}

      <div className={styles.labBoard} style={{ height: boardHeight }}>
        <Board
          slots={slots}
          placements={design.placements}
          links={design.links}
          fixed={NO_FIXED}
          sim={sim}
          paused={paused}
          speed={speed}
          bot={parts.has("waf")}
          farUsers={parts.has("cdn") ? FAR_USERS : 0}
          selected={linking ? (linkFrom === USERS ? null : linkFrom) : sheet}
          onSlot={(id) => (linking ? pick(id) : setSheet(id))}
          onUsers={linking ? () => pick(USERS) : undefined}
          usersSelected={linkFrom === USERS}
          targets={targets}
          focus={linking ? linkFrom : null}
          rowRange={rowRange}
          onTick={onTick}
        />
        {banner ? (
          <div key={banner.id} className={styles.banner} data-tone={banner.tone} role="status">
            {banner.text}
          </div>
        ) : null}
      </div>
      {/* つないだ・置いた の知らせは、盤面が縦に長くても見えるように、画面の下に浮かべる */}
      {note ? (
        <div key={note.id} className={styles.labToast} data-tone={note.tone} role="status">
          {note.text}
        </div>
      ) : null}

      {warnings.length ? (
        <ul className={styles.labWarn}>
          {warnings.slice(0, 3).map((w) => (
            <li key={w}>{w}</li>
          ))}
          {warnings.length > 3 ? <li>ほか {warnings.length - 3} 件</li> : null}
        </ul>
      ) : null}

      <div className={styles.labHud}>
        <span>
          <small>成功率（直近10秒）</small>
          <b>{stats.success == null ? "—" : `${(stats.success * 100).toFixed(1)}%`}</b>
        </span>
        <span>
          <small>速さ</small>
          <b>{stats.latency == null ? "—" : `${Math.round(stats.latency)}ms`}</b>
        </span>
        <span>
          <small>月額</small>
          <b>{yen(sim ? stats.cost : cost)}</b>
        </span>
      </div>

      <div className={styles.labRow}>
        {sim ? (
          <>
            <button type="button" className={styles.iconBtn} onClick={() => setPaused((p) => !p)} aria-label={paused ? "再開" : "一時停止"}>
              {paused ? "▶" : "❚❚"}
            </button>
            <div className={styles.speed} role="radiogroup" aria-label="速さ">
              {[1, 2, 4].map((v) => (
                <button key={v} type="button" role="radio" aria-checked={speed === v} data-on={speed === v ? "1" : undefined} onClick={() => setSpeed(v)}>
                  ×{v}
                </button>
              ))}
            </div>
            <button type="button" className={styles.btnGhost} onClick={stop}>
              止める
            </button>
          </>
        ) : (
          <button type="button" className={styles.btnPrimary} onClick={start} style={{ flex: 1 }}>
            動かす
          </button>
        )}
      </div>

      <div className={styles.labPanel}>
        <Slider label="アクセスの数" value={ctl.rate} min={1} max={40} step={1} unit="件/秒" onChange={(v) => setCtl({ rate: v })} />
        <Slider label="画像の割合" value={ctl.staticPct} min={0} max={80} step={5} unit="%" color={PARTS.cdn.color} onChange={(v) => setCtl({ staticPct: Math.min(v, 100 - ctl.writePct - ctl.heavyPct) })} />
        <Slider label="投稿の割合" value={ctl.writePct} min={0} max={40} step={5} unit="%" color="#f9a8d4" onChange={(v) => setCtl({ writePct: Math.min(v, 100 - ctl.staticPct - ctl.heavyPct) })} />
        <Slider label="重い処理の割合" value={ctl.heavyPct} min={0} max={30} step={5} unit="%" color="#c4a1ff" onChange={(v) => setCtl({ heavyPct: Math.min(v, 100 - ctl.staticPct - ctl.writePct) })} />
        {parts.has("cdn") ? <Slider label="遠くの町の人" value={ctl.far} min={0} max={100} step={10} unit="%" color={PARTS.cdn.color} onChange={(v) => setCtl({ far: v })} /> : null}
        {parts.has("waf") ? <Slider label="攻撃" value={ctl.attack} min={0} max={30} step={1} unit="件/秒" color="#ff6f8a" onChange={(v) => setCtl({ attack: v })} /> : null}
        <p className={styles.labMix}>
          ページ {Math.max(0, 100 - ctl.staticPct - ctl.writePct - ctl.heavyPct)}%・画像 {ctl.staticPct}%・投稿 {ctl.writePct}%・重い処理 {ctl.heavyPct}%（合計 {total}件/秒）
        </p>
      </div>

      <div className={styles.labEvents}>
        <p>事件を起こす</p>
        <div>
          <EventButton sim={sim} label="サーバーを止める" run={(s) => s.crash("app", 8)} />
          {parts.has("db") ? <EventButton sim={sim} label="DB を止める" run={(s) => s.crash("db", 8)} /> : null}
          {parts.has("monitor") ? <EventButton sim={sim} label="サーバーを不調に" run={(s) => s.slowDown(30)} /> : null}
          {parts.has("backup") ? <EventButton sim={sim} label="DB のデータを消す" run={(s) => s.wipe()} /> : null}
          {parts.has("region") ? <EventButton sim={sim} label="停電（20秒）" run={(s) => s.outage(20)} /> : null}
          <EventButton
            sim={sim}
            label="アクセス急増"
            run={(s) => {
              spikeUntil.current = s.now + 10;
              s.banners.push({ text: "📈 アクセス急増！（10秒）", tone: "danger" });
              return true;
            }}
          />
        </div>
      </div>

      <PartSheet
        slot={linking ? null : sheet}
        placements={design.placements}
        fixed={NO_FIXED}
        budget={Infinity}
        sim={sim}
        isNew={false}
        onClose={() => setSheet(null)}
        onPlace={(slot, size) => {
          setDesign(resizePart(design, slot, size));
          sfx("place");
        }}
        onRemove={(slot) => {
          const r = removePart(design, slot);
          setDesign(r.design);
          setSheet(null);
          sfx("remove");
          if (r.rewired) flash("入口のつなぎ方を組みなおしました");
        }}
      />

      <BottomSheet open={palette} onClose={() => setPalette(false)} label="パーツを足す">
        <h2 className={styles.sheetTitle}>パーツを足す</h2>
        <div className={styles.paletteList}>
          {kinds.map((k) => {
            const spec = PARTS[k];
            const n = countOf(design, k);
            const full = n >= LIMITS[k];
            return (
              <button key={k} type="button" className={styles.paletteItem} disabled={full} onClick={() => add(k)} style={{ "--c": spec.color } as CSSProperties}>
                <span className={styles.paletteIcon} aria-hidden="true">
                  <Glyph id={k} size={22} />
                </span>
                <span className={styles.paletteText}>
                  <b>{spec.name}</b>
                  <small>{spec.role}</small>
                </span>
                <span className={styles.paletteMeta}>
                  <b>{yen(spec.sizes[0]!.cost)}</b>
                  <small>
                    {n}/{LIMITS[k]}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
        {kinds.length < PART_KINDS.length ? <p className={styles.budgetLine}>ステージをクリアすると、使えるパーツが増えます</p> : null}
      </BottomSheet>

      <ExportSheet open={exporting} design={design} onClose={() => setExporting(false)} />
    </div>
  );
}

function EventButton({ sim, label, run }: { sim: InfraSim | null; label: string; run: (s: InfraSim) => boolean }) {
  return (
    <button
      type="button"
      className={styles.btnGhost}
      disabled={!sim}
      onClick={() => {
        if (sim && !run(sim)) sfx("wrong");
      }}
    >
      {label}
    </button>
  );
}

/** 「本物の設定にする」：組み立てた構成を、docker-compose・Terraform の設定ファイルで見せる */
function ExportSheet({ open, design, onClose }: { open: boolean; design: Design; onClose: () => void }) {
  const out = useMemo(() => (open ? exportDesign(design) : null), [open, design]);
  const [tab, setTab] = useState(0);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (open) setTab(0);
  }, [open]);
  if (!out) return null;
  const file = tab > 0 ? out.files[tab - 1] : undefined;

  const copy = async () => {
    if (!file) return;
    try {
      await navigator.clipboard.writeText(file.body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      sfx("wrong");
    }
  };
  const download = () => {
    if (!file) return;
    const url = URL.createObjectURL(new Blob([file.body], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <BottomSheet open={open} onClose={onClose} label="本物の設定にする">
      <h2 className={styles.sheetTitle}>本物の設定にする</h2>
      <p className={styles.exportLead}>
        組み立てた構成を、本物のインフラの設定ファイルにしました。docker-compose はパソコンの中に、Terraform は AWS（クラウド）に、同じ構成を作るための設定です。線のつなぎ方も反映されています。学習用の見本なので、本物の値が要るところ（OS イメージ・ネットワーク・パスワードなど）は変数にしてあります。
      </p>
      <div className={styles.exportTabs} role="tablist" aria-label="ファイル">
        {["まとめ", ...out.files.map((f) => f.name)].map((name, i) => (
          <button key={name} type="button" role="tab" aria-selected={tab === i} data-on={tab === i ? "1" : undefined} onClick={() => setTab(i)}>
            {name}
          </button>
        ))}
      </div>
      {file ? (
        <>
          <pre className={styles.codeBlock}>
            <code>{file.body}</code>
          </pre>
          <div className={styles.sheetActions}>
            <button type="button" className={styles.btnGhost} onClick={download}>
              ファイルを保存
            </button>
            <button type="button" className={styles.btn} onClick={copy}>
              {copied ? "コピーしました" : "コピー"}
            </button>
          </div>
        </>
      ) : (
        <table className={styles.exportTable}>
          <thead>
            <tr>
              <th>パーツ</th>
              <th>パソコンの中</th>
              <th>AWS</th>
            </tr>
          </thead>
          <tbody>
            {out.rows.map((r) => (
              <tr key={r.part}>
                <td>{r.part}</td>
                <td>{r.local}</td>
                <td>{r.aws}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </BottomSheet>
  );
}

function Slider({ label, value, min, max, step, unit, color, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; color?: string; onChange: (v: number) => void }) {
  return (
    <label className={styles.slider} style={{ "--c": color ?? "#67e8f9" } as CSSProperties}>
      <span>
        {label}
        <b>
          {value}
          {unit}
        </b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
