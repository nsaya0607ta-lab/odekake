"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { STAGES, findStage } from "@/lib/games/kakure-kanji/data/index";
import type { Difficulty, Stage } from "@/lib/games/kakure-kanji/types";
import { mainAnswers, secretAnswers } from "@/lib/games/kakure-kanji/engine";
import {
  ACHIEVEMENTS,
  clearedStageCount,
  expToNext,
  titleFor,
  type AchievementId,
  type SaveData,
  type Settings,
} from "@/lib/games/kakure-kanji/progress";
import { KanjiStrokes } from "./kanji-strokes";
import { AnswerExplain, PlayScreen } from "./play";
import { playSfx } from "./sound";
import { CoinPill, Segment, Sheet, Stars, useVisualViewport } from "./ui";
import styles from "./kakure-kanji.module.css";
import { useKanjiAccount } from "./use-kanji-account";

type Screen = { name: "home" } | { name: "stages" } | { name: "play"; stageId: string } | { name: "review"; stageId: string; skipped: boolean };
type Overlay = "settings" | "achievements" | "howto" | null;

const DIFFICULTIES: { id: Difficulty; note: string }[] = [
  { id: "初級", note: "2〜3個の漢字を見つける" },
  { id: "中級", note: "4〜6個の漢字を見つける" },
  { id: "上級", note: "7〜10個の漢字を見つける" },
  { id: "超上級", note: "複雑なつくりの漢字" },
  { id: "達人", note: "見つけにくい漢字がまじる" },
];

export function KakureKanjiGame({ userId }: { userId: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useVisualViewport(rootRef);

  const { save, busy, error, act, retry } = useKanjiAccount(userId);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [systemDark, setSystemDark] = useState(false);

  const showToast = useCallback((text: string) => setToast({ text, key: Date.now() + Math.random() }), []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setSystemDark(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3300);
    return () => window.clearTimeout(id);
  }, [toast]);

  const onAchievements = useCallback(
    (ids: AchievementId[]) => {
      const names = ids.map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.name).filter(Boolean);
      if (names.length) showToast(`🏅 実績「${names.join("」「")}」を達成！`);
    },
    [showToast],
  );

  const theme = save ? (save.settings.theme === "system" ? (systemDark ? "dark" : "light") : save.settings.theme) : systemDark ? "dark" : "light";
  const updateSettings = (patch: Partial<Settings>) => {
    if (save) void act({ type: "settings", settings: { ...save.settings, ...patch } });
  };

  const stage = screen.name === "play" || screen.name === "review" ? findStage(screen.stageId) : undefined;

  /** ステージを開く。シークレットまで全部見つけたラウンドは終わっているので、新しく始める */
  const startStage = async (id: string) => {
    if (await act({ type: "start", stageId: id })) setScreen({ name: "play", stageId: id });
  };

  return (
    <div ref={rootRef} className={styles.root} data-theme={theme}>
      <div style={{ display: "contents" }} inert={busy || !!error ? true : undefined}>
      {!save ? (
        <div className={styles.home} aria-busy="true" />
      ) : screen.name === "play" && stage ? (
        <PlayScreen
          key={stage.id}
          stage={stage}
          save={save}
          act={act}
          busy={busy}
          sound={save.settings.sound}
          onExit={() => setScreen({ name: "stages" })}
          onSkip={async () => {
            if (await act({ type: "skip", stageId: stage.id })) setScreen({ name: "review", stageId: stage.id, skipped: true });
          }}
          onReview={() => setScreen({ name: "review", stageId: stage.id, skipped: false })}
          onSettings={() => setOverlay("settings")}
          onAchievements={onAchievements}
        />
      ) : screen.name === "review" && stage ? (
        <ReviewScreen stage={stage} skipped={screen.skipped} onBack={() => setScreen({ name: "stages" })} onPlay={() => startStage(stage.id)} />
      ) : screen.name === "stages" ? (
        <StagesScreen
          save={save}
          onBack={() => setScreen({ name: "home" })}
          onPlay={(id) => {
            playSfx("tap", save.settings.sound);
            startStage(id);
          }}
          onReview={(id) => setScreen({ name: "review", stageId: id, skipped: false })}
        />
      ) : (
        <HomeScreen save={save} onStart={startStage} onStages={() => setScreen({ name: "stages" })} onOverlay={setOverlay} />
      )}

      {overlay === "settings" && save && (
        <Sheet title="設定" onClose={() => setOverlay(null)}>
          <div className={styles.settingRow}>
            <span>効果音</span>
            <Segment label="効果音" value={save.settings.sound ? "on" : "off"} options={[{ value: "on", label: "オン" }, { value: "off", label: "オフ" }]} onChange={(v) => updateSettings({ sound: v === "on" })} />
          </div>
          <div className={styles.settingRow}>
            <span>画面の色</span>
            <Segment
              label="画面の色"
              value={save.settings.theme}
              options={[
                { value: "system", label: "端末に合わせる" },
                { value: "light", label: "明るい" },
                { value: "dark", label: "暗い" },
              ]}
              onChange={(v) => updateSettings({ theme: v })}
            />
          </div>
          <ResetRow
            onReset={async () => {
              if (!await act({ type: "reset" })) return;
              setOverlay(null);
              setScreen({ name: "home" });
              showToast("挑戦中の記録を最初にもどしました");
            }}
          />
          <p className={styles.note}>
            青コインはアプリ共通です。ヒントに使ったり、家具やガチャにも使えます。記録はアカウントに保存されます。効果音はアプリの「タップ音」の音量に合わせています。
          </p>
          <p className={styles.note}>
            ステージ4〜24の筆画：<a href="https://kanjivg.tagaini.net/" target="_blank" rel="noreferrer">KanjiVG</a>
            {" "}（CC BY-SA 3.0）。<a href="/licenses/kakure-kanji/README.txt" target="_blank" rel="noreferrer">出典・変更内容・原図とライセンス</a>
          </p>
        </Sheet>
      )}

      {overlay === "achievements" && save && (
        <Sheet title="実績" onClose={() => setOverlay(null)}>
          {ACHIEVEMENTS.map((a) => {
            const on = save.achievements[a.id] !== undefined;
            const progress = a.id === "clear_10" ? `${Math.min(10, clearedStageCount(save))}/10` : a.id === "clear_100" ? `${Math.min(100, clearedStageCount(save))}/100` : a.id === "streak_3" && !on ? `${Math.min(3, save.clearStreak)}/3` : null;
            return (
              <div key={a.id} className={styles.achievement} data-on={on ? "true" : "false"}>
                <span className={styles.medal} aria-hidden="true">
                  🏅
                </span>
                <span>
                  <b style={{ fontSize: 14 }}>{a.name}</b>
                  <span style={{ display: "block", fontSize: 11, fontWeight: 700 }} className={styles.explainText}>
                    {a.description}
                  </span>
                </span>
                <span style={{ fontSize: 11, fontWeight: 900, textAlign: "right" }}>
                  {on ? "達成" : progress ?? "まだ"}
                  <br />
                  <span style={{ color: "var(--kin)" }}>+{a.coins}枚</span>
                </span>
              </div>
            );
          })}
          {STAGES.length < 100 && <p className={styles.note}>いま遊べるステージは{STAGES.length}個です。{STAGES.length < 10 ? "10・100" : "100"}ステージの実績は、問題が増えると達成できるようになります。</p>}
        </Sheet>
      )}

      {overlay === "howto" && (
        <Sheet title="あそびかた" onClose={() => setOverlay(null)}>
          <HowTo />
        </Sheet>
      )}

      </div>
      {error && <div role="alert" className={styles.accountError}><p>{error}</p><button type="button" className={styles.secondary} onClick={retry}>再試行</button></div>}
      {toast && (
        <p key={toast.key} className={styles.toast} role="status">
          {toast.text}
        </p>
      )}
    </div>
  );
}

function ResetRow({ onReset }: { onReset: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <div className={styles.settingRow}>
      <span>挑戦中の記録を消す</span>
      <button type="button" className={`${styles.secondary} ${styles.danger}`} style={{ height: 36, padding: "0 12px", fontSize: 12 }} onClick={() => (armed ? onReset() : setArmed(true))}>
        {armed ? "本当に消す" : "最初からにする"}
      </button>
      <small>青コイン・クリア・実績は引き継ぎます</small>
    </div>
  );
}

function HomeScreen({
  save,
  onStart,
  onStages,
  onOverlay,
}: {
  save: SaveData;
  onStart: (stageId: string) => void;
  onStages: () => void;
  onOverlay: (overlay: Overlay) => void;
}) {
  const next = STAGES.find((s) => save.rounds[s.id]) ?? STAGES.find((s) => !save.stages[s.id]?.clears) ?? STAGES[0];
  const showcase = STAGES[0];
  return (
    <>
      <header className={styles.topbar}>
        <Link href="/games" className={styles.iconButton} aria-label="ミニゲーム一覧へ戻る">
          ‹
        </Link>
        <div className={styles.stageMeta}>
          <small>GAME 06</small>
          <strong>かくれ漢字</strong>
        </div>
        <CoinPill coins={save.coins} />
        <button type="button" className={styles.iconButton} onClick={() => onOverlay("settings")} aria-label="設定">
          ⚙
        </button>
      </header>
      <main className={styles.home}>
        <div className={styles.column}>
          <section className={styles.hero}>
            <span className={`${styles.heroSeal} ${styles.mincho}`} aria-hidden="true">
              字<br />探
            </span>
            <h1 className={`${styles.logo} ${styles.mincho}`}>かくれ漢字</h1>
            <p className={styles.logoSub}>大きな漢字の中に、べつの漢字がかくれている。</p>
            {showcase && (
              <div className={styles.heroBoard}>
                <KanjiStrokes strokes={showcase.strokes} highlight={[10, 11, 12, 13]} mode="focus" label={`例：「${showcase.kanji}」の中の「心」`} className={styles.kanjiSvg} />
              </div>
            )}
            <p className={styles.note} style={{ marginTop: 4 }}>
              例：「感」の下には「心」がかくれている
            </p>
          </section>

          <section className={styles.profile} aria-label="プレイヤー">
            <span className={styles.levelBadge}>
              <span>
                <small>Lv</small>
                <b>{save.level}</b>
              </span>
            </span>
            <span style={{ minWidth: 0 }}>
              <b style={{ fontSize: 15 }}>{titleFor(save.level)}</b>
              <span style={{ display: "block", fontSize: 11, fontWeight: 800 }} className={styles.explainText}>
                次のレベルまで あと{expToNext(save.level) - save.exp} ・ 累計 {save.totalPoints.toLocaleString("ja-JP")}点
              </span>
              <div className={styles.expTrack}>
                <div className={styles.expFill} style={{ transform: `scaleX(${save.exp / expToNext(save.level)})` }} />
              </div>
            </span>
            <span style={{ fontSize: 11, fontWeight: 900, textAlign: "center" }}>
              クリア
              <br />
              <b style={{ fontSize: 18 }}>{clearedStageCount(save)}</b>
            </span>
          </section>

          {next && (
            <button type="button" className={`${styles.primary} ${styles.bigButton}`} onClick={() => onStart(next.id)}>
              {homeLabel(next, save)}
            </button>
          )}
          <div className={styles.menuGrid}>
            <button type="button" className={styles.menuItem} onClick={onStages}>
              <span aria-hidden="true">📜</span>ステージ
            </button>
            <button type="button" className={styles.menuItem} onClick={() => onOverlay("achievements")}>
              <span aria-hidden="true">🏅</span>実績
            </button>
            <button type="button" className={styles.menuItem} onClick={() => onOverlay("howto")}>
              <span aria-hidden="true">📖</span>あそびかた
            </button>
          </div>
          <p className={styles.note} style={{ textAlign: "center" }}>
            {save.login.streak > 0 ? `ログイン${save.login.streak}日目 ・ ` : ""}毎日はじめて開くと青コインがもらえます
          </p>
        </div>
      </main>
    </>
  );
}

function homeLabel(stage: Stage, save: SaveData): string {
  const round = save.rounds[stage.id];
  if (round?.completedAt != null) return "もう一度あそぶ";
  if (round?.clearedAt != null) {
    const secrets = secretAnswers(stage);
    return `シークレットをさがす（${secrets.filter((a) => round.found.includes(a.char)).length}/${secrets.length}）`;
  }
  if (round) {
    const mains = mainAnswers(stage);
    return `つづきから（${mains.filter((a) => round.found.includes(a.char)).length}/${mains.length}）`;
  }
  return save.stages[stage.id]?.clears ? "もう一度あそぶ" : "あそぶ";
}

function StagesScreen({ save, onBack, onPlay, onReview }: { save: SaveData; onBack: () => void; onPlay: (id: string) => void; onReview: (id: string) => void }) {
  return (
    <>
      <header className={styles.topbar}>
        <button type="button" className={styles.iconButton} onClick={onBack} aria-label="もどる">
          ‹
        </button>
        <div className={styles.stageMeta}>
          <small>STAGES</small>
          <strong>ステージをえらぶ</strong>
        </div>
        <CoinPill coins={save.coins} />
      </header>
      <main className={styles.home}>
        <div className={styles.column}>
          {DIFFICULTIES.map((d) => {
            const list = STAGES.filter((s) => s.difficulty === d.id);
            return (
              <section key={d.id} aria-label={d.id}>
                <h2 className={styles.levelHead}>
                  {d.id} <small>{d.note}</small>
                </h2>
                {list.length === 0 ? (
                  <p className={styles.emptyStage}>準備中（答えを確かめた問題から追加します）</p>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {list.map((stage) => (
                      <StageCard key={stage.id} stage={stage} save={save} onPlay={onPlay} onReview={onReview} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}

function StageCard({ stage, save, onPlay, onReview }: { stage: Stage; save: SaveData; onPlay: (id: string) => void; onReview: (id: string) => void }) {
  const record = save.stages[stage.id];
  const round = save.rounds[stage.id];
  const total = mainAnswers(stage).length;
  const secrets = secretAnswers(stage);
  const secretsEver = record?.secretsFound.length ?? 0;
  return (
    <div className={styles.stageCard}>
      <span className={`${styles.stageThumb} ${styles.mincho}`} aria-hidden="true">
        {stage.kanji}
      </span>
      <span>
        <b style={{ fontSize: 15 }}>
          ステージ{stage.number}「{stage.kanji}」
        </b>
        <span style={{ display: "block", fontSize: 11, fontWeight: 800 }} className={styles.explainText}>
          見つける字 {total}個{record?.bestScore ? ` ・ ベスト${record.bestScore}点` : ""}
          {secrets.length > 0 && (
            <span style={{ display: "block" }}>
              🔒 シークレット {secretsEver}/{secrets.length}（これまで）
            </span>
          )}
        </span>
        <Stars value={record?.bestStars ?? 0} label={`最高 星${record?.bestStars ?? 0}つ`} />
      </span>
      <span style={{ display: "grid", gap: 6 }}>
        <button type="button" className={styles.primary} style={{ height: 40, fontSize: 14, padding: "0 14px" }} onClick={() => onPlay(stage.id)} aria-label={`ステージ${stage.number}「${stage.kanji}」をあそぶ`}>
          {round?.completedAt != null ? "もう一度" : round?.clearedAt != null ? "さがす" : round ? "つづき" : "あそぶ"}
        </button>
        {record?.clears ? (
          <button type="button" className={styles.secondary} style={{ height: 32, fontSize: 11 }} onClick={() => onReview(stage.id)}>
            解説
          </button>
        ) : null}
      </span>
    </div>
  );
}

function ReviewScreen({ stage, skipped, onBack, onPlay }: { stage: Stage; skipped: boolean; onBack: () => void; onPlay: () => void }) {
  const mains = mainAnswers(stage);
  const secrets = secretAnswers(stage);
  return (
    <>
      <header className={styles.topbar}>
        <button type="button" className={styles.iconButton} onClick={onBack} aria-label="ステージ一覧へ">
          ‹
        </button>
        <div className={styles.stageMeta}>
          <small>ステージ {stage.number} の解説</small>
          <strong>「{stage.kanji}」にかくれていた漢字</strong>
        </div>
      </header>
      <main className={styles.home}>
        <div className={styles.column}>
          {skipped && <p className={styles.feedback} data-tone="info">スキップしました。答えを見て、もう一度ためしてみよう。</p>}
          <section className={styles.hero} style={{ textAlign: "left" }}>
            <h2 style={{ fontSize: 15, fontWeight: 900 }}>
              「{stage.kanji}」（{stage.reading}）のつくり
            </h2>
            <p className={styles.explainText}>{stage.structure}</p>
            <h3 className={styles.levelHead} style={{ margin: "14px 0 0" }}>
              見つける字 <small>小学校で習う字（{mains.length}個）</small>
            </h3>
            <div>
              {mains.map((answer) => (
                <AnswerExplain key={answer.char} stage={stage} answer={answer} />
              ))}
            </div>
          </section>
          {secrets.length > 0 && (
            <section className={`${styles.hero} ${styles.secretBox}`} style={{ textAlign: "left", marginTop: 12 }}>
              <h2 className={styles.secretHead}>
                <span>🔒 シークレット</span>
                <small>小学校で習わない、難しい字（{secrets.length}個）</small>
              </h2>
              <div>
                {secrets.map((answer) => (
                  <AnswerExplain key={answer.char} stage={stage} answer={answer} />
                ))}
              </div>
            </section>
          )}
          <section className={styles.hero} style={{ textAlign: "left", marginTop: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 900 }}>おしいけれど答えにならない字</h2>
            {stage.nearMisses.map((n) => (
              <div key={n.char} className={styles.achievement} style={{ gridTemplateColumns: "40px 1fr" }}>
                <span className={`${styles.stageThumb} ${styles.mincho}`} style={{ width: 40, height: 40, fontSize: 24 }} aria-hidden="true">
                  {n.char}
                </span>
                <span>
                  <b style={{ fontSize: 13 }}>
                    {n.char}（{n.reading}）
                  </b>
                  <span className={styles.tag}>{NEAR_LABEL[n.category]}</span>
                  <span className={styles.explainText} style={{ display: "block", marginTop: 2, fontSize: 12 }}>
                    {n.reason}
                  </span>
                </span>
              </div>
            ))}
          </section>
          <button type="button" className={`${styles.primary} ${styles.bigButton}`} onClick={onPlay}>
            もう一度あそぶ
          </button>
          <p className={styles.note}>検証：{stage.verification.note}</p>
        </div>
      </main>
    </>
  );
}

const NEAR_LABEL = { shape: "字形がちがう", position: "位置がちがう", missing: "画が足りない", radical: "部首の形" } as const;

function HowTo() {
  return (
    <div className={styles.explainText} style={{ marginTop: 0, fontSize: 13 }}>
      <p>
        <b>1.</b> まんなかの大きな漢字は、はじめは全部<b>灰色</b>。線をタップすると<b>黒く</b>なります（もう一度タップで灰色にもどる。指をすべらせると、まとめてえらべます）。
      </p>
      <p style={{ marginTop: 8 }}>
        <b>2.</b> 黒くした線が漢字になったと思ったら <b>OK</b>。合っていれば答えの一覧に入ります。<b>小学校で習う字</b>を全部見つけるとクリアです。
      </p>
      <p style={{ marginTop: 8 }}>
        <b>🔒 シークレット</b>：小学校で習わない難しい字は「シークレット」の枠に入っています（いくつあるかは見えます）。クリアには入りませんが、クリアのあともつづけてさがせます。はじめて見つけると青コインがもらえます。
      </p>
      <p style={{ marginTop: 8 }}>
        <b>答えになる取り出し方</b>
        <br />・<b>部品をそのまま</b>：「感」の下の「心」のように、ひとまとまりの部品。
        <br />・<b>線をえらぶ</b>：線を何本かえらんでできる字。線は<b>形も位置もそのまま</b>で、動かしたり曲げたりはしません。
        <br />・<b>見立てる</b>：にた形でもOK。線の<b>長さ・比率・曲がりぐあい・はね</b>はちがっていてよい（例：「感」の左の払いと右の長い線で「八」）。ただし線の本数・向き（↙か↘か）・まがるかどうか・交わる／はなれる・上下左右の位置は同じでないとダメ。
      </p>
      <p style={{ marginTop: 8 }}>
        <b>答えにならないもの</b>
        <br />・全部の線（出題の漢字そのもの）
        <br />・「丶」「丿」のような、部首だけの形
        <br />・線の数が1本でも多い・少ないもの（判定は線の組み合わせがぴったり同じときだけ）
      </p>
      <p style={{ marginTop: 8 }}>
        字の形は日本の常用漢字（新字体）の書き方が基準です。答えは1問ずつ人が確かめたものだけです。
      </p>
      <p style={{ marginTop: 8 }}>
        <b>ヒント</b>は青コインで使えます（読み方・画数・一部を見る・答えを開く）。まちがえても点は減りません。
      </p>
    </div>
  );
}
