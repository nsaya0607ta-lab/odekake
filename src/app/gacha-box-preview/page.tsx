"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./gacha-box-preview.module.css";

const sparkles = [
  [548, 332], [578, 307], [610, 315], [640, 330], [659, 358],
  [553, 379], [580, 397], [620, 392], [651, 385], [676, 345],
] as const;

const globeCapsules: ReadonlyArray<readonly [number, number, string]> = [
  [105, 102, "#7bcba1"], [142, 82, "#7ca7dc"], [179, 101, "#f1ca57"],
  [91, 137, "#d983b9"], [129, 129, "#68cdd0"], [169, 140, "#9179cf"],
  [204, 130, "#ec836f"], [111, 169, "#f2cc55"], [151, 168, "#ef7d75"],
  [190, 174, "#6ec894"],
];

export default function GachaBoxPreviewPage() {
  const [runId, setRunId] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    setPlaying(true);
    const impactTimer = window.setTimeout(() => {
      window.navigator.vibrate?.(24);
    }, 3570);
    const finishTimer = window.setTimeout(() => setPlaying(false), 5750);

    return () => {
      window.clearTimeout(impactTimer);
      window.clearTimeout(finishTimer);
    };
  }, [runId]);

  const replay = useCallback(() => {
    if (playing) return;
    setRunId((current) => current + 1);
  }, [playing]);

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

        <div className={styles.stageWrap}>
          <svg
            key={runId}
            className={styles.stage}
            viewBox="0 0 720 560"
            role="img"
            aria-label="緑色のカプセルがガチャ本体から二本のレールを転がり、ダンボール箱へ落ちて光るアニメーション"
          >
            <defs>
              <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff8c9" />
                <stop offset="1" stopColor="#f8df91" />
              </linearGradient>
              <radialGradient id="stageLight" cx="50%" cy="42%" r="62%">
                <stop offset="0" stopColor="#fffef0" stopOpacity=".95" />
                <stop offset="1" stopColor="#ffe69a" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="machineRed" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#ff725b" />
                <stop offset="1" stopColor="#c9382d" />
              </linearGradient>
              <linearGradient id="machineCream" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fffdf2" />
                <stop offset="1" stopColor="#eadbbd" />
              </linearGradient>
              <linearGradient id="rail" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#f5f1e8" />
                <stop offset=".45" stopColor="#9ba5a2" />
                <stop offset="1" stopColor="#596361" />
              </linearGradient>
              <linearGradient id="cardboard" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#e9b970" />
                <stop offset="1" stopColor="#b87837" />
              </linearGradient>
              <linearGradient id="cardboardFront" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#d89a50" />
                <stop offset="1" stopColor="#a8652d" />
              </linearGradient>
              <radialGradient id="capsuleTop" cx="35%" cy="25%" r="75%">
                <stop offset="0" stopColor="#c8ffd2" />
                <stop offset=".38" stopColor="#56d17b" />
                <stop offset="1" stopColor="#16904d" />
              </radialGradient>
              <linearGradient id="capsuleBottom" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#39bc68" />
                <stop offset="1" stopColor="#087b3b" />
              </linearGradient>
              <radialGradient id="greenGlow">
                <stop offset="0" stopColor="#eaffb4" stopOpacity=".95" />
                <stop offset=".35" stopColor="#70ee91" stopOpacity=".7" />
                <stop offset="1" stopColor="#43cf77" stopOpacity="0" />
              </radialGradient>
              <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="9" stdDeviation="7" floodColor="#8a571f" floodOpacity=".25" />
              </filter>
              <filter id="capsuleShadow" x="-80%" y="-80%" width="260%" height="260%">
                <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#275d3b" floodOpacity=".38" />
              </filter>
              <filter id="glow" x="-150%" y="-150%" width="400%" height="400%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <clipPath id="globeClip">
                <path d="M76 95C76 33 214 31 214 95v104H76Z" />
              </clipPath>
            </defs>

            <rect width="720" height="560" rx="38" fill="url(#sky)" />
            <rect width="720" height="560" rx="38" fill="url(#stageLight)" />
            <ellipse cx="360" cy="487" rx="310" ry="35" fill="#a97832" opacity=".14" />

            <g className={styles.machine} filter="url(#softShadow)">
              <path d="M76 95C76 33 214 31 214 95v104H76Z" fill="#d7f1e8" fillOpacity=".58" stroke="#f7fff9" strokeWidth="10" />
              <g clipPath="url(#globeClip)" opacity=".95">
                {globeCapsules.map(([cx, cy, fill], index) => (
                  <g key={index}>
                    <circle cx={cx} cy={cy} r="23" fill={fill} />
                    <path d={`M${cx - 18} ${cy}h36`} stroke="#fff" strokeOpacity=".55" strokeWidth="4" />
                    <circle cx={cx - 7} cy={cy - 8} r="5" fill="#fff" opacity=".55" />
                  </g>
                ))}
              </g>
              <rect x="62" y="190" width="171" height="215" rx="22" fill="url(#machineRed)" />
              <rect x="80" y="211" width="135" height="147" rx="18" fill="url(#machineCream)" />
              <rect x="49" y="185" width="197" height="30" rx="12" fill="#c8342c" />
              <rect x="54" y="388" width="188" height="31" rx="12" fill="#ad2b27" />
              <circle cx="147" cy="278" r="40" fill="#d8d4c9" stroke="#7f8580" strokeWidth="7" />
              <g className={styles.knob}>
                <rect x="137" y="245" width="20" height="67" rx="8" fill="#59605d" />
                <rect x="119" y="266" width="56" height="22" rx="8" fill="#727b77" />
                <circle cx="147" cy="278" r="10" fill="#ece9df" />
              </g>
              <path d="M178 337h43a24 24 0 0 1 24 24v30h-80v-41a13 13 0 0 1 13-13Z" fill="#541f1b" />
              <path d="M178 343h37a19 19 0 0 1 19 19v8h-69v-14a13 13 0 0 1 13-13Z" fill="#1b1a18" />
              <ellipse className={styles.outletGlow} cx="218" cy="365" rx="31" ry="22" fill="#9affb1" />
            </g>

            <g className={styles.railSupports}>
              {[274, 338, 404, 470, 520].map((x, index) => (
                <g key={x}>
                  <path d={`M${x} ${index === 0 ? 393 : index === 1 ? 420 : index === 2 ? 393 : index === 3 ? 378 : 372}v78`} stroke="#c94a36" strokeWidth="9" strokeLinecap="round" />
                  <ellipse cx={x} cy="474" rx="15" ry="6" fill="#9b3a2e" opacity=".65" />
                </g>
              ))}
            </g>
            <path d="M218 359C266 363 279 420 326 421C373 422 388 368 428 360C466 352 493 376 527 366" fill="none" stroke="#3f4745" strokeWidth="24" strokeLinecap="round" opacity=".3" />
            <path d="M218 348C266 352 279 409 326 410C373 411 388 357 428 349C466 341 493 365 527 355" fill="none" stroke="url(#rail)" strokeWidth="12" strokeLinecap="round" />
            <path d="M218 370C266 374 279 431 326 432C373 433 388 379 428 371C466 363 493 387 527 377" fill="none" stroke="url(#rail)" strokeWidth="12" strokeLinecap="round" />
            <path d="M221 345C270 349 280 406 327 407C373 408 389 354 429 346C468 338 493 362 528 352" fill="none" stroke="#fff" strokeOpacity=".65" strokeWidth="3" strokeLinecap="round" />

            <g className={styles.boxBack} filter="url(#softShadow)">
              <path d="M544 377l66-37 69 37-67 36Z" fill="#7c4824" />
              <path className={styles.leftFlap} d="M611 374l-70-33-39 35 82 34Z" fill="#e7b26b" stroke="#b57537" strokeWidth="4" />
              <path className={styles.rightFlap} d="M611 374l69-33 37 36-78 33Z" fill="#e1a85f" stroke="#b57537" strokeWidth="4" />
              <path d="M544 377l68 35 67-35v91l-67 39-68-39Z" fill="url(#cardboard)" />
            </g>

            <g className={styles.impactFx} aria-hidden="true">
              <circle cx="611" cy="393" r="112" fill="url(#greenGlow)" />
              <circle className={styles.ringOne} cx="611" cy="393" r="48" fill="none" stroke="#bfffc2" strokeWidth="9" />
              <circle className={styles.ringTwo} cx="611" cy="393" r="42" fill="none" stroke="#54de7b" strokeWidth="5" />
              {sparkles.map(([x, y], index) => (
                <path
                  key={index}
                  className={styles.sparkle}
                  style={{ animationDelay: `${3.48 + index * 0.045}s` }}
                  d={`M${x} ${y - 11}c1 7 5 10 11 11-6 1-10 5-11 11-1-6-5-10-11-11 6-1 10-4 11-11Z`}
                  fill={index % 3 === 0 ? "#fff9ae" : "#e8ffdd"}
                  filter="url(#glow)"
                />
              ))}
            </g>

            <g className={styles.travelCapsule} filter="url(#capsuleShadow)">
              <animateMotion
                dur="2.85s"
                begin=".72s"
                fill="freeze"
                rotate="0"
                path="M218 350 C265 353 279 412 326 413 C373 414 389 360 428 352 C467 344 493 369 526 359 C555 351 565 321 592 329 C617 337 617 370 611 401"
              />
              <g>
                <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="1080 0 0" dur="2.85s" begin=".72s" fill="freeze" />
                <circle cy="-1" r="27" fill="url(#capsuleTop)" />
                <path d="M-27 0a27 27 0 0 0 54 0Z" fill="url(#capsuleBottom)" />
                <path d="M-26-1h52" stroke="#ecfff0" strokeOpacity=".9" strokeWidth="6" />
                <ellipse cx="-8" cy="-12" rx="7" ry="10" fill="#fff" opacity=".55" />
              </g>
            </g>

            <g className={styles.revealCapsule} filter="url(#capsuleShadow)">
              <circle r="31" fill="url(#capsuleTop)" />
              <path d="M-31 0a31 31 0 0 0 62 0Z" fill="url(#capsuleBottom)" />
              <path d="M-30-1h60" stroke="#ecfff0" strokeOpacity=".92" strokeWidth="7" />
              <ellipse cx="-9" cy="-14" rx="8" ry="11" fill="#fff" opacity=".58" />
            </g>

            <g className={styles.boxFront}>
              <path d="M544 377l68 35v95l-68-39Z" fill="url(#cardboardFront)" stroke="#a9652e" strokeWidth="3" />
              <path d="M612 412l67-35v91l-67 39Z" fill="#c98945" stroke="#9f602d" strokeWidth="3" />
              <path d="M612 412v95" stroke="#9e5c2b" strokeWidth="4" opacity=".72" />
              <path d="M632 405v90" stroke="#f3ce8e" strokeOpacity=".28" strokeWidth="3" />
              <path d="M582 397l30 15 27-14" fill="none" stroke="#f5d79d" strokeOpacity=".35" strokeWidth="4" />
            </g>

            <g className={styles.dust} aria-hidden="true">
              <circle cx="565" cy="469" r="9" fill="#f8e2a8" />
              <circle cx="648" cy="472" r="7" fill="#f8e2a8" />
              <circle cx="673" cy="456" r="5" fill="#f8e2a8" />
            </g>
          </svg>

          <div className={styles.caption} aria-live="polite">
            <span className={styles.captionDot} />
            {playing ? "カプセル搬送中…" : "緑の光とキラキラでNを表現"}
          </div>
        </div>

        <button className={styles.replayButton} type="button" onClick={replay} disabled={playing}>
          <span aria-hidden="true">↻</span>
          {playing ? "再生中" : "もう一度見る"}
        </button>

        <p className={styles.note}>
          文字はカプセルに入れず、色・光・粒子だけでレアリティを表現しています。
        </p>
      </section>
    </main>
  );
}
