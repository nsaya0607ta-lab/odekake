"use client";

/**
 * ラボ：パーツとアクセスを自由に変えて、ずっと動かしておける実験場。
 * 使えるパーツは、ステージで習ったものから増えていく。
 */
import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import { Board } from "./board";
import { PARTS, SLOT_KIND, SLOT_ORDER, partCost, yen, type PartKind, type Placement, type SlotId } from "./model";
import { PartSheet } from "./sheets";
import { InfraSim, type Rates, type SimSetup, type Tone } from "./sim";
import { sfx } from "./sound";
import styles from "./infra.module.css";

type Controls = { rate: number; staticPct: number; writePct: number; heavyPct: number; attack: number; far: number };

const FAR_USERS = 3;

export function Lab({ parts }: { parts: ReadonlySet<PartKind> }) {
  const slots = useMemo(() => SLOT_ORDER.filter((s) => parts.has(SLOT_KIND[s])), [parts]);
  const dnsOn = parts.has("dns");
  const [placements, setPlacements] = useState<Placement[]>(() => [
    ...(dnsOn ? [{ slot: "dns" as SlotId, kind: "dns" as PartKind, size: 0 }] : []),
    { slot: "app1", kind: "app", size: 0 },
  ]);
  const [sim, setSim] = useState<InfraSim | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [sheet, setSheet] = useState<SlotId | null>(null);
  const [ctl, setCtlState] = useState<Controls>({ rate: 6, staticPct: 25, writePct: 10, heavyPct: 0, attack: 0, far: 0 });
  const ctlRef = useRef(ctl);
  const spikeUntil = useRef(-1);
  const [stats, setStats] = useState<{ success: number | null; latency: number | null; rate: number; cost: number }>({ success: null, latency: null, rate: 0, cost: 0 });
  const [banner, setBanner] = useState<{ id: number; text: string; tone: Tone } | null>(null);

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
    const s = new InfraSim({ ...setup, farRatio: 0.5 }, placements, (Date.now() % 100000) + 1);
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

  const cost = placements.reduce((sum, p) => sum + partCost(p.kind, p.size), 0);
  const total = ctl.rate;

  return (
    <div className={styles.lab}>
      <p className={styles.glossaryLead}>パーツとアクセスを自由に変えて、ずっと動かしておける実験場です。使えるパーツは、ステージをクリアすると増えていきます。</p>
      <div className={styles.labBoard}>
        <Board
          slots={slots}
          placements={placements}
          fixed={new Set<SlotId>()}
          sim={sim}
          paused={paused}
          speed={speed}
          bot={parts.has("waf")}
          farUsers={parts.has("cdn") ? FAR_USERS : 0}
          selected={sheet}
          onSlot={setSheet}
          onTick={onTick}
        />
        {banner ? (
          <div key={banner.id} className={styles.banner} data-tone={banner.tone} role="status">
            {banner.text}
          </div>
        ) : null}
      </div>

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
          <button
            type="button"
            className={styles.btnGhost}
            disabled={!sim}
            onClick={() => {
              if (sim && !sim.crash("app", 8)) sfx("wrong");
            }}
          >
            サーバーを止める
          </button>
          {parts.has("db") ? (
            <button
              type="button"
              className={styles.btnGhost}
              disabled={!sim}
              onClick={() => {
                if (sim && !sim.crash("db", 8)) sfx("wrong");
              }}
            >
              DB を止める
            </button>
          ) : null}
          <button
            type="button"
            className={styles.btnGhost}
            disabled={!sim}
            onClick={() => {
              if (!sim) return;
              spikeUntil.current = sim.now + 10;
              sim.banners.push({ text: "📈 アクセス急増！（10秒）", tone: "danger" });
            }}
          >
            アクセス急増
          </button>
        </div>
      </div>

      <PartSheet
        slot={sheet}
        placements={placements}
        fixed={new Set<SlotId>()}
        budget={Infinity}
        sim={sim}
        isNew={false}
        onClose={() => setSheet(null)}
        onPlace={(slot, size) => {
          const exists = placements.some((p) => p.slot === slot);
          setPlacements((cur) => (exists ? cur.map((p) => (p.slot === slot ? { ...p, size } : p)) : [...cur, { slot, kind: SLOT_KIND[slot], size }]));
          sfx("place");
          if (!exists) setSheet(null);
        }}
        onRemove={(slot) => {
          setPlacements((cur) => cur.filter((p) => p.slot !== slot));
          setSheet(null);
          sfx("remove");
        }}
      />
    </div>
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
