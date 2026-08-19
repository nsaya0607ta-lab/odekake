"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 幅からはみ出す文字列だけ、ゆっくり左へ流して最後まで読めるようにする。
 * はみ出していない時は普通のテキストとして表示する。
 */
export function MarqueeText({ text, className = "" }: { text: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const span = textRef.current;
      if (!container || !span) return;
      const overflow = span.scrollWidth - container.clientWidth;
      setDistance(overflow > 2 ? overflow : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [text]);

  const duration = Math.max(5, distance / 18);

  return (
    <div ref={containerRef} className={`overflow-hidden whitespace-nowrap ${className}`}>
      <span
        ref={textRef}
        className="inline-block"
        style={
          distance > 0
            ? {
                animation: `marquee-scroll ${duration}s linear infinite`,
                animationDelay: "1s",
                ["--marquee-distance" as string]: `-${distance}px`,
              }
            : undefined
        }
      >
        {text}
      </span>
    </div>
  );
}
