"use client";

import { useEffect, useRef, useState } from "react";

type Pose = {
  x: number;
  y: number;
  flip: 1 | -1;
  duration: number;
  walking: boolean;
};

export function WanderingFrenchie() {
  const [pose, setPose] = useState<Pose>({ x: 20, y: 69, flip: 1, duration: 4200, walking: false });
  const lastX = useRef(20);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const beginWalk = () => {
      if (cancelled) return;

      let x = 12 + Math.random() * 76;
      if (Math.abs(x - lastX.current) < 30) {
        x = lastX.current < 50 ? 72 + Math.random() * 14 : 12 + Math.random() * 16;
      }

      const y = 65 + Math.random() * 9;
      const flip: 1 | -1 = x >= lastX.current ? 1 : -1;
      const duration = 3600 + Math.round(Math.random() * 2200);
      lastX.current = x;

      setPose({ x, y, flip, duration, walking: true });

      timer = setTimeout(() => {
        if (cancelled) return;
        setPose((current) => ({ ...current, walking: false }));
        timer = setTimeout(beginWalk, 850 + Math.random() * 1500);
      }, duration);
    };

    timer = setTimeout(beginWalk, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes frenchie-body-bob {
          0%, 100% { transform: translateY(0px) rotate(-0.4deg); }
          25% { transform: translateY(-1.8px) rotate(0.4deg); }
          50% { transform: translateY(0.3px) rotate(-0.2deg); }
          75% { transform: translateY(-1.2px) rotate(0.35deg); }
        }
        @keyframes frenchie-leg-forward {
          0%, 100% { transform: rotate(12deg); }
          50% { transform: rotate(-15deg); }
        }
        @keyframes frenchie-leg-back {
          0%, 100% { transform: rotate(-14deg); }
          50% { transform: rotate(13deg); }
        }
        @keyframes frenchie-ear-step {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(1.5deg); }
        }
        .frenchie-walking .frenchie-body { animation: frenchie-body-bob .48s ease-in-out infinite; transform-origin: 78px 53px; }
        .frenchie-walking .frenchie-leg-a,
        .frenchie-walking .frenchie-leg-d { animation: frenchie-leg-forward .48s ease-in-out infinite; }
        .frenchie-walking .frenchie-leg-b,
        .frenchie-walking .frenchie-leg-c { animation: frenchie-leg-back .48s ease-in-out infinite; }
        .frenchie-walking .frenchie-ear { animation: frenchie-ear-step .48s ease-in-out infinite; transform-origin: bottom center; }
        .frenchie-leg-a, .frenchie-leg-b, .frenchie-leg-c, .frenchie-leg-d { transform-box: fill-box; transform-origin: 50% 12%; }
        @media (prefers-reduced-motion: reduce) {
          .frenchie-walking .frenchie-body,
          .frenchie-walking .frenchie-leg-a,
          .frenchie-walking .frenchie-leg-b,
          .frenchie-walking .frenchie-leg-c,
          .frenchie-walking .frenchie-leg-d,
          .frenchie-walking .frenchie-ear { animation: none !important; }
        }
      `}</style>

      <div
        className="absolute h-[78px] w-[126px] transition-[left,top,transform] ease-linear"
        style={{
          left: `${pose.x}%`,
          top: `${pose.y}%`,
          transitionDuration: `${pose.duration}ms`,
          transform: `translate(-50%, -50%) scaleX(${pose.flip})`,
        }}
      >
        <svg
          viewBox="0 0 160 100"
          className={`h-full w-full overflow-visible drop-shadow-[0_4px_3px_rgba(82,67,56,0.15)] ${pose.walking ? "frenchie-walking" : ""}`}
        >
          <defs>
            <linearGradient id="frenchie-coat" x1="0" y1="0" x2="0.8" y2="1">
              <stop offset="0" stopColor="#e8c7a2" />
              <stop offset="0.5" stopColor="#d9ad83" />
              <stop offset="1" stopColor="#c79269" />
            </linearGradient>
            <linearGradient id="frenchie-chest" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f5e7d5" />
              <stop offset="1" stopColor="#e9d5bc" />
            </linearGradient>
            <linearGradient id="frenchie-mask" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#6d584c" />
              <stop offset="1" stopColor="#4e4039" />
            </linearGradient>
          </defs>

          <ellipse cx="80" cy="90" rx="52" ry="5.5" fill="#8ba06f" opacity="0.20" />

          <g className="frenchie-body">
            <path
              d="M40 43c9-11 27-15 48-13 18 1 31 9 36 21 4 10 1 24-9 31-8 6-20 7-34 6l-31-2c-15-1-26-10-27-23-1-8 5-15 17-20Z"
              fill="url(#frenchie-coat)"
              stroke="#68574d"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <path
              d="M91 37c12 3 21 10 24 19 3 8 1 18-5 24-6 5-14 7-23 6 9-9 12-20 10-31-1-7-3-13-6-18Z"
              fill="url(#frenchie-chest)"
              opacity="0.95"
            />
            <path
              d="M34 46c-9 0-15 5-14 11 1 5 7 7 12 3 3-2 3-6 0-8-2-1-4 0-5 2"
              fill="none"
              stroke="#68574d"
              strokeWidth="3"
              strokeLinecap="round"
            />

            <g className="frenchie-leg-a">
              <path d="M99 69c2 0 5 1 7 3l-1 17c0 3-2 5-5 5h-5c-2 0-3-2-2-4l4-18c0-2 1-3 2-3Z" fill="#d5a77d" stroke="#68574d" strokeWidth="2" />
              <path d="M94 91h12c1 3-1 5-5 5h-8c-2 0-2-3 1-5Z" fill="#e9d5bc" />
            </g>
            <g className="frenchie-leg-b">
              <path d="M76 70c3 0 5 1 7 3l-1 16c0 3-2 5-5 5h-5c-2 0-3-2-2-4l4-17c0-2 1-3 2-3Z" fill="#c9966d" stroke="#68574d" strokeWidth="2" />
              <path d="M71 91h12c1 3-1 5-5 5h-8c-2 0-2-3 1-5Z" fill="#e6cfb7" />
            </g>
            <g className="frenchie-leg-c">
              <path d="M48 67c3 0 5 1 7 3l-1 18c0 4-2 6-5 6h-5c-3 0-4-2-3-5l4-18c0-2 1-4 3-4Z" fill="#d4a277" stroke="#68574d" strokeWidth="2" />
              <path d="M42 91h13c1 3-1 5-5 5h-9c-2 0-2-3 1-5Z" fill="#ead8c1" />
            </g>
            <g className="frenchie-leg-d">
              <path d="M31 63c3 0 5 2 7 4l-2 20c0 4-2 6-5 6h-5c-3 0-4-2-3-5l4-21c0-2 2-4 4-4Z" fill="#c8946b" stroke="#68574d" strokeWidth="2" />
              <path d="M24 90h13c1 3-1 5-5 5h-9c-2 0-2-3 1-5Z" fill="#e8d4bd" />
            </g>

            <path
              d="M105 25c6-10 17-15 28-12 12 3 19 15 18 29-1 15-10 27-23 30-12 3-24-2-30-12-6-10-4-25 7-35Z"
              fill="url(#frenchie-coat)"
              stroke="#68574d"
              strokeWidth="2.2"
            />
            <path className="frenchie-ear" d="M111 19 108 2c0-3 3-4 5-2l12 13" fill="#bd8967" stroke="#68574d" strokeWidth="2.2" strokeLinejoin="round" />
            <path className="frenchie-ear" d="m133 14 8-13c2-3 5-2 5 2l-1 19" fill="#bd8967" stroke="#68574d" strokeWidth="2.2" strokeLinejoin="round" />
            <path d="m113 16-2-10 8 8" fill="#8e6250" opacity="0.65" />
            <path d="m137 15 5-9-1 12" fill="#8e6250" opacity="0.65" />

            <path d="M113 30c5-8 16-11 26-5 7 4 10 12 9 20-9 3-19 1-25-5-5-4-8-8-10-10Z" fill="url(#frenchie-mask)" opacity="0.96" />
            <path d="M102 45c3-8 12-13 22-12 10 1 18 8 20 17 1 6-2 12-8 15-8 4-22 2-29-4-5-4-7-10-5-16Z" fill="#ead5bd" stroke="#68574d" strokeWidth="1.8" />
            <path d="M126 44c4-2 10 0 11 4 1 4-3 8-7 8-5 0-8-3-7-7 0-2 1-4 3-5Z" fill="#3f3632" />
            <path d="M130 56c1 5-1 8-5 10M130 56c2 4 6 6 11 5" fill="none" stroke="#5d4d45" strokeWidth="2" strokeLinecap="round" />
            <ellipse cx="116" cy="35" rx="3.1" ry="3.7" fill="#2f2a28" />
            <circle cx="115.2" cy="34" r="0.8" fill="#fff" opacity="0.8" />
            <path d="M109 27c4-2 8-2 11 0" fill="none" stroke="#8f6e59" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M108 52c4 2 8 2 12 0" fill="none" stroke="#c09c7e" strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
            <path d="M103 39c-2 2-3 5-3 8M106 34c-2 2-3 4-3 6" fill="none" stroke="#bb8e6c" strokeWidth="1.1" strokeLinecap="round" opacity="0.8" />
          </g>
        </svg>
      </div>
    </div>
  );
}
