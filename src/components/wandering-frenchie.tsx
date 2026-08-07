"use client";

import { useEffect, useRef, useState } from "react";

type Pose = {
  x: number;
  y: number;
  flip: 1 | -1;
  rotate: number;
};

export function WanderingFrenchie() {
  const [pose, setPose] = useState<Pose>({ x: 18, y: 66, flip: 1, rotate: -2 });
  const lastX = useRef(18);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let timer: ReturnType<typeof setTimeout>;

    const wander = () => {
      const x = 12 + Math.random() * 76;
      const y = 48 + Math.random() * 30;
      const flip: 1 | -1 = x >= lastX.current ? 1 : -1;
      lastX.current = x;

      setPose({
        x,
        y,
        flip,
        rotate: -4 + Math.random() * 8,
      });

      timer = setTimeout(wander, 1800 + Math.random() * 1200);
    };

    timer = setTimeout(wander, 650);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute h-[74px] w-[86px] transition-[left,top,transform] duration-[1600ms] ease-in-out"
        style={{
          left: `${pose.x}%`,
          top: `${pose.y}%`,
          transform: `translate(-50%, -50%) scaleX(${pose.flip}) rotate(${pose.rotate}deg)`,
        }}
      >
        <svg viewBox="0 0 120 96" className="h-full w-full drop-shadow-sm">
          <ellipse cx="59" cy="86" rx="38" ry="5" fill="#d9dfc9" opacity="0.7" />

          <path
            d="M31 50c-5 3-9 11-8 20 1 11 10 17 22 17h35c13 0 22-8 21-20-1-11-10-19-22-20l-48 3Z"
            fill="#f4e6d4"
            stroke="#75685f"
            strokeWidth="3"
          />
          <path
            d="M36 77c-2 4-2 9 0 13M79 77c2 4 2 9 0 13"
            stroke="#75685f"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M26 61c-8-2-12-7-10-13 2-5 7-6 11-3"
            fill="none"
            stroke="#75685f"
            strokeWidth="4"
            strokeLinecap="round"
          />

          <path d="M41 27 32 7c-2-4 1-7 5-5l15 11" fill="#e8c8b0" stroke="#75685f" strokeWidth="3" />
          <path d="m73 14 14-12c4-3 8 1 6 5l-9 21" fill="#e8c8b0" stroke="#75685f" strokeWidth="3" />
          <path
            d="M36 17c9-8 34-9 45 0 9 7 11 26 3 36-8 10-36 11-47 1-10-9-10-28-1-37Z"
            fill="#f6e8d7"
            stroke="#75685f"
            strokeWidth="3"
          />
          <path d="M37 23c8-4 14-5 20-4l-3 20c-8 0-13-5-17-16Z" fill="#c6977b" opacity="0.9" />
          <ellipse cx="47" cy="34" rx="4" ry="5" fill="#514b47" />
          <ellipse cx="72" cy="34" rx="4" ry="5" fill="#514b47" />
          <path d="M56 43c2-2 6-2 8 0 1 2-1 5-4 5s-5-3-4-5Z" fill="#514b47" />
          <path d="M60 48c-1 6-6 8-11 5M60 48c1 6 6 8 11 5" fill="none" stroke="#75685f" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M46 58c8 4 20 4 28 0" fill="none" stroke="#d7b49e" strokeWidth="3" strokeLinecap="round" opacity="0.7" />

          <circle cx="94" cy="52" r="8" fill="#dbe8c9" stroke="#8aaa68" strokeWidth="2" />
          <path d="m91 52 2 2 4-5" fill="none" stroke="#5f7f45" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
