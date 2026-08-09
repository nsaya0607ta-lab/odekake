"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatCoins } from "@/lib/coins";
import { NoteArt, SparkleArt } from "./coin-art";
import { IconBag, IconChevronRight, IconCoin, IconQuestion } from "./icons";

/**
 * 「ショップで買うとこうなる」
 *
 * ショップの中身はまだないので、3つとも見本。実際の商品ではない。
 * 購入前・購入後の絵は、手持ちの犬のイラストと図形を組み合わせて作っている。
 */

type ShopSample = {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: React.ReactNode;
  before: React.ReactNode;
  after: React.ReactNode;
};

const FLOOR = "absolute inset-0 bg-gradient-to-b from-[#f7efe0] to-[#efe0c9]";
const DOG = "absolute bottom-[8%] left-1/2 w-[74%] -translate-x-1/2 select-none";

/* eslint-disable @next/next/no-img-element */
const SAMPLES: readonly ShopSample[] = [
  {
    id: "bed",
    name: "ふかふかベッド",
    description: "ぐっすり眠れてEXPアップ！",
    price: 800,
    icon: <BedIcon />,
    before: (
      <>
        <span className={FLOOR} />
        <span className="absolute inset-x-0 bottom-[22%] h-px bg-[#e0cba4]" />
        <img src="/characters/frenchie/lie.webp" alt="" className={DOG} draggable={false} />
      </>
    ),
    after: (
      <>
        <span className={FLOOR} />
        <span className="absolute inset-x-0 bottom-[22%] h-px bg-[#e0cba4]" />
        <span className="absolute bottom-[10%] left-1/2 h-[34%] w-[80%] -translate-x-1/2 rounded-[50%] border-2 border-[#dfc79e] bg-[#f9efd8]" />
        <img src="/characters/frenchie/doze.webp" alt="" className={DOG} draggable={false} />
        <SparkleArt className="absolute right-[8%] top-[14%] w-3 text-sun" />
        <SparkleArt className="absolute left-[10%] top-[26%] w-2 text-sun" />
      </>
    ),
  },
  {
    id: "toybox",
    name: "おもちゃ箱",
    description: "お部屋がにぎやかに！",
    price: 600,
    icon: <ToyBoxIcon />,
    before: (
      <>
        <span className={FLOOR} />
        <span className="absolute inset-x-0 bottom-[22%] h-px bg-[#e0cba4]" />
        <img src="/characters/frenchie/lie-wave.webp" alt="" className={DOG} draggable={false} />
        <span className="absolute bottom-[14%] right-[12%] h-2.5 w-2.5 rounded-full bg-[#f2c6cd]" />
      </>
    ),
    after: (
      <>
        <span className={FLOOR} />
        <span className="absolute inset-x-0 bottom-[22%] h-px bg-[#e0cba4]" />
        {/* おもちゃ箱 */}
        <span className="absolute bottom-[16%] right-[6%] h-[34%] w-[30%] rounded-md border-2 border-[#a87b45] bg-[#c9954f]" />
        <span className="absolute bottom-[38%] right-[8%] h-2 w-[26%] rounded-full bg-[#e0b862]" />
        <span className="absolute bottom-[44%] right-[10%] h-2.5 w-2.5 rounded-full bg-[#cfe0bd]" />
        <span className="absolute bottom-[46%] right-[20%] h-2 w-2 rounded-full bg-[#f2c6cd]" />
        <span className="absolute bottom-[48%] right-[15%] h-2 w-2 rounded-full bg-[#cfd9ef]" />
        <img src="/characters/frenchie/lie-wave.webp" alt="" className={DOG} draggable={false} />
        <span className="absolute bottom-[14%] left-[10%] h-2.5 w-2.5 rounded-full bg-[#f2c6cd]" />
        <span className="absolute bottom-[16%] left-[22%] h-2 w-2 rounded-full bg-[#cfe0bd]" />
        <SparkleArt className="absolute left-[8%] top-[16%] w-3 text-sun" />
      </>
    ),
  },
  {
    id: "raincoat",
    name: "レインコート",
    description: "雨の日もへっちゃら♪",
    price: 900,
    icon: <RaincoatIcon />,
    before: (
      <>
        <span className="absolute inset-0 bg-gradient-to-b from-[#dfe6ea] to-[#cdd8de]" />
        <RainDrops />
        <img
          src="/characters/frenchie/sit-side.webp"
          alt=""
          className={`${DOG} opacity-90 saturate-50`}
          draggable={false}
        />
        <span className="absolute inset-x-0 bottom-0 h-[14%] bg-[#b9c8d1]/70" />
      </>
    ),
    after: (
      <>
        <span className="absolute inset-0 bg-gradient-to-b from-[#e7f0e5] to-[#d3e3d3]" />
        <RainDrops />
        {/* 犬の絵に重ねると顔が隠れてしまうので、レインコートは横に並べて見せる */}
        <img
          src="/characters/frenchie/stand-happy.webp"
          alt=""
          className="absolute bottom-[8%] left-[40%] w-[70%] -translate-x-1/2 select-none"
          draggable={false}
        />
        <span className="absolute bottom-[16%] right-[4%] w-[26%]">
          <RaincoatIcon />
        </span>
        <span className="absolute inset-x-0 bottom-0 h-[14%] bg-[#bcd2bc]/70" />
        <NoteArt className="absolute right-[10%] top-[16%] w-3 text-leaf-deep" />
        <SparkleArt className="absolute left-[8%] top-[14%] w-2.5 text-sun" />
      </>
    ),
  },
];
/* eslint-enable @next/next/no-img-element */

export function CoinShopPreview() {
  const scroller = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);

  const onScroll = useCallback(() => {
    const node = scroller.current;
    if (!node) return;
    const cards = Array.from(node.children) as HTMLElement[];
    if (cards.length === 0) return;

    // 左端にいちばん近いカードを選択中にする
    let nearest = 0;
    let shortest = Number.POSITIVE_INFINITY;
    for (const [index, card] of cards.entries()) {
      const distance = Math.abs(card.offsetLeft - node.scrollLeft);
      if (distance < shortest) {
        shortest = distance;
        nearest = index;
      }
    }
    setActive(nearest);
  }, []);

  useEffect(() => {
    onScroll();
  }, [onScroll]);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <h2 className="flex min-w-0 items-center gap-1.5 text-base font-bold">
          <IconBag size={18} className="shrink-0 text-[#c9954f]" />
          <span className="min-w-0 truncate">ショップで買うとこうなる</span>
          <IconQuestion size={15} className="shrink-0 text-ink-faint" />
        </h2>
        {/* ショップがまだないので、行き先のない見出しの飾り */}
        <span className="flex shrink-0 items-center gap-0.5 text-sm text-ink-faint">
          もっと見る
          <IconChevronRight size={15} />
        </span>
      </div>

      <ul
        ref={scroller}
        onScroll={onScroll}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SAMPLES.map((sample) => (
          <li key={sample.id} className="w-[47%] shrink-0 snap-start sm:w-[42%]">
            <div className="rough-card h-full overflow-hidden p-2.5">
              <p className="flex min-w-0 items-start gap-1.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">{sample.icon}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold">{sample.name}</span>
                  <span className="mt-0.5 block line-clamp-2 text-[9px] leading-tight text-ink-soft">
                    {sample.description}
                  </span>
                </span>
              </p>

              <div className="mt-2 flex items-stretch gap-1">
                <PreviewPanel label="購入前">{sample.before}</PreviewPanel>
                <span className="flex shrink-0 items-center text-ink-faint" aria-hidden="true">
                  <IconChevronRight size={13} />
                </span>
                <PreviewPanel label="購入後">{sample.after}</PreviewPanel>
              </div>

              <p className="mt-2 flex items-center justify-center gap-1 rounded-full border border-[#e8d4aa] bg-sun-soft/60 py-1">
                <IconCoin size={14} />
                <span className="text-xs font-bold tabular-nums text-ink">{formatCoins(sample.price)}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex items-center justify-center gap-1.5" aria-hidden="true">
        {SAMPLES.map((sample, index) => (
          <span
            key={sample.id}
            className={`h-1.5 rounded-full transition-all ${
              index === active ? "w-4 bg-leaf" : "w-1.5 bg-line-strong"
            }`}
          />
        ))}
      </div>
    </section>
  );
}

function PreviewPanel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="relative block min-w-0 flex-1 overflow-hidden rounded-lg border border-line">
      <span className="block aspect-[5/4]" />
      {children}
      <span className="absolute left-1 top-1 rounded-md bg-card/85 px-1 py-0.5 text-[8px] font-bold text-ink-soft">
        {label}
      </span>
    </span>
  );
}

function RainDrops() {
  return (
    <span
      className="absolute inset-0"
      aria-hidden="true"
      style={{
        backgroundImage:
          "repeating-linear-gradient(74deg, rgba(255,255,255,0.85) 0 1.5px, transparent 1.5px 9px)",
        opacity: 0.7,
      }}
    />
  );
}

function BedIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-full" aria-hidden="true">
      <ellipse cx="12" cy="15.5" rx="10" ry="6" fill="#f9efd8" stroke="#dfc79e" strokeWidth="1.4" />
      <ellipse cx="12" cy="15" rx="6" ry="3.2" fill="#f0dfbe" stroke="#dfc79e" strokeWidth="1.2" />
      <path d="M4.4 11.6a10 6 0 0 1 15.2 0" stroke="#dfc79e" strokeWidth="1.4" fill="none" />
    </svg>
  );
}

function ToyBoxIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-full" aria-hidden="true">
      <rect x="4" y="10" width="16" height="10" rx="2" fill="#c9954f" stroke="#a87b45" strokeWidth="1.3" />
      <rect x="3" y="8" width="18" height="3.4" rx="1.5" fill="#e0b862" stroke="#a87b45" strokeWidth="1.2" />
      <circle cx="9" cy="6" r="2.2" fill="#cfe0bd" />
      <circle cx="14.5" cy="5.4" r="2" fill="#f2c6cd" />
    </svg>
  );
}

function RaincoatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-full" aria-hidden="true">
      <path d="M8 6a4 4 0 0 1 8 0l4 3-2 3-1-1v8H7v-8l-1 1-2-3z" fill="#f0d68a" stroke="#c9a83f" strokeWidth="1.3" />
      <path d="M12 9v10" stroke="#c9a83f" strokeWidth="1.2" />
    </svg>
  );
}
