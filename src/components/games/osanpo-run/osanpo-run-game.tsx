"use client";

import Link from "next/link";
import { Dela_Gothic_One, M_PLUS_Rounded_1c } from "next/font/google";
import { useEffect, useRef } from "react";
import { setBgmSuppressed } from "@/lib/bgm-engine";
import type { OsanpoRunStageId } from "@/lib/games/osanpo-run/config";
import type { OsanpoRunFriendMemory, OsanpoRunMemoryPhoto, OsanpoRunOdekake } from "@/lib/data/osanpo-run";
import type { OsanpoRunMission } from "@/lib/games/osanpo-run/missions";
import { SKILL_KIND_COLORS, SKILL_KIND_LABELS, type SkillKind } from "@/lib/games/osanpo-run/skills";
import { createOsanpoRun, type OsanpoRunLiveWeather, type OsanpoRunResult, type RunItem } from "./engine";
import { placeLabel, readSavedPlace, WEATHER_CACHE_KEY, WEATHER_CACHE_MS } from "@/lib/home-weather";
import { parseRoomWeather } from "@/lib/room/weather";
import { OsanpoRunCoop } from "./osanpo-run-coop";
import { OSANPO_RUN_RANKING_REFRESH_EVENT, OsanpoRunRanking } from "./osanpo-run-ranking";

const displayFont = Dela_Gothic_One({ weight: "400", subsets: ["latin"], display: "swap", preload: false, variable: "--font-osr-display" });
const bodyFont = M_PLUS_Rounded_1c({ weight: ["500", "800"], subsets: ["latin"], display: "swap", preload: false, variable: "--font-osr-body" });

type Props = {
  items: RunItem[];
  usesSampleItems: boolean;
  unlockedStages: OsanpoRunStageId[];
  seriesTabs: { id: string; name: string }[];
  categoryLabels: Record<string, string>;
  /** アプリに同期した今日の歩数（未同期は null）。歩数ブーストに使う */
  todaySteps: number | null;
  /** 今日のミッション3つと、今日もう達成したもののID */
  missions: OsanpoRunMission[];
  missionsDone: string[];
  /** 飛行機が空を運んでくる自分のおでかけ写真 */
  memoryPhotos: OsanpoRunMemoryPhoto[];
  /** 今日の記録（おでかけボーナス）と、よく行く場所（道の景色） */
  odekake: OsanpoRunOdekake;
  /** 気球が空を運んでくるフレンドのSNS投稿の写真 */
  friendMemories: OsanpoRunFriendMemory[];
};

/** 1回の結果をサーバーへ送り、スコアを記録してコインを受け取る。記録できなかったときは null */
async function submitResult(result: OsanpoRunResult): Promise<number | null> {
  try {
    const response = await fetch("/api/games/osanpo-run/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as { ready?: boolean; coins?: number } | null;
    window.dispatchEvent(new Event(OSANPO_RUN_RANKING_REFRESH_EVENT));
    if (payload?.ready === false) return null;
    return typeof payload?.coins === "number" ? payload.coins : null;
  } catch {
    return null;
  }
}

/** 達成したミッションをサーバーへ送り、コインを受け取る。記録できなかったときは null */
async function submitMission(missionId: string): Promise<number | null> {
  try {
    const response = await fetch("/api/games/osanpo-run/mission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ missionId }),
    });
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as { ready?: boolean; coins?: number } | null;
    if (payload?.ready === false) return null;
    return typeof payload?.coins === "number" ? payload.coins : null;
  } catch {
    return null;
  }
}

/** フレンドの投稿にいいねする（外す）。できたら true */
async function likeFriendPost(postId: string, liked: boolean): Promise<boolean> {
  try {
    const response = await fetch("/api/games/osanpo-run/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, liked }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** 結果カードの画像と本文をSNS（フレンドへの投稿）に載せる */
async function shareResult(image: Blob, body: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const form = new FormData();
    form.append("image", image, "osanpo-run.jpg");
    form.append("body", body);
    const response = await fetch("/api/games/osanpo-run/share", { method: "POST", body: form });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) return { ok: false, error: payload?.error ?? "投稿できませんでした。" };
    return { ok: true };
  } catch {
    return { ok: false, error: "通信できず、投稿できませんでした。" };
  }
}

/**
 * いまの本当の天気（ホーム・マイルームと同じ場所・同じ Open-Meteo）。10分はこの端末に覚えておいた答えを使う。
 * 取れないときは null のまま（ゲームはこれまでどおり、ときどき雨・雪国は雪になる）
 */
function loadLiveWeather(onLoad: (weather: OsanpoRunLiveWeather) => void): void {
  const place = readSavedPlace();
  const lat = place.lat.toFixed(2), lon = place.lon.toFixed(2), label = placeLabel(place);
  try {
    const cached = JSON.parse(window.sessionStorage.getItem(WEATHER_CACHE_KEY) ?? "null") as { lat: string; lon: string; t: number; raw: unknown } | null;
    if (cached && cached.lat === lat && cached.lon === lon && Date.now() - cached.t < WEATHER_CACHE_MS) {
      const parsed = parseRoomWeather(cached.raw);
      if (parsed) { onLoad({ kind: parsed.kind, place: label }); return; }
    }
  } catch {
    // 覚えていなければ問い合わせる
  }
  fetch(`/api/my-room/weather?lat=${lat}&lon=${lon}`)
    .then((response) => (response.ok ? response.json() : null))
    .then((raw: unknown) => {
      const parsed = parseRoomWeather(raw);
      if (!parsed) return;
      onLoad({ kind: parsed.kind, place: label });
      try { window.sessionStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ lat, lon, t: Date.now(), raw })); } catch { /* 覚えられなくても遊べる */ }
    })
    .catch(() => { /* 取れなければ、これまでどおりの天気 */ });
}

/**
 * おさんぽフレンチーの画面。骨組みだけをここで描き、動きは engine.ts に任せる。
 * プレイ中はアプリ全体のBGMを止め、ゲームの曲だけが鳴るようにする。
 */
export function OsanpoRunGame({ items, usesSampleItems, unlockedStages, seriesTabs, categoryLabels, todaySteps, missions, missionsDone, memoryPhotos, odekake, friendMemories }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    setBgmSuppressed(true);
    // 時間と天気は本当の空に合わせる。天気は届いたときから反映し、10分ごとに見なおす
    let liveWeather: OsanpoRunLiveWeather | null = null;
    let alive = true;
    const refreshWeather = () => loadLiveWeather((w) => { if (alive) liveWeather = w; });
    refreshWeather();
    const weatherTimer = window.setInterval(refreshWeather, WEATHER_CACHE_MS);
    const destroy = createOsanpoRun(root, {
      items,
      usesSampleItems,
      unlockedStages,
      seriesTabs,
      categoryLabels,
      todaySteps,
      missions,
      missionsDone,
      onMissionClear: submitMission,
      memoryPhotos,
      odekake,
      friendMemories,
      onLike: likeFriendPost,
      onShare: shareResult,
      bodyFontFamily: bodyFont.style.fontFamily,
      onRunEnd: submitResult,
      liveWeather: () => liveWeather,
    });
    return () => {
      alive = false;
      window.clearInterval(weatherTimer);
      destroy();
      setBgmSuppressed(false);
    };
  }, [items, usesSampleItems, unlockedStages, seriesTabs, categoryLabels, todaySteps, missions, missionsDone, memoryPhotos, odekake, friendMemories]);

  return (
    <div ref={rootRef} className={`osr ${displayFont.variable} ${bodyFont.variable}`}>
      <header className="osr-top">
        <Link href="/games" className="osr-back" aria-label="ゲーム一覧へ戻る">‹</Link>
        <div className="osr-title">
          <p>おでかけミニゲーム</p>
          <h1>おさんぽ<span>フレンチー</span></h1>
        </div>
        <div className="osr-best-chip" aria-live="polite">
          <span data-osr="best-label">じこベスト</span>
          <b data-osr="best-top">0</b>
        </div>
      </header>

      <main className="osr-scroll">
        <div className="osr-wrap">
          <div className="osr-stage" data-osr="stage" tabIndex={0} role="application" aria-label="ゲーム画面。タップでジャンプ、下スワイプでスライディング">
            <canvas className="osr-canvas" data-osr="canvas" />

            <div className="osr-hud">
              <div className="osr-hud-left" data-osr="hud-left">
                <div className="osr-score" data-osr="score">0</div>
                <div className="osr-meta" data-osr="meta">0m・ほね0・アイテム0</div>
                <div className="osr-sec-chip" data-osr="sec-chip" hidden />
                <div className="osr-sec-chip" data-osr="route-chip" hidden />
                <div className="osr-combo" data-osr="combo" data-off="1">
                  <span data-osr="combo-text">×2 コンボ</span>
                  <i data-osr="combo-bar" />
                </div>
                <div className="osr-skills" data-osr="skills" aria-label="発動中のスキル" hidden />
              </div>
              <div className="osr-hud-right">
                <div className="osr-clock"><b data-osr="clock">17:20</b><span data-osr="phase">夕方</span></div>
                <button className="osr-icon-btn" data-osr="pause-btn" type="button" aria-label="一時停止" hidden>
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>
                </button>
                <button className="osr-icon-btn" data-osr="gear" data-open="settings" type="button" aria-label="設定">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="17" r="2" /></svg>
                </button>
                <button className="osr-icon-btn" data-osr="mute" type="button" aria-label="音を消す">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 9h4l5-4v14l-5-4H4z" />
                    <path data-osr="mute-waves" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
                    <path data-osr="mute-x" d="M17 9l5 6M22 9l-5 6" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="osr-rare" data-osr="rare" hidden>
              <span className="osr-rare-icon" data-osr="rare-icon" />
              <div>
                <b data-osr="rare-tag">SSR</b><span className="osr-rare-name" data-osr="rare-name" />
                <span className="osr-rare-skill" data-osr="rare-skill" hidden>
                  <span data-osr="rare-skill-name" /><small data-osr="rare-skill-desc" />
                </span>
              </div>
            </div>
            <div className="osr-hint" data-osr="hint" hidden />
            <div className="osr-ach-toast" data-osr="ach-toast" hidden><i>称号ゲット</i><b data-osr="ach-name" /></div>
            <div className="osr-charm" data-osr="charm" data-off="1"><i>★</i>守り：<span data-osr="charm-text">バリア</span></div>

            <div className="osr-panel" data-osr="start-panel">
              <h2>どこを散歩する？</h2>
              <div className="osr-stages" data-osr="stage-list" role="radiogroup" aria-label="ステージ" />
              <p className="osr-stage-desc" data-osr="stage-desc" />
              <p className="osr-live-sky" data-osr="live-sky" />
              <div className="osr-step-boost" data-osr="step-boost" />
              <div className="osr-odekake" data-osr="odekake" />
              <div className="osr-missions" data-osr="missions" hidden />
              <div className="osr-keys">
                <span><kbd>タップ</kbd>でジャンプ（空中であと2回・3段まで）</span>
                <span><kbd>下スワイプ</kbd>でスライディング</span>
              </div>
              <button className="osr-btn" data-osr="start" type="button" disabled>準備中…</button>
              <nav className="osr-menu" aria-label="メニュー">
                <button type="button" data-sheet="rules">ルール</button>
                <button type="button" data-sheet="zukan">ずかん</button>
                <button type="button" data-sheet="ach">称号</button>
                <button type="button" data-sheet="records">記録</button>
                <button type="button" data-sheet="friends">フレンド</button>
              </nav>
              <div className="osr-panel-foot">
                <button className="osr-chip-toggle" type="button" data-opt="calm" aria-pressed="false"><span className="osr-dot" aria-hidden="true" />ゆったりモード</button>
                <button className="osr-link-btn" type="button" data-open="settings">設定</button>
              </div>
              <p className="osr-preview-note">スコア50点ごとに青コイン1枚（切り上げ）。青コインで、わんこのおへやの家具が買えます。フレンドとスコアを競えます。</p>
            </div>

            <div className="osr-panel" data-osr="over-panel" hidden>
              <div className="osr-over-head">
                <div className="osr-over-title">
                  <h2 data-osr="over-title">ただいま！</h2>
                  <p data-osr="over-sub" />
                </div>
                <div className="osr-rank" data-osr="rank" role="img" aria-label="ランク">C</div>
              </div>
              <div className="osr-result">
                <div>
                  <span className="osr-result-label">スコア</span>
                  <b className="osr-result-score" data-osr="o-score">0</b>
                </div>
                <div className="osr-result-best">
                  <span className="osr-result-label">じこベスト<span className="osr-new" data-osr="o-new" hidden>更新</span></span>
                  <b data-osr="o-best">0</b>
                </div>
              </div>
              <dl className="osr-result-stats" data-osr="o-line" />
              <div className="osr-haul" data-osr="o-haul-wrap">
                <div className="osr-haul-row" data-osr="o-haul" />
                <p className="osr-new-line" data-osr="o-new-line" hidden />
              </div>
              <p className="osr-odekake-line" data-osr="o-odekake" hidden />
              <div className="osr-memo" data-osr="o-memo" hidden>
                <p className="osr-memo-title">今日運ばれてきた思い出<small>タップで大きく見る</small></p>
                <div className="osr-memo-list" data-osr="o-memo-list" />
              </div>
              <div className="osr-memo osr-fmemo" data-osr="o-fmemo" hidden>
                <p className="osr-memo-title">フレンドの思い出<small>タップで大きく見る</small></p>
                <div className="osr-memo-list" data-osr="o-fmemo-list" />
              </div>
              <p className="osr-coin-line" data-osr="o-coins" hidden />
              <p className="osr-mission-line" data-osr="o-missions" hidden />
              <div className="osr-ach-row" data-osr="o-ach" hidden />
              <div className="osr-btn-row">
                <button className="osr-btn" data-osr="retry" type="button">もう一回おさんぽ</button>
                <button className="osr-btn osr-ghost" data-osr="stage-btn" type="button">道を変える</button>
              </div>
              <nav className="osr-menu osr-menu-small" aria-label="メニュー">
                <button type="button" data-sheet="friends">フレンド</button>
                <button type="button" data-sheet="records">記録</button>
                <button type="button" data-sheet="zukan">ずかん</button>
                <button type="button" data-sheet="ach">称号</button>
                <button type="button" data-osr="copy">コピー</button>
              </nav>
              <button className="osr-btn osr-share-btn" data-osr="share" type="button" hidden>結果をSNSに投稿</button>
              <div className="osr-share" data-osr="share-box" hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img data-osr="share-img" alt="投稿する結果カード" width={1080} height={1080} />
                <textarea data-osr="share-body" maxLength={280} rows={3} aria-label="投稿する文" />
                <p className="osr-share-msg" data-osr="share-msg" aria-live="polite" />
                <div className="osr-btn-row">
                  <button className="osr-btn" data-osr="share-send" type="button">投稿する</button>
                  <button className="osr-btn osr-ghost" data-osr="share-cancel" type="button">やめる</button>
                </div>
              </div>
              <p className="osr-copy-note" data-osr="copy-note" hidden />
            </div>

            <div className="osr-lightbox" data-osr="lightbox" role="dialog" aria-modal="true" aria-labelledby="osr-lb-title" hidden>
              <div className="osr-lightbox-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img data-osr="lb-img" alt="" />
                <b id="osr-lb-title" data-osr="lb-title" />
                <small data-osr="lb-sub" />
                <p data-osr="lb-text" />
                <div className="osr-lightbox-actions" data-osr="lb-actions" />
                <button className="osr-btn osr-ghost" data-osr="lb-close" type="button">とじる</button>
              </div>
            </div>

            <div className="osr-panel" data-osr="pause-panel" hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="osr-dog" data-pose="sleep" src="/characters/default/sleep.webp" alt="" width={96} height={81} />
              <h2>ちょっと休憩</h2>
              <p data-osr="pause-msg">フレンチーはひと休み中。</p>
              <div className="osr-pause-skills" data-osr="pause-skills" hidden />
              <button className="osr-btn" data-osr="resume" type="button">つづける</button>
              <div className="osr-btn-row">
                <button className="osr-btn osr-ghost" data-osr="restart" type="button">最初から</button>
                <button className="osr-btn osr-ghost" data-osr="quit" type="button">道を選ぶ</button>
                <button className="osr-btn osr-ghost" type="button" data-open="settings">設定</button>
              </div>
            </div>

            <div className="osr-panel" data-osr="settings-panel" hidden>
              <h2>設定</h2>
              <div className="osr-set-list" data-osr="set-list" />
              <section className="osr-nbr" aria-label="ご近所さん">
                <h3>ご近所さんの名前</h3>
                <p>道で会うフレブルに名前をつけられます。あいさつするほど、なかよしになります。</p>
                <ul className="osr-nbr-list" data-osr="nb-list" />
              </section>
              <button className="osr-btn" data-osr="set-close" type="button">とじる</button>
            </div>
          </div>

            <section className="osr-sheet" data-osr="sheet-rules" hidden aria-label="ルール">
              <header className="osr-sheet-head"><button type="button" className="osr-sheet-back" data-close-sheet>‹ もどる</button><h2>ルール</h2></header>
              <div className="osr-sheet-body">
                <p className="osr-lede">
                  まち・山道・雪国・夏まつりの4つの道を、フレブルと散歩。道にはほねが落ちていて、ときどきあなたが図鑑で持っているアイテムが混ざります。アイテムを拾うと、そのアイテムのスキルが発動します。スコアは、歩いた距離1mごとに10点と、拾ったものの点の合計。季節の道は、ガチャでその季節のフレブルを手に入れると歩けます。
                </p>
                <div className="osr-guide">
                  <section>
                    <h3>そうさ</h3>
                    <ul>
                      <li className="osr-ctl"><span><kbd>タップ</kbd></span><div><b>ジャンプ</b><small>長押しで高く、ちょんとタップすると低く跳ぶ。空中でタップすると2段・3段ジャンプ。</small></div></li>
                      <li className="osr-ctl"><span><kbd>スワイプ</kbd></span><div><b>スライディング</b><small>のれん・低い枝・つららや、低く飛ぶカラスの下をくぐれる。空中で下スワイプすると急降下。</small></div></li>
                      <li className="osr-ctl"><span><kbd>スキル</kbd></span><div><b>アイテムのスキル</b><small>アイテムを拾うと、そのアイテムのスキルが発動（全アイテムに1つずつ）。図鑑のスキルLvが高いほど強い。身代わり・バリア・復活の「守り」は1回ぶんまで（強さは 復活 ＞ バリア・身代わり。今より弱い守りは付かない）。効果は「ずかん」でアイテムを選ぶと見られる。</small></div></li>
                      <li className="osr-ctl"><span><kbd>オーラ</kbd></span><div><b>スキルのオーラ</b><small>道に落ちているアイテムが、拾うと発動するスキルの分類の色のオーラをまとう。</small>
                        <ul className="osr-aura-legend">
                          {(Object.keys(SKILL_KIND_LABELS) as SkillKind[]).map((k) => (
                            <li key={k}><i style={{ background: SKILL_KIND_COLORS[k], boxShadow: `0 0 8px ${SKILL_KIND_COLORS[k]}` }} />{SKILL_KIND_LABELS[k]}</li>
                          ))}
                        </ul>
                      </div></li>
                      <li className="osr-ctl"><span><kbd>イベント</kbd></span><div><b>ボーナス・ラッシュ・雨</b><small>ときどきアイテムだらけのボーナスタイム、障害物が続くラッシュ（突破で+100）、雨や雪が来る。</small></div></li>
                      <li className="osr-ctl"><span><kbd>分かれ道</kbd></span><div><b>分かれ道</b><small>ときどき道しるべが出る。跳んで通ると上の道（公園など：障害物が少なく、ほねとアイテムが多い）、そのまま通ると下の道（商店街など：障害物が多いけど、SR以上が出やすい）。20秒で合流。</small></div></li>
                      <li className="osr-ctl"><span><kbd>歩数</kbd></span><div><b>歩数ブースト</b><small>アプリに同期した今日の歩数で、スタート時に効果が付く。3000歩〜 最初の10秒スコア×1.2、6000歩〜 バリア、10000歩〜 ボーナスタイムからスタート。</small></div></li>
                      <li className="osr-ctl"><span><kbd>お題</kbd></span><div><b>今日のミッション</b><small>毎日3つのお題。1つ達成で青コイン30枚、3つそろうとさらに100枚。</small></div></li>
                      <li className="osr-ctl"><span><kbd>くんくん</kbd></span><div><b>においかぎ</b><small>地面に「くんくん」マークが出たら、スライディングで通ると掘り出せる。ほね・アイテム・ときどきハズレ（古いくつした）。</small></div></li>
                      <li className="osr-ctl"><span><kbd>協力</kbd></span><div><b>協力チャレンジ</b><small>自分とフレンドの今週の合計距離で目標を目指す。達成したら「フレンド」画面で全員、青コイン100枚を受け取れる。</small></div></li>
                      <li className="osr-ctl"><span><kbd>写真</kbd></span><div><b>思い出の写真</b><small>おでかけ記録に登録した写真を、飛行機がぶら下げて空を運んでくる。真上を通ると+20。写真が空を流れているあいだは障害物が出ない。運ばれてきた写真は結果画面に並び、タップで大きく見られる（訪れた日とひとことも出る）。</small></div></li>
                      <li className="osr-ctl"><span><kbd>気球</kbd></span><div><b>フレンドの思い出</b><small>フレンドがSNSに投稿した写真を、気球が運んでくる。真上を通ると+20。結果画面で大きく見たり、そのままいいねできる。</small></div></li>
                      <li className="osr-ctl"><span><kbd>記録</kbd></span><div><b>おでかけボーナス</b><small>今日のおでかけを記録していると、その日のおさんぽはスコアがぜんぶ1.2倍（青コインも増える）。</small></div></li>
                      <li className="osr-ctl"><span><kbd>景色</kbd></span><div><b>よく行く場所の景色</b><small>最近の記録で多いカテゴリに合わせて、道ぞいに木（公園・自然）や鳥居（神社・お寺）、行ったお店の名前の看板が立つ。</small></div></li>
                      <li className="osr-ctl"><span><kbd>投稿</kbd></span><div><b>結果をSNSに投稿</b><small>おさんぽが終わったら、スコアと思い出の写真入りの結果カードをSNSに投稿できる。</small></div></li>
                      <li className="osr-ctl"><span><kbd>II</kbd></span><div><b>一時停止</b><small>右上のボタン。「最初から」「道を選ぶ」「設定」もここから。</small></div></li>
                    </ul>
                  </section>
                  <section>
                    <h3>ひろうもの ・ あなたの図鑑アイテム</h3>
                    <ul className="osr-rarity-list" data-osr="rarity-list" />
                  </section>
                  <section>
                    <h3>よけるもの</h3>
                    <ul>
                      <li className="osr-note-li"><small>道ごとに見た目が変わります（例：山道では岩・倒木・道標、雪国では雪だるま・ソリ・つらら）。</small></li>
                      <li><canvas data-icon="cone" /><div><b>コーン・水たまり</b><small>ちょんと跳べば越えられる。水たまりは、空中から下スワイプの急降下で踏むと「バシャーン！」で+30（歩いて入るとアウト）。</small></div></li>
                      <li><canvas data-icon="bike" /><div><b>ママチャリ</b><small>横に長いので、しっかり長押しで。</small></div></li>
                      <li><canvas data-icon="crow" /><div><b>カラス</b><small>跳ぶとぶつかる。走ったまま下をくぐると+5。</small></div></li>
                      <li><canvas data-icon="cat" /><div><b>ねこ</b><small>こっちに歩いてくるので、いつもより早めに跳ぶ。</small></div></li>
                      <li><canvas data-icon="sign" /><div><b>工事中の看板</b><small>背が高い。しっかり長押しで。</small></div></li>
                      <li><canvas data-icon="noren" /><div><b>のれん</b><small>上から垂れているので跳び越えられない。スライディングでくぐると+15。</small></div></li>
                      <li><canvas data-icon="pigeons" /><div><b>ハト</b><small>小さくジャンプで越えると飛び立って+10。</small></div></li>
                      <li><canvas data-icon="roller" /><div><b>お掃除ロボ</b><small>こっちに転がってくる。早めに跳ぶ。山道ではウリ坊、雪国では雪玉、夏まつりではビーチボール。</small></div></li>
                      <li><canvas data-icon="drop" /><div><b>植木鉢</b><small>地面に影が出たら、上から落ちてくる。跳んでいるときに当たらないように。落ちたあとは小さく跳べば越えられる。</small></div></li>
                      <li><canvas data-icon="geyser" /><div><b>スプリンクラー</b><small>水が出たり止まったりする。止まった瞬間に通るか、長押しジャンプで越える。</small></div></li>
                      <li><canvas data-icon="suitcase" /><div><b>大脱走スーツケース</b><small>22秒から登場。荷物が跳ねながら転がってくる！ 低いときは跳び越え、高く浮いたら下を通る。接触せずに回避で+20、下を通ればさらに+15。</small></div></li>
                      <li><canvas data-icon="surprise" /><div><b>びっくり宅配便</b><small>36秒から登場。箱がガタガタ揺れたあと、バネのカエルがびよーん！ 少しすると箱に戻る。長押しで高くジャンプして越える。接触せずに回避で+30。</small></div></li>
                      <li><canvas data-icon="drone" /><div><b>せっかち配達ドローン</b><small>48秒から登場。黄色の警告ランプのあと、荷物ごと降下してくる。下スワイプでスライディング！ 接触せずに回避で+25、滑ってくぐるとさらに+15。</small></div></li>
                      <li><canvas data-icon="buddy" /><div><b>ほかのフレブル</b><small>図鑑のフレブル（いつもの・登山・雪国・夏）がお散歩している。ぶつかってもだいじょうぶ。くんくんごあいさつで+30〜60（少しだけ立ち止まる）。4匹には設定で名前をつけられて、あいさつするほどなかよしに（5回・15回・30回）。なかよしになると、ほねやおみやげのアイテムをくれる。</small></div></li>
                    </ul>
                  </section>
                </div>
              </div>
            </section>

            <section className="osr-sheet" data-osr="sheet-zukan" hidden aria-label="ずかん">
              <header className="osr-sheet-head"><button type="button" className="osr-sheet-back" data-close-sheet>‹ もどる</button><h2>ずかん <span data-osr="zk-count">0 / 0</span></h2></header>
              <div className="osr-sheet-body">
                <p className="osr-zk-rar" data-osr="zk-rar" />
                <div className="osr-zk-tabs" data-osr="zk-tabs" role="tablist" aria-label="シリーズ" />
                <div className="osr-zk-kinds" data-osr="zk-kinds" role="group" aria-label="スキルの種類で絞り込む" />
                <div className="osr-zk-body">
                  <div className="osr-zk-detail" data-osr="zk-detail" aria-live="polite" />
                  <ul className="osr-zk-grid" data-osr="zk-grid" />
                </div>
              </div>
            </section>

            <section className="osr-sheet" data-osr="sheet-ach" hidden aria-label="称号">
              <header className="osr-sheet-head"><button type="button" className="osr-sheet-back" data-close-sheet>‹ もどる</button><h2>称号 <span data-osr="ach-count">0 / 0</span></h2></header>
              <div className="osr-sheet-body">
                <ul className="osr-ach-list" data-osr="ach-list" />
              </div>
            </section>

            <section className="osr-sheet" data-osr="sheet-friends" hidden aria-label="フレンド">
              <header className="osr-sheet-head"><button type="button" className="osr-sheet-back" data-close-sheet>‹ もどる</button><h2>フレンド</h2></header>
              <div className="osr-sheet-body">
                <OsanpoRunCoop />
                <OsanpoRunRanking />
              </div>
            </section>

            <section className="osr-sheet" data-osr="sheet-records" hidden aria-label="記録">
              <header className="osr-sheet-head"><button type="button" className="osr-sheet-back" data-close-sheet>‹ もどる</button><h2>記録</h2></header>
              <div className="osr-sheet-body">
                <p className="osr-life-stats" data-osr="life-stats" />
                <div className="osr-rec-grid" data-osr="rec-list" />
                <p className="osr-foot">この画面の記録・称号・ずかんはこの端末に保存されます。フレンドと競うスコアは「フレンド」画面で見られます。</p>
              </div>
            </section>
        </div>
      </main>
    </div>
  );
}
