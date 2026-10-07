"use client";

/**
 * ステージのはじめの説明（フレブル先生のカード）と、カードの中の動く図。
 */
import Image from "next/image";
import { Fragment, useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Glyph } from "./glyphs";
import { PARTS, REQ_INFO, RESPONSE_COLOR } from "./model";
import type { FlowStep, StageDef } from "./stages";
import styles from "./infra.module.css";

export const MASCOT = "/collection/items/frenchie-plush.webp";

const stepColor = (icon: FlowStep["icon"]) => (icon === "user" ? "#9fb4ff" : icon === "bot" ? "#ff6f8a" : PARTS[icon].color);

/** 左から右へ、お願い（光る点）が流れて、返事がもどってくる図 */
export function FlowDiagram({ steps }: { steps: FlowStep[] }) {
  const blocked = steps[0]?.icon === "bot";
  return (
    <div className={styles.flow} aria-hidden="true">
      {steps.map((s, i) => (
        <Fragment key={i}>
          {i > 0 ? (
            <span
              className={styles.flowLink}
              data-blocked={blocked ? "1" : undefined}
              style={{ "--go": blocked ? REQ_INFO.attack.color : REQ_INFO.page.color, "--back": RESPONSE_COLOR, "--delay": `${(i - 1) * 0.35}s` } as CSSProperties}
            >
              <i />
              <b />
            </span>
          ) : null}
          <span className={styles.flowStep} style={{ "--c": stepColor(s.icon) } as CSSProperties}>
            {s.say ? <span className={styles.flowSay}>{s.say}</span> : null}
            <span className={styles.flowIcon}>
              <Glyph id={s.icon} size={26} />
            </span>
            <span className={styles.flowLabel}>{s.label}</span>
          </span>
        </Fragment>
      ))}
    </div>
  );
}

export function Teacher({ sub }: { sub: string }) {
  return (
    <div className={styles.teacher}>
      <span className={styles.teacherFace}>
        <Image src={MASCOT} alt="" width={128} height={128} />
      </span>
      <div>
        <small>{sub}</small>
        <b>フレブル先生</b>
      </div>
    </div>
  );
}

export function IntroOverlay({ stage, onDone }: { stage: StageDef; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const card = stage.intro[i];
  if (!mounted || !card) return null;
  const last = i === stage.intro.length - 1;
  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={`ステージ${stage.no}の説明`}>
      <div className={styles.introCard} key={i}>
        <div className={styles.introTop}>
          <Teacher sub={`ステージ ${stage.no}・${stage.topic}`} />
          <button type="button" className={styles.skip} onClick={onDone}>
            スキップ
          </button>
        </div>
        {i === 0 ? (
          <div className={styles.stageBadge}>
            <span>STAGE {stage.no}</span>
            <b>{stage.title}</b>
            <small>{stage.subtitle}</small>
          </div>
        ) : null}
        <h2 className={styles.introTitle}>{card.title}</h2>
        {card.flow ? <FlowDiagram steps={card.flow} /> : null}
        <p className={styles.introBody}>{card.body}</p>
        {card.analogy ? (
          <p className={styles.analogy}>
            <span>たとえると</span>
            {card.analogy}
          </p>
        ) : null}
        <div className={styles.introNav}>
          <span className={styles.dots} aria-label={`${i + 1} / ${stage.intro.length}`}>
            {stage.intro.map((_, k) => (
              <i key={k} data-on={k === i ? "1" : undefined} />
            ))}
          </span>
          {i > 0 ? (
            <button type="button" className={styles.btnGhost} onClick={() => setI(i - 1)}>
              もどる
            </button>
          ) : null}
          <button type="button" className={styles.btnPrimary} onClick={() => (last ? onDone() : setI(i + 1))}>
            {last ? "やってみる" : "つぎへ"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
