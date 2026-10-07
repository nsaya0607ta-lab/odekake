"use client";

/**
 * アプリ「インフラ」のいちばん外側。
 * - トップ：タブ「ステージ」（路線図）・「ずかん」・「ラボ」
 * - ?stage=s3 … ステージを遊ぶ（ブラウザの「戻る」で一覧へ）
 * - ?view=backstage … おまけ「このアプリの裏側」
 */
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Backstage } from "./backstage";
import { Glyph } from "./glyphs";
import { TERMS, type Term } from "./glossary";
import { MASCOT } from "./intro";
import { Lab } from "./lab";
import { PARTS } from "./model";
import { emptyProgress, isCleared, isUnlocked, loadProgress, saveProgress, totalStars, unlockedParts, unlockedTerms, type Progress } from "./progress";
import { BottomSheet } from "./sheets";
import { setSoundEnabled } from "./sound";
import { STAGES, stageById, type StageDef } from "./stages";
import { SoundButton, StagePlay } from "./stage-play";
import styles from "./infra.module.css";

type Tab = "stages" | "glossary" | "lab";
const TABS: { id: Tab; label: string }[] = [
  { id: "stages", label: "ステージ" },
  { id: "glossary", label: "ずかん" },
  { id: "lab", label: "ラボ" },
];

/** おまけ「このアプリの裏側」が開くステージ（CDN まで習ったら） */
const BACKSTAGE_AFTER = "s6";

export function InfraApp() {
  const params = useSearchParams();
  const pathname = usePathname();
  const stageId = params.get("stage");
  const view = params.get("view");
  const tabParam = params.get("tab");
  const tab: Tab = tabParam === "glossary" || tabParam === "lab" ? tabParam : "stages";
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [loaded, setLoaded] = useState(false);
  const pushed = useRef(false);

  useEffect(() => {
    setProgress(loadProgress());
    setLoaded(true);
  }, []);
  useEffect(() => setSoundEnabled(progress.sound), [progress.sound]);

  const update = useCallback((fn: (p: Progress) => Progress) => {
    setProgress((cur) => {
      const next = fn(cur);
      saveProgress(next);
      return next;
    });
  }, []);

  const go = useCallback((query: string, push: boolean) => {
    const url = query ? `${pathname}?${query}` : pathname;
    if (push) {
      window.history.pushState(null, "", url);
      pushed.current = true;
    } else window.history.replaceState(null, "", url);
  }, [pathname]);

  const back = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
      return;
    }
    go(tab === "stages" ? "" : `tab=${tab}`, false);
  }, [go, tab]);

  const stage = stageId ? stageById(stageId) : undefined;
  const stageIndex = stage ? STAGES.indexOf(stage) : -1;
  const toggleSound = () => update((p) => ({ ...p, sound: !p.sound }));

  // 開けないステージを直接開こうとしたら、一覧へ
  useEffect(() => {
    if (!loaded || !stageId) return;
    if (!stage || !isUnlocked(progress, stageIndex)) go("", false);
  }, [loaded, stageId, stage, stageIndex, progress, go]);

  if (stage && loaded && isUnlocked(progress, stageIndex)) {
    return (
      <div className={styles.shell}>
        <StagePlay
          key={stage.id}
          stage={stage}
          progress={progress}
          onProgress={update}
          onExit={back}
          onNext={() => {
            const next = STAGES[stageIndex + 1];
            if (next) go(`stage=${next.id}`, false);
          }}
          onToggleSound={toggleSound}
        />
      </div>
    );
  }

  if (view === "backstage" && loaded) {
    return (
      <div className={styles.shell}>
        <Backstage onBack={back} />
      </div>
    );
  }

  const stars = totalStars(progress);
  const terms = unlockedTerms(progress);
  const quizCount = STAGES.filter((s) => progress.quiz[s.id]).length;
  const nextStage = STAGES.find((s, i) => isUnlocked(progress, i) && !isCleared(progress, s.id)) ?? null;

  return (
    <div className={styles.shell}>
      <div className={styles.home}>
        <header className={styles.homeHeader}>
          <Link href="/home" className={styles.roundBtn} aria-label="ホームへ戻る">
            ‹
          </Link>
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">
              <Glyph id="app" size={20} />
            </span>
            <div>
              <h1>インフラ</h1>
              <p>わんこ商店のサーバー係</p>
            </div>
          </div>
          <SoundButton on={progress.sound} onToggle={toggleSound} />
        </header>

        <div className={styles.progressRow}>
          <span>
            <b>★ {stars}</b>/{STAGES.length * 3}
          </span>
          <span>
            図鑑 <b>{terms.size}</b>/{TERMS.length}
          </span>
          <span>
            理解 <b>{quizCount}</b>/{STAGES.length}
          </span>
        </div>

        <nav className={styles.tabs} role="tablist" aria-label="メニュー">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              data-on={tab === t.id ? "1" : undefined}
              onClick={() => go(t.id === "stages" ? "" : `tab=${t.id}`, false)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "stages" ? (
          <StageMap
            progress={progress}
            loaded={loaded}
            nextStage={nextStage}
            onOpen={(id) => go(`stage=${id}`, true)}
            onBackstage={() => go("view=backstage", true)}
          />
        ) : null}
        {tab === "glossary" ? <Glossary unlocked={terms} /> : null}
        {tab === "lab" && loaded ? <Lab parts={unlockedParts(progress)} /> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ 路線図 */

function StageMap({
  progress,
  loaded,
  nextStage,
  onOpen,
  onBackstage,
}: {
  progress: Progress;
  loaded: boolean;
  nextStage: StageDef | null;
  onOpen: (id: string) => void;
  onBackstage: () => void;
}) {
  const backstageOpen = isCleared(progress, BACKSTAGE_AFTER);
  const backstageStage = stageById(BACKSTAGE_AFTER);
  return (
    <div className={styles.mapWrap}>
      {!loaded ? (
        <div className={styles.nextCard} aria-hidden="true" style={{ visibility: "hidden" }} />
      ) : nextStage ? (
        <button type="button" className={styles.nextCard} onClick={() => onOpen(nextStage.id)}>
          <span className={styles.nextFace}>
            <Image src={MASCOT} alt="" width={128} height={128} />
          </span>
          <span className={styles.nextText}>
            <small>{nextStage.no === 1 ? "さあ、はじめよう" : "つぎのステージ"}</small>
            <b>
              {nextStage.no}. {nextStage.title}
            </b>
            <em>{nextStage.subtitle}</em>
          </span>
          <span className={styles.nextGo} aria-hidden="true">
            ▶
          </span>
        </button>
      ) : (
        <div className={styles.allClear}>
          <b>全ステージクリア！</b>
          <span>★3 をめざしたり、ラボで自由に実験してみよう</span>
        </div>
      )}

      <ol className={styles.line}>
        {STAGES.map((s, i) => {
          const open = isUnlocked(progress, i);
          const stars = progress.stars[s.id] ?? 0;
          const current = nextStage?.id === s.id;
          const icon = s.newParts[0] ?? "lb";
          return (
            <li key={s.id} className={styles.station} data-state={!open ? "locked" : stars ? "clear" : current ? "current" : "open"}>
              <span className={styles.stationDot} aria-hidden="true">
                {stars ? "✓" : s.no}
              </span>
              <button type="button" className={styles.stationCard} disabled={!open} onClick={() => onOpen(s.id)} style={{ "--c": PARTS[icon].color } as CSSProperties}>
                <span className={styles.stationIcon} aria-hidden="true">
                  <Glyph id={icon} size={20} />
                </span>
                <span className={styles.stationText}>
                  <small>
                    STAGE {s.no}・{s.topic}
                  </small>
                  <b>{s.title}</b>
                  <em>{open ? s.subtitle : `ステージ ${s.no - 1} をクリアすると開きます`}</em>
                </span>
                <span className={styles.stationMeta}>
                  <span className={styles.miniStars} aria-label={`★${stars}`}>
                    {[0, 1, 2].map((k) => (
                      <i key={k} data-on={k < stars ? "1" : undefined}>
                        ★
                      </i>
                    ))}
                  </span>
                  {progress.quiz[s.id] ? <span className={styles.miniBadge}>理解✓</span> : null}
                  {!open ? <span className={styles.lock}>🔒</span> : null}
                </span>
              </button>
            </li>
          );
        })}
        <li className={styles.station} data-state={backstageOpen ? "bonus" : "locked"}>
          <span className={styles.stationDot} aria-hidden="true">
            ✦
          </span>
          <button type="button" className={styles.stationCard} disabled={!backstageOpen} onClick={onBackstage} style={{ "--c": "#ffd166" } as CSSProperties}>
            <span className={styles.stationIcon} aria-hidden="true">
              <Glyph id="user" size={20} />
            </span>
            <span className={styles.stationText}>
              <small>おまけ</small>
              <b>このアプリの裏側</b>
              <em>{backstageOpen ? "「おでかけ記録」は、どんな構成で動いている？" : `ステージ ${backstageStage?.no ?? ""} をクリアすると開きます`}</em>
            </span>
            {!backstageOpen ? (
              <span className={styles.stationMeta}>
                <span className={styles.lock}>🔒</span>
              </span>
            ) : null}
          </button>
        </li>
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------ 図鑑 */

function Glossary({ unlocked }: { unlocked: ReadonlySet<string> }) {
  const [open, setOpen] = useState<Term | null>(null);
  const stageOf = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of STAGES) for (const t of s.terms) map.set(t, s.no);
    return map;
  }, []);
  return (
    <div className={styles.glossary}>
      <p className={styles.glossaryLead}>ステージをクリアすると、そのステージで出てきた言葉のカードが集まります。</p>
      <div className={styles.termGrid}>
        {TERMS.map((t) => {
          const has = unlocked.has(t.id);
          const color = t.icon === "user" ? "#9fb4ff" : t.icon === "bot" ? "#ff6f8a" : PARTS[t.icon].color;
          return (
            <button
              key={t.id}
              type="button"
              className={styles.termCard}
              data-locked={has ? undefined : "1"}
              disabled={!has}
              onClick={() => setOpen(t)}
              style={{ "--c": color } as CSSProperties}
            >
              <span className={styles.termIcon} aria-hidden="true">
                {has ? <Glyph id={t.icon} size={20} /> : "?"}
              </span>
              <b>{has ? t.name : "？？？"}</b>
              <small>{has ? t.short : `ステージ ${stageOf.get(t.id) ?? "?"} で手に入る`}</small>
            </button>
          );
        })}
      </div>
      <BottomSheet open={Boolean(open)} onClose={() => setOpen(null)} label={open?.name ?? ""}>
        {open ? <TermDetail term={open} /> : null}
      </BottomSheet>
    </div>
  );
}

function TermDetail({ term }: { term: Term }) {
  const color = term.icon === "user" ? "#9fb4ff" : term.icon === "bot" ? "#ff6f8a" : PARTS[term.icon].color;
  return (
    <div>
      <div className={styles.partHead} style={{ "--c": color } as CSSProperties}>
        <span className={styles.partIcon}>
          <Glyph id={term.icon} size={34} strokeWidth={1.7} />
        </span>
        <div>
          <p className={styles.partEn}>{term.en}</p>
          <h2 className={styles.partName}>{term.name}</h2>
          <p className={styles.partRole}>{term.short}</p>
        </div>
      </div>
      <p className={styles.termBody}>{term.body}</p>
      {term.analogy ? (
        <p className={styles.analogy}>
          <span>たとえると</span>
          {term.analogy}
        </p>
      ) : null}
      {term.real ? (
        <p className={styles.termReal}>
          <span>本物では</span>
          {term.real}
        </p>
      ) : null}
    </div>
  );
}
