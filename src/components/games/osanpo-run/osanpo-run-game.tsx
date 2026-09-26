"use client";

import Link from "next/link";
import { Dela_Gothic_One, M_PLUS_Rounded_1c } from "next/font/google";
import { useEffect, useRef } from "react";
import { setBgmSuppressed } from "@/lib/bgm-engine";
import type { OsanpoRunStageId } from "@/lib/games/osanpo-run/config";
import { createOsanpoRun, type RunItem } from "./engine";

const displayFont = Dela_Gothic_One({ weight: "400", subsets: ["latin"], display: "swap", preload: false, variable: "--font-osr-display" });
const bodyFont = M_PLUS_Rounded_1c({ weight: ["500", "800"], subsets: ["latin"], display: "swap", preload: false, variable: "--font-osr-body" });

type Props = {
  items: RunItem[];
  usesSampleItems: boolean;
  unlockedStages: OsanpoRunStageId[];
  seriesTabs: { id: string; name: string }[];
  categoryLabels: Record<string, string>;
};

/**
 * おさんぽフレンチーの画面。骨組みだけをここで描き、動きは engine.ts に任せる。
 * プレイ中はアプリ全体のBGMを止め、ゲームの曲だけが鳴るようにする。
 */
export function OsanpoRunGame({ items, usesSampleItems, unlockedStages, seriesTabs, categoryLabels }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    setBgmSuppressed(true);
    const destroy = createOsanpoRun(root, {
      items,
      usesSampleItems,
      unlockedStages,
      seriesTabs,
      categoryLabels,
      bodyFontFamily: bodyFont.style.fontFamily,
    });
    return () => {
      destroy();
      setBgmSuppressed(false);
    };
  }, [items, usesSampleItems, unlockedStages, seriesTabs, categoryLabels]);

  return (
    <div ref={rootRef} className={`osr ${displayFont.variable} ${bodyFont.variable}`}>
      <header className="osr-top">
        <Link href="/games" className="osr-back" aria-label="ゲーム一覧へ戻る">‹</Link>
        <div className="osr-title">
          <p>おでかけミニゲーム ・ お試し版</p>
          <h1>おさんぽ<span>フレンチー</span></h1>
        </div>
        <div className="osr-best-chip" aria-live="polite">
          <span data-osr="best-label">じこベスト</span>
          <b data-osr="best-top">0</b>
        </div>
      </header>

      <main className="osr-scroll">
        <div className="osr-wrap">
          <div className="osr-stage" data-osr="stage" tabIndex={0} role="application" aria-label="ゲーム画面。スペースキーかタップでジャンプ、下キーか下スワイプでスライディング">
            <canvas className="osr-canvas" data-osr="canvas" />

            <div className="osr-hud">
              <div className="osr-hud-left" data-osr="hud-left">
                <div className="osr-score" data-osr="score">0</div>
                <div className="osr-meta" data-osr="meta">0m ・ アイテム 0</div>
                <div className="osr-sec-chip" data-osr="sec-chip" hidden />
                <div className="osr-combo" data-osr="combo" data-off="1">
                  <span data-osr="combo-text">×2 コンボ</span>
                  <i data-osr="combo-bar" />
                </div>
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
              <div><b data-osr="rare-tag">SSR</b><span className="osr-rare-name" data-osr="rare-name" /></div>
            </div>
            <div className="osr-hint" data-osr="hint" hidden />
            <div className="osr-ach-toast" data-osr="ach-toast" hidden><i>称号ゲット</i><b data-osr="ach-name" /></div>
            <div className="osr-charm" data-osr="charm" data-off="1"><i>★</i>バリア発動中</div>

            <div className="osr-panel" data-osr="start-panel">
              <h2>どこを散歩する？</h2>
              <div className="osr-stages" data-osr="stage-list" role="radiogroup" aria-label="ステージ" />
              <p className="osr-stage-desc" data-osr="stage-desc" />
              <div className="osr-keys">
                <span><kbd>スペース</kbd><kbd>↑</kbd>かタップでジャンプ（2回で2段）</span>
                <span><kbd>↓</kbd>か下スワイプでスライディング</span>
              </div>
              <button className="osr-btn" data-osr="start" type="button" disabled>準備中…</button>
              <div className="osr-panel-foot">
                <button className="osr-chip-toggle" type="button" data-opt="calm" aria-pressed="true"><span className="osr-dot" aria-hidden="true" />ゆったりモード</button>
                <span className="osr-foot-links">
                  <a className="osr-link-btn" href="#osr-zukan">ずかん</a>
                  <button className="osr-link-btn" type="button" data-open="settings">設定</button>
                </span>
              </div>
              <p className="osr-preview-note">お試し版のため、コインはもらえません。記録はこの端末に保存されます。</p>
            </div>

            <div className="osr-panel osr-wide" data-osr="over-panel" hidden>
              <div className="osr-over-head">
                {/* 犬のポーズはゲーム中にステージのスキンへ差し替えるため、next/image ではなく img を使う */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="osr-dog" data-pose="lie-wave" src="/characters/default/lie-wave.webp" alt="" width={76} height={64} />
                <div className="osr-over-title">
                  <h2 data-osr="over-title">ただいま！</h2>
                  <p data-osr="over-sub" />
                </div>
                <div className="osr-rank" data-osr="rank" role="img" aria-label="ランク">C</div>
              </div>
              <div className="osr-over-cols">
                <div className="osr-over-col">
                  <dl className="osr-stats">
                    <div className="osr-big"><dt>スコア</dt><dd data-osr="o-score">0</dd></div>
                    <div><dt>じこベスト</dt><dd><span data-osr="o-best">0</span><span className="osr-new" data-osr="o-new" hidden>更新</span></dd></div>
                    <div><dt>歩いた距離</dt><dd data-osr="o-dist">0m</dd></div>
                    <div><dt>拾ったアイテム</dt><dd data-osr="o-items">0こ</dd></div>
                    <div><dt>帰宅時刻</dt><dd data-osr="o-clock">17:20</dd></div>
                    <div><dt>最大コンボ</dt><dd data-osr="o-combo">×1</dd></div>
                  </dl>
                  <p className="osr-comment" data-osr="o-comment" />
                </div>
                <div className="osr-over-col">
                  <div className="osr-haul" data-osr="o-haul-wrap">
                    <h3>今回のベストアイテム</h3>
                    <div className="osr-haul-row" data-osr="o-haul" />
                    <p className="osr-breakdown" data-osr="o-break" />
                    <p className="osr-new-line" data-osr="o-new-line" hidden />
                  </div>
                  <div className="osr-haul" data-osr="o-ach-wrap" hidden>
                    <h3>今回ゲットした称号</h3>
                    <div className="osr-ach-row" data-osr="o-ach" />
                  </div>
                  <div className="osr-haul">
                    <h3 data-osr="top-title">この道のベスト5</h3>
                    <ol className="osr-top5" data-osr="top" />
                  </div>
                </div>
              </div>
              <div className="osr-btn-row">
                <button className="osr-btn" data-osr="retry" type="button">もう一回おさんぽ</button>
                <button className="osr-btn osr-ghost" data-osr="stage-btn" type="button">道を変える</button>
                <button className="osr-btn osr-ghost" data-osr="copy" type="button">結果をコピー</button>
              </div>
              <p className="osr-copy-note" data-osr="copy-note" hidden />
            </div>

            <div className="osr-panel" data-osr="pause-panel" hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="osr-dog" data-pose="sleep" src="/characters/default/sleep.webp" alt="" width={96} height={81} />
              <h2>ちょっと休憩</h2>
              <p data-osr="pause-msg">フレンチーはひと休み中。</p>
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
              <button className="osr-btn" data-osr="set-close" type="button">とじる</button>
            </div>
          </div>

          <p className="osr-lede">
            まち・山道・雪国・夏まつりの4つの道を、フレブルと散歩。落ちているのは、あなたが図鑑で持っているアイテムです。季節の道は、ガチャでその季節のフレブルを手に入れると歩けます。
          </p>

          <div className="osr-guide">
            <section>
              <h2>そうさ</h2>
              <ul>
                <li className="osr-ctl"><span><kbd>スペース</kbd></span><div><b>ジャンプ</b><small>タップ・クリック・<kbd>↑</kbd><kbd>W</kbd>でもOK。長押しで高く、ちょんと押すと低く跳ぶ。</small></div></li>
                <li className="osr-ctl"><span><kbd>↓</kbd></span><div><b>スライディング</b><small>下スワイプでもOK。のれん・低い枝・つららや、低く飛ぶカラスの下をくぐれる。空中で押すと急降下。</small></div></li>
                <li className="osr-ctl"><span><kbd>2回</kbd></span><div><b>2段ジャンプ</b><small>空中でもう一回。高いところのアイテムも取れる。</small></div></li>
                <li className="osr-ctl"><span><kbd>イベント</kbd></span><div><b>ボーナス・ラッシュ・雨</b><small>ときどきアイテムだらけのボーナスタイム、障害物が続くラッシュ（突破で+100）、雨や雪が来る。</small></div></li>
                <li className="osr-ctl"><span><kbd>P</kbd></span><div><b>一時停止</b><small>右上のボタンでもOK。「最初から」「道を選ぶ」「設定」もここから。</small></div></li>
              </ul>
            </section>
            <section>
              <h2>ひろうもの ・ あなたの図鑑アイテム</h2>
              <ul className="osr-rarity-list" data-osr="rarity-list" />
            </section>
            <section>
              <h2>よけるもの</h2>
              <ul>
                <li className="osr-note-li"><small>道ごとに見た目が変わります（例：山道では岩・倒木・道標、雪国では雪だるま・ソリ・つらら）。</small></li>
                <li><canvas data-icon="cone" /><div><b>コーン・水たまり</b><small>ちょんと跳べば越えられる。</small></div></li>
                <li><canvas data-icon="bike" /><div><b>ママチャリ</b><small>横に長いので、しっかり長押しで。</small></div></li>
                <li><canvas data-icon="crow" /><div><b>カラス</b><small>跳ぶとぶつかる。走ったまま下をくぐると+5。</small></div></li>
                <li><canvas data-icon="cat" /><div><b>ねこ</b><small>こっちに歩いてくるので、いつもより早めに跳ぶ。</small></div></li>
                <li><canvas data-icon="sign" /><div><b>工事中の看板</b><small>背が高い。しっかり長押しで。</small></div></li>
                <li><canvas data-icon="noren" /><div><b>のれん</b><small>上から垂れているので跳び越えられない。スライディングでくぐると+15。</small></div></li>
                <li><canvas data-icon="pigeons" /><div><b>ハト</b><small>小さくジャンプで越えると飛び立って+10。</small></div></li>
              </ul>
            </section>
          </div>

          <section className="osr-sec" id="osr-zukan" aria-labelledby="osr-zukan-title">
            <h2 id="osr-zukan-title">ずかん <span data-osr="zk-count">0 / 0</span></h2>
            <p className="osr-zk-rar" data-osr="zk-rar" />
            <div className="osr-zk-tabs" data-osr="zk-tabs" role="tablist" aria-label="シリーズ" />
            <div className="osr-zk-body">
              <ul className="osr-zk-grid" data-osr="zk-grid" />
              <div className="osr-zk-detail" data-osr="zk-detail" aria-live="polite" />
            </div>
          </section>

          <section className="osr-sec">
            <h2>称号 <span data-osr="ach-count">0 / 0</span></h2>
            <p className="osr-life-stats" data-osr="life-stats" />
            <ul className="osr-ach-list" data-osr="ach-list" />
          </section>

          <p className="osr-foot">記録（ベストスコア・称号・ずかん）はこの端末にだけ保存されます。</p>
        </div>
      </main>
    </div>
  );
}
