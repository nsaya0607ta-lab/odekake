"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import styles from "./gacha-box-preview.module.css";

const RARITIES = [
  { id: "n", label: "N", glow: "58, 185, 108" },
  { id: "r", label: "R", glow: "54, 143, 225" },
  { id: "sr", label: "SR", glow: "245, 187, 55" },
  { id: "ssr", label: "SSR", glow: "236, 111, 221" },
  { id: "ur", label: "UR", glow: "238, 75, 75" },
  { id: "lr", label: "LR", glow: "92, 84, 112" },
  { id: "mr", label: "MR", glow: "113, 86, 236" },
] as const;

type Rarity = (typeof RARITIES)[number];
type RarityId = Rarity["id"];
type PreviewMode = "single" | "ten";
type AnimationStyle = CSSProperties & Record<`--${string}`, string>;

const TEN_RESULTS: RarityId[] = ["n", "r", "n", "sr", "r", "n", "ssr", "ur", "lr", "mr"];

function rarityClass(id: RarityId) {
  return styles[`rarity${id.toUpperCase()}` as keyof typeof styles];
}

export default function GachaBoxPreviewPage() {
  const [runId, setRunId] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [mode, setMode] = useState<PreviewMode>("single");
  const [selectedRarity, setSelectedRarity] = useState<RarityId>("n");

  const selected = RARITIES.find((rarity) => rarity.id === selectedRarity) ?? RARITIES[0];
  const capsules = useMemo(
    () => (mode === "single" ? [selected] : TEN_RESULTS.map((id) => RARITIES.find((rarity) => rarity.id === id) ?? RARITIES[0])),
    [mode, selected],
  );

  useEffect(() => {
    setPlaying(true);
    const impactAt = mode === "single" ? 2700 : 5580;
    const finishAt = mode === "single" ? 4700 : 7300;
    const impactTimer = window.setTimeout(() => window.navigator.vibrate?.(24), impactAt);
    const finishTimer = window.setTimeout(() => setPlaying(false), finishAt);

    return () => {
      window.clearTimeout(impactTimer);
      window.clearTimeout(finishTimer);
    };
  }, [runId, mode]);

  const replay = useCallback(() => {
    if (!playing) setRunId((current) => current + 1);
  }, [playing]);

  const changeMode = (nextMode: PreviewMode) => {
    setMode(nextMode);
    setRunId((current) => current + 1);
  };

  const changeRarity = (rarity: RarityId) => {
    setSelectedRarity(rarity);
    setMode("single");
    setRunId((current) => current + 1);
  };

  const lastDelay = mode === "single" ? 0.38 : 0.2 + (capsules.length - 1) * 0.32;
  const finalRarity = capsules.at(-1) ?? selected;
  const sparkleStyle = {
    "--sparkle-delay": `${lastDelay + 2.32}s`,
    "--glow-rgb": finalRarity.glow,
  } as AnimationStyle;

  return (
    <main className={styles.page}>
      <section className={styles.shell} aria-labelledby="preview-title">
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>PREVIEW ONLY</p>
            <h1 id="preview-title">カプセル搬送演出</h1>
          </div>
          <span className={styles.safeBadge}>保存・消費なし</span>
        </div>

        <div className={styles.previewControls} aria-label="演出の種類">
          <div className={styles.modeSwitch}>
            <button className={mode === "single" ? styles.activeMode : ""} type="button" onClick={() => changeMode("single")}>
              単発
            </button>
            <button className={mode === "ten" ? styles.activeMode : ""} type="button" onClick={() => changeMode("ten")}>
              10連
            </button>
          </div>

          <div className={styles.rarityPicker} aria-label="単発のレア度">
            {RARITIES.map((rarity) => (
              <button
                key={rarity.id}
                className={`${styles.rarityButton} ${selectedRarity === rarity.id && mode === "single" ? styles.activeRarity : ""}`}
                data-rarity={rarity.id}
                type="button"
                onClick={() => changeRarity(rarity.id)}
              >
                {rarity.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.stageWrap}>
          <div
            key={runId}
            className={`${styles.stage} ${mode === "ten" ? styles.tenStage : ""}`}
            role="img"
            aria-label={mode === "single" ? `${selected.label}色のカプセルがレールを転がって箱に入るアニメーション` : "色の異なる10個のカプセルが順番にレールを転がって箱に入るアニメーション"}
          >
            <Image
              className={styles.sceneImage}
              src="/gacha/box-preview/gacha-scene.webp"
              alt=""
              fill
              priority
              sizes="(max-width: 520px) 100vw, 480px"
            />

            {capsules.map((rarity, index) => {
              const travelDelay = mode === "single" ? 0.38 : 0.2 + index * 0.32;
              const animationStyle = {
                "--travel-delay": `${travelDelay}s`,
                "--impact-delay": `${travelDelay + 2.32}s`,
                "--glow-rgb": rarity.glow,
              } as AnimationStyle;

              return (
                <div key={`${rarity.id}-${index}`}>
                  <Image
                    className={`${styles.travelCapsule} ${rarityClass(rarity.id)}`}
                    style={animationStyle}
                    src="/gacha/box-preview/capsule-green.png"
                    alt=""
                    width={70}
                    height={70}
                    priority={index === 0}
                  />
                  <span className={styles.impactGlow} style={animationStyle} aria-hidden="true" />
                </div>
              );
            })}

            <Image
              className={`${styles.sourceSparkle} ${rarityClass(finalRarity.id)}`}
              style={sparkleStyle}
              src="/gacha/box-preview/box-sparkle.png"
              alt=""
              width={340}
              height={285}
            />

            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className={`${styles.twinkle} ${styles[`twinkle${index + 1}` as keyof typeof styles]}`}
                style={{ ...sparkleStyle, "--twinkle-delay": `${lastDelay + 2.4 + index * 0.13}s` } as AnimationStyle}
                aria-hidden="true"
              />
            ))}
          </div>

          <div className={styles.caption} aria-live="polite">
            <span className={styles.captionDot} />
            {playing ? (mode === "ten" ? "10個を連続搬送中…" : `${selected.label}カプセル搬送中…`) : "元動画の画像で再現"}
          </div>
        </div>

        <button className={styles.replayButton} type="button" onClick={replay} disabled={playing}>
          <span aria-hidden="true">↻</span>
          {playing ? "再生中" : "もう一度見る"}
        </button>

        <p className={styles.note}>
          単発はレア度ごとの色と光を確認できます。10連は10個が同じレーンを順番に転がり、文字を出さず箱へ入ります。
        </p>
      </section>
    </main>
  );
}
