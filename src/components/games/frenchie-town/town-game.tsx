"use client";

import Link from "next/link";
import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { CATALOG, SIZE, MISSIONS, cleanName, decodeTown, definition, encodeTown, initialTown, parseTown, placeProblem, residents, sellValue, storageKey, totalIncome, townLevel, townRank, townReducer, upgradeCost, type CityState, type Kind, type SharedTown } from "@/lib/games/frenchie-town/state";
import { TownCanvas, type SceneCommand } from "./town-canvas";
import { Coin, TownArt } from "./town-art";
import type { Ghost } from "./scene";
import styles from "./town.module.css";

const DOG_NAMES = ["モカ", "むぎ", "きなこ", "ごま", "こむぎ", "ミルク", "くるみ", "あずき"];

type Placement = { kind: Kind; x: number; z: number; rotation: number; movingId?: string };
type Modal = "dogs" | "help" | "missions" | "grid" | "rename" | "share" | "restore" | "sell" | null;

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const element = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = element.current; dialog?.showModal(); return () => { dialog?.close(); }; }, []);
  return <dialog ref={element} className={styles.dialog} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }} aria-label={title}>
    <header className={styles.dialogHead}><h2>{title}</h2><button type="button" onClick={onClose} aria-label="閉じる">×</button></header>{children}
  </dialog>;
}

export function TownGame({ userId }: { userId: string }) {
  const [state, dispatch] = useReducer(townReducer, undefined, () => initialTown());
  const [loaded, setLoaded] = useState(false), [saveError, setSaveError] = useState(false);
  const [now, setNow] = useState(0), [category, setCategory] = useState("建物");
  const [placement, setPlacement] = useState<Placement | null>(null), [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null), [shared, setShared] = useState<SharedTown | null>(null);
  const [command, setCommand] = useState<SceneCommand | null>(null), [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [draftName, setDraftName] = useState(""), [shareUrl, setShareUrl] = useState(""), [imported, setImported] = useState<CityState | null>(null);
  const file = useRef<HTMLInputElement>(null), lastState = useRef(state);
  lastState.current = state;
  const notify = (text: string) => setToast({ id: performance.now(), text });
  const sceneCommand = (type: SceneCommand["type"], dog?: string) => setCommand({ id: performance.now(), type, dog });

  useEffect(() => {
    const key = storageKey(userId);
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        let parsed: CityState | null = null;
        try { parsed = raw.length <= 50_000 ? parseTown(JSON.parse(raw)) : null; } catch { /* 読めない内容も復旧用に残す */ }
        if (parsed) dispatch({ type: "load", state: parsed });
        else { localStorage.setItem(`${key}:recovery`, raw); setSaveError(true); }
      }
    } catch { setSaveError(true); }
    setNow(Date.now()); setLoaded(true);
    const timer = window.setInterval(() => { if (!document.hidden) setNow(Date.now()); }, 1000);
    const onVisible = () => { if (!document.hidden) setNow(Date.now()); };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key || !event.newValue || event.newValue.length > 50_000) return;
      try { const incoming = parseTown(JSON.parse(event.newValue)); if (incoming && incoming.updatedAt > lastState.current.updatedAt) dispatch({ type: "load", state: incoming }); } catch { /* 古い形式や壊れた値では街を置き換えない */ }
    };
    const onHash = () => {
      const encoded = new URLSearchParams(location.hash.slice(1)).get("town");
      if (!encoded) { setShared(null); return; }
      const town = decodeTown(encoded);
      if (town) { setShared(town); setPlacement(null); setSelected(null); }
      else setToast({ id: performance.now(), text: "この街のリンクは読み込めませんでした" });
    };
    onHash(); window.addEventListener("hashchange", onHash); window.addEventListener("storage", onStorage); document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); window.removeEventListener("hashchange", onHash); window.removeEventListener("storage", onStorage); document.removeEventListener("visibilitychange", onVisible); };
  }, [userId]);
  useEffect(() => { if (!loaded) return; try { localStorage.setItem(storageKey(userId), JSON.stringify(state)); } catch { setSaveError(true); } }, [state, loaded, userId]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 3200); return () => window.clearTimeout(timer); }, [toast]);

  const city = shared ? { ...state, name: shared.name, buildings: shared.buildings } : state;
  const building = city.buildings.find((b) => b.id === selected);
  const mission = MISSIONS.find((m) => !state.claimed.includes(m.id));
  const income = totalIncome(state, now);
  const ghost = useMemo<Ghost | null>(() => placement ? { ...placement, valid: !placeProblem(state, placement.x, placement.z, placement.movingId) && (placement.movingId !== undefined || state.coins >= definition(placement.kind).price) } : null, [placement, state]);
  const problem = placement ? placeProblem(state, placement.x, placement.z, placement.movingId) ?? (!placement.movingId && state.coins < definition(placement.kind).price ? "白コインが足りないよ" : null) : null;

  function pickKind(kind: Kind) {
    if (shared) return;
    const item = definition(kind);
    if (state.coins < item.price) { notify("白コインが足りないよ。街のお願いやお店の売上を受け取ろう"); return; }
    const cells = Array.from({ length: SIZE * SIZE }, (_, i) => ({ x: i % SIZE, z: Math.floor(i / SIZE) })).sort((a, b) => Math.hypot(a.x - 4, a.z - 4) - Math.hypot(b.x - 4, b.z - 4));
    const at = cells.find((c) => !placeProblem(state, c.x, c.z));
    if (!at) { notify("街がいっぱいになったよ"); return; }
    setSelected(null); setPlacement({ kind, ...at, rotation: 0 });
  }
  function confirmPlacement() {
    if (!placement || shared || problem) return;
    const time = Date.now();
    if (placement.movingId) dispatch({ type: "move", id: placement.movingId, x: placement.x, z: placement.z, rotation: placement.rotation, now: time });
    else dispatch({ type: "build", ...placement, id: crypto.randomUUID(), now: time });
    notify(placement.movingId ? "お引っ越しできたよ" : `${definition(placement.kind).name}ができたよ！`); setPlacement(null);
  }
  function pet(id: string) {
    sceneCommand("happy", id);
    if (shared) { notify("遊びに来てくれてうれしいワン！"); return; }
    const time = Date.now();
    if (state.pets[id] !== undefined && time - state.pets[id]! < 60_000) { notify("ありがとう！ またなでてね ♥"); return; }
    dispatch({ type: "pet", id, now: time }); notify("なでてくれてありがとう ♥ 白コイン +10");
  }
  function harvest() {
    const value = totalIncome(state, Date.now());
    if (!value || shared) return;
    dispatch({ type: "harvest", now: Date.now() }); notify(`お店の売上を受け取ったよ！ 白コイン +${value}`);
  }
  function exportSave() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "frenchie-town.json"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("街の保存ファイルを作ったよ");
  }
  async function importSave(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]; event.target.value = "";
    if (!selected || shared) return;
    if (selected.size > 50_000) { notify("この保存ファイルは読み込めません"); return; }
    try { const parsed = parseTown(JSON.parse(await selected.text())); if (!parsed) throw new Error(); setImported(parsed); setModal("restore"); } catch { notify("街の保存ファイルを確認してね"); }
  }
  async function share() {
    const url = new URL(location.href); url.hash = `town=${encodeTown({ v: 1, name: city.name, buildings: city.buildings })}`; url.search = "";
    setShareUrl(url.href); setModal("share");
    try { await navigator.clipboard.writeText(url.href); notify("街の招待リンクをコピーしたよ"); } catch { /* ダイアログからリンクを選んでコピーできる */ }
  }

  if (!loaded) return <main className={styles.game}><div className={styles.loading}><span className={styles.loadingDog}>🐾</span><p>フレンチーの街へようこそ</p></div></main>;
  return <main className={styles.game} aria-label="フレンチーの街づくり">
    <header className={styles.header}>
      <Link href="/games" className={styles.back} aria-label="ミニゲームに戻る">‹</Link>
      <div className={styles.title}><span>FRENCHIE TOWN <i>3D</i></span><button type="button" onClick={() => { if (shared) return; setDraftName(state.name); setModal("rename"); }} disabled={!!shared}>{city.name}{!shared ? <small>✎</small> : null}</button></div>
      <button type="button" className={styles.help} onClick={() => setModal("help")} aria-label="遊び方と保存">?</button>
    </header>
    <div className={styles.hud}>
      <button type="button" className={styles.rank} aria-label="街のわんこを見る" onClick={() => setModal("dogs")}><span className={styles.level}>Lv.{townLevel(city)}</span><div><strong>{townRank(city)}</strong><small>住人 {residents(city)}匹 · 建物 {city.buildings.length}個</small></div></button>
      {!shared ? <div className={styles.wallet} aria-label={`白コイン ${state.coins}枚`}><Coin/><div><small>白コイン</small><strong>{state.coins.toLocaleString()}</strong></div></div> : <span className={styles.visitBadge}>お友だちの街</span>}
    </div>
    <div className={styles.world}>
      <TownCanvas buildings={city.buildings} ghost={ghost} now={shared ? 0 : now} command={command}
        onCell={(cell) => { if (placement) setPlacement({ ...placement, ...cell }); else { setSelected(null); if (!shared) notify("下から建物を選んで、街に置いてみよう"); } }}
        onBuilding={(id) => { if (placement) return; setSelected(id); }} onDog={pet}/>
      <div className={styles.cameraTools} aria-label="カメラ操作">
        <button type="button" onClick={() => sceneCommand("left")} aria-label="街を左へ回す">↶</button><button type="button" onClick={() => sceneCommand("right")} aria-label="街を右へ回す">↷</button>
        <span/><button type="button" onClick={() => sceneCommand("zoom-in")} aria-label="街を拡大する">＋</button><button type="button" onClick={() => sceneCommand("zoom-out")} aria-label="街を縮小する">−</button><button type="button" onClick={() => sceneCommand("reset")} aria-label="視点を戻す">⌂</button>
      </div>
      <div className={styles.sceneHint}>{placement ? "置きたい場所をタップしてね" : "スワイプで回転 · ピンチで拡大 · わんこをタップ"}</div>
      {!shared && !placement && !building && income > 0 ? <button type="button" className={styles.harvest} onClick={harvest}><Coin/>お店の売上を受け取る <strong>+{income}</strong></button> : null}
      {shared ? <div className={styles.visit}><span>この街は招待リンクを作ったときの景色です</span><button type="button" onClick={() => { history.replaceState(null, "", location.pathname); setShared(null); setSelected(null); }}>自分の街へ戻る</button></div> : null}
      {toast ? <div className={styles.toast} role="status" key={toast.id}>{toast.text}</div> : null}
    </div>
    <section className={styles.dock} aria-label={shared ? "街の見学" : "街づくりの操作"}>
      {placement ? <div className={styles.placement}>
        <div className={styles.placementHead}><TownArt kind={placement.kind}/><div><strong>{placement.movingId ? "お引っ越し" : definition(placement.kind).name}</strong><small>{problem ?? `${placement.x + 1}列${placement.z + 1}行に置くよ`}</small></div><button type="button" className={styles.iconButton} onClick={() => setPlacement({ ...placement, rotation: (placement.rotation + 1) % 4 })} aria-label="建物を回転する">↻</button></div>
        <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => setPlacement(null)}>やめる</button><button type="button" className={styles.secondary} onClick={() => setModal("grid")}>場所を選ぶ</button><button type="button" className={styles.primary} disabled={!!problem} onClick={confirmPlacement}>{placement.movingId ? "ここに移す" : <><Coin/>{definition(placement.kind).price}で建てる</>}</button></div>
      </div> : building ? <div className={styles.placement}>
        <div className={styles.placementHead}><TownArt kind={building.kind}/><div><strong>{definition(building.kind).name} <i>Lv.{building.level}</i></strong><small>{definition(building.kind).income ? `毎分 白コイン${definition(building.kind).income * building.level}枚（最大5分分）` : definition(building.kind).caption}</small></div><button type="button" className={styles.iconButton} onClick={() => setSelected(null)} aria-label="建物の操作を閉じる">×</button></div>
        {!shared ? <div className={styles.buildingActions}>
          <button type="button" onClick={() => { setPlacement({ kind: building.kind, x: building.x, z: building.z, rotation: building.rotation, movingId: building.id }); setSelected(null); }}>✥<small>移動</small></button>
          <button type="button" onClick={() => dispatch({ type: "rotate", id: building.id, now: Date.now() })}>↻<small>回転</small></button>
          <button type="button" disabled={building.level >= 3 || state.coins < upgradeCost(building)} onClick={() => { dispatch({ type: "upgrade", id: building.id, now: Date.now() }); notify("街の建物がレベルアップ！"); }}>✦<small>{building.level >= 3 ? "レベルMAX" : `強化 ${upgradeCost(building)}枚`}</small></button>
          <button type="button" onClick={() => setModal("sell")}>↩<small>売る {sellValue(building)}枚</small></button>
        </div> : <p className={styles.visitorText}>自分の街にも建ててみよう</p>}
      </div> : shared ? <div className={styles.visitorText}><strong>街を回して、お友だちの景色を楽しもう</strong><p>建物やわんこをタップしてみてね。</p></div> : <>
        <div className={styles.missionBar}>
          <button type="button" onClick={() => setModal("missions")}><span className={styles.missionIcon}>✉</span><span><small>街のお願い</small><strong>{mission ? mission.detail : "すべてのお願いをかなえたよ！"}</strong></span></button>
          {mission ? <button type="button" className={styles.missionReward} onClick={() => { if (mission.progress(state) >= mission.target) { dispatch({ type: "claim", id: mission.id, now: Date.now() }); notify(`お願い達成！ 白コイン +${mission.reward}`); } else if (mission.kind) { setCategory(definition(mission.kind).category); pickKind(mission.kind); } else notify("街を歩いているわんこをタップしてね"); }}>{mission.progress(state) >= mission.target ? <><Coin/>+{mission.reward} 受け取る</> : `${Math.min(mission.progress(state), mission.target)} / ${mission.target} ›`}</button> : <span>✦</span>}
        </div>
        <div className={styles.catalogHead}><div className={styles.tabs} aria-label="お店のカテゴリ">{["建物", "自然", "飾り"].map((tab) => <button type="button" key={tab} aria-pressed={category === tab} onClick={() => setCategory(tab)}>{tab}</button>)}</div><button type="button" className={styles.shareButton} onClick={share} aria-label="街の招待リンクを作る">↗ 招待</button></div>
        <div className={styles.catalog} aria-label="白コインで買える建物と飾り">{CATALOG.filter((item) => item.category === category).map((item) => <button type="button" key={item.id} className={styles.card} onClick={() => pickKind(item.id)} aria-label={`${item.name}を選ぶ ${item.price}枚`}><TownArt kind={item.id}/><strong>{item.name}</strong><span><Coin/>{item.price}</span></button>)}</div>
      </>}
      <div className={styles.saveNote}>{shared ? "招待された街を見学中" : saveError ? "端末への保存を確認できません · ? からバックアップできます" : "この端末に自動保存 · 街づくりの試作版"}</div>
    </section>

    {modal ? <Dialog title={modal === "dogs" ? "街のわんこたち" : modal === "help" ? "街のくらしかた" : modal === "missions" ? "街のみんなからのお願い" : modal === "grid" ? "建てる場所を選ぼう" : modal === "rename" ? "街の名前" : modal === "share" ? "お友だちを街に招待" : modal === "restore" ? "保存した街を読み込む" : "建物を売る"} onClose={() => setModal(null)}>
      {modal === "dogs" ? <div className={styles.dogList}><p>おうちを建てると、街におともだちが増えるよ。</p>{DOG_NAMES.slice(0, residents(city)).map((name, i) => <div key={name}><span aria-hidden="true">🐾</span><strong>{name}</strong><button type="button" className={styles.secondary} aria-label={`${name}をなでる`} onClick={() => { pet(`dog-${i}`); setModal(null); }}>なでる ♥</button></div>)}</div> : null}
      {modal === "help" ? <div className={styles.helpBody}>
        <p className={styles.helpLead}>わんこと暮らす、小さな島。<br/>白コインで、あなただけの街を。</p>
        <ol><li><strong>建てる</strong><span>下のお店から建物を選び、島の好きな場所をタップ。「建てる」で決定します。</span></li><li><strong>白コインを集める</strong><span>街のお願いを達成したり、お店の売上を受け取ったり。わんこをなでると10枚もらえます（同じわんこは1分に1回）。</span></li><li><strong>街を眺める</strong><span>スワイプやドラッグで回転。ピンチやホイールで拡大。建物をタップすると、移動や強化ができます。</span></li></ol>
        <p className={styles.storageInfo}>街と街づくり用の白コインは、この端末・このアカウントに保存します。ブラウザのデータを消す前や別の端末に移すときは、保存ファイルを使ってね。</p>
        {!shared ? <div className={styles.actions}><button type="button" className={styles.secondary} onClick={exportSave}>街をファイルに保存</button><button type="button" className={styles.secondary} onClick={() => file.current?.click()}>保存ファイルを読む</button></div> : null}
        <button type="button" className={styles.primary} onClick={() => setModal(null)}>街にもどる</button>
      </div> : null}
      {modal === "missions" ? <div className={styles.missions}>{MISSIONS.map((m) => { const claimed = state.claimed.includes(m.id), done = m.progress(state) >= m.target; return <div key={m.id} className={styles.missionCard}><span>✉</span><div><strong>{m.title}</strong><p>{m.detail}</p><progress max={m.target} value={Math.min(m.progress(state), m.target)} aria-label={m.title}/><small>{Math.min(m.progress(state), m.target)} / {m.target}</small></div><button type="button" className={styles.missionReward} disabled={claimed || !done || !!shared} onClick={() => { dispatch({ type: "claim", id: m.id, now: Date.now() }); notify(`白コイン +${m.reward}`); }}>{claimed ? "達成済み" : <><Coin/>+{m.reward}{done ? "受け取る" : ""}</>}</button></div>; })}</div> : null}
      {modal === "grid" && placement ? <div className={styles.gridBody}><p>通り道を残しながら、好きな場所に。</p><div className={styles.grid}>{Array.from({ length: SIZE * SIZE }, (_, i) => { const x = i % SIZE, z = Math.floor(i / SIZE), b = state.buildings.find((b) => b.id !== placement.movingId && b.x === x && b.z === z), invalid = !!placeProblem(state, x, z, placement.movingId); return <button type="button" key={i} aria-label={`${x + 1}列${z + 1}行`} disabled={invalid} aria-pressed={placement.x === x && placement.z === z} onClick={() => { setPlacement({ ...placement, x, z }); setModal(null); }}>{b ? <TownArt kind={b.kind}/> : x === 4 || z === 4 ? "·" : placement.x === x && placement.z === z ? "✓" : ""}</button>; })}</div><small>左上が1列1行。建物と通り道には置けません。</small></div> : null}
      {modal === "rename" ? <form className={styles.form} onSubmit={(event) => { event.preventDefault(); dispatch({ type: "rename", name: draftName, now: Date.now() }); setModal(null); }}><label>街の名前（16文字まで）<input value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={16} autoFocus/></label><button type="submit" className={styles.primary}>この名前にする</button></form> : null}
      {modal === "share" ? <div className={styles.form}><p>このリンクを開くと、今の街の景色を見学できます。お友だちはおでかけへのログインが必要です。</p><label>招待リンク<input readOnly value={shareUrl} onFocus={(event) => event.target.select()} aria-label="街の招待リンク"/></label><button type="button" className={styles.primary} onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); notify("招待リンクをコピーしたよ"); } catch { notify("リンクを選んでコピーしてね"); } }}>リンクをコピー</button></div> : null}
      {modal === "restore" && imported ? <div className={styles.form}><p><strong>{cleanName(imported.name)}</strong><br/>建物 {imported.buildings.length}個 · 白コイン {imported.coins}枚</p><p>現在の街を、この保存ファイルの街に入れ替えます。</p><button type="button" className={styles.secondary} onClick={exportSave}>現在の街を先に保存する</button><button type="button" className={styles.primary} onClick={() => { dispatch({ type: "load", state: { ...imported, updatedAt: Date.now() } }); setPlacement(null); setSelected(null); setModal(null); notify("保存した街に戻ったよ"); }}>この街に入れ替える</button></div> : null}
      {modal === "sell" && building ? <div className={styles.form}><p>{definition(building.kind).name}を売ると、白コイン{sellValue(building)}枚が戻ります。</p><button type="button" className={styles.secondary} onClick={() => setModal(null)}>やめる</button><button type="button" className={styles.primary} onClick={() => { dispatch({ type: "sell", id: building.id, now: Date.now() }); setSelected(null); setModal(null); notify("白コインを受け取ったよ"); }}>売る · {sellValue(building)}枚</button></div> : null}
    </Dialog> : null}
    <input ref={file} type="file" accept="application/json,.json" onChange={importSave} className={styles.hidden} aria-label="街の保存ファイル"/>
  </main>;
}
