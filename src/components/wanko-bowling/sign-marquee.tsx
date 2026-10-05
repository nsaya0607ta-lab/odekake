/**
 * レーン奥の看板（LEDの電光掲示板ふう）。右から左へ、文字とわんこが流れていく。
 * 見た目だけ。CSS アニメーション（transform）だけで動かし、毎フレームの処理には入れない。
 */
import fx from "./bowling-fx.module.css";

const DOG = "/characters/default";

function Dog({ src, delay = 0, hop = false }: { src: string; delay?: number; hop?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${DOG}/${src}.webp`}
      alt=""
      width={300}
      height={254}
      draggable={false}
      loading="lazy"
      decoding="async"
      className={hop ? `${fx.marqueeDog} ${fx.marqueeDogHop}` : fx.marqueeDog}
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

function Pin() {
  return (
    <svg className={fx.marqueePin} viewBox="0 0 20 34" aria-hidden="true">
      <path
        d="M10 1.5c2.3 0 3.6 2 3.2 4.1-.3 1.5-1.3 2.4-1.3 3.9 0 1.7 2.9 3.9 3.9 7.6.9 3.4.9 6.9-.4 9.9-.9 2-2.8 3.4-5.4 3.4s-4.5-1.4-5.4-3.4c-1.3-3-1.3-6.5-.4-9.9 1-3.7 3.9-5.9 3.9-7.6 0-1.5-1-2.4-1.3-3.9C6.4 3.5 7.7 1.5 10 1.5Z"
        fill="#f7f2e8"
      />
      <rect x="4.3" y="11.8" width="11.4" height="1.9" rx="0.95" fill="#e2463b" />
      <rect x="4.7" y="14.2" width="10.6" height="1.7" rx="0.85" fill="#e2463b" />
    </svg>
  );
}

/** ひとまわり分の中身（2つ並べて切れ目なくくり返す） */
function Reel() {
  return (
    <div className={fx.marqueeReel}>
      <span className={fx.marqueePaw}>🐾</span>
      <span className={fx.marqueeTitle}>WANKO LANES</span>
      <span className={fx.marqueePaw}>🐾</span>
      <Dog src="trot" hop />
      <span className={fx.marqueeBall} />
      <span className={fx.marqueePins}>
        <Pin />
        <Pin />
        <Pin />
      </span>
      <span className={fx.marqueeText}>めざせストライク！</span>
      <Dog src="walk-tail" delay={-300} />
      <Dog src="walk" delay={-650} />
      <span className={fx.marqueeStar}>★</span>
      <span className={fx.marqueeTextGold}>LET&apos;S BOWL!</span>
      <Dog src="cheer" hop delay={-200} />
      <span className={fx.marqueeStar}>★</span>
      <Dog src="roll" />
      <span className={fx.marqueeText}>ナイスボール！</span>
    </div>
  );
}

export function SignMarquee() {
  return (
    <div className={fx.marquee} aria-hidden="true">
      <div className={fx.marqueeTrack}>
        <Reel />
        <Reel />
      </div>
      {/* LEDのつぶつぶと、ガラスの映りこみ */}
      <div className={fx.marqueeLed} />
      <div className={fx.marqueeGlass} />
    </div>
  );
}
