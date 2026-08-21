import Image from "next/image";
import type { ReactNode } from "react";

type HeroTone = "compose" | "notice" | "conversation" | "photo" | "group";

/**
 * SNS配下の役割を一目で伝える、小さな共通ヒーロー。
 * 生成アートは装飾扱いにして、見出しと操作だけを読み上げ対象にする。
 */
export function SnsIllustratedHero({
  eyebrow,
  title,
  description,
  artSrc,
  tone,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  artSrc: string;
  tone: HeroTone;
  action?: ReactNode;
}) {
  return (
    <section className={`sns-subpage-hero is-${tone}`}>
      <span className="sns-subpage-hero-glow" aria-hidden="true" />
      <div className="sns-subpage-hero-copy">
        <p className="sns-subpage-eyebrow">{eyebrow}</p>
        <h2 className="sns-subpage-title">{title}</h2>
        <p className="sns-subpage-description">{description}</p>
        {action ? <div className="sns-subpage-action">{action}</div> : null}
      </div>
      <Image
        src={artSrc}
        alt=""
        width={384}
        height={384}
        sizes="112px"
        className="sns-subpage-art"
        aria-hidden="true"
      />
      <span className="sns-subpage-sparkle is-one" aria-hidden="true">✦</span>
      <span className="sns-subpage-sparkle is-two" aria-hidden="true">·</span>
    </section>
  );
}
