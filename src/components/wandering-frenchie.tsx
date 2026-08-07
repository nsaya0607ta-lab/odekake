"use client";

import { useEffect, useRef, useState } from "react";

type Pose = {
  x: number;
  y: number;
  flip: 1 | -1;
  duration: number;
  walking: boolean;
};

type Point = readonly [number, number];

const bodyPoints: readonly Point[] = [
  [39, 43], [52, 34], [73, 31], [96, 33], [111, 40], [118, 53], [116, 67], [106, 77], [86, 81], [63, 79], [47, 73], [38, 62],
];
const chestPoints: readonly Point[] = [[95, 38], [108, 42], [116, 53], [113, 67], [104, 74], [95, 72], [99, 59]];
const headPoints: readonly Point[] = [[108, 23], [119, 16], [134, 17], [145, 25], [149, 39], [145, 53], [136, 63], [122, 64], [111, 57], [105, 45]];
const muzzlePoints: readonly Point[] = [[128, 39], [140, 37], [151, 42], [155, 50], [151, 59], [140, 63], [129, 59], [124, 51]];
const facePatchPoints: readonly Point[] = [[109, 27], [116, 20], [126, 19], [132, 27], [131, 39], [125, 44], [115, 40], [109, 34]];
const earRearPoints: readonly Point[] = [[111, 24], [109, 4], [114, 1], [126, 18]];
const earFrontPoints: readonly Point[] = [[133, 18], [143, 1], [148, 3], [146, 27]];
const earRearInner: readonly Point[] = [[113, 19], [112, 8], [115, 6], [121, 17]];
const earFrontInner: readonly Point[] = [[138, 17], [143, 7], [146, 8], [144, 21]];
const rearFarLeg: readonly Point[] = [[47, 65], [56, 65], [58, 78], [55, 93], [48, 95], [43, 91], [45, 76]];
const rearNearLeg: readonly Point[] = [[58, 68], [68, 67], [69, 80], [66, 95], [58, 96], [53, 92], [57, 79]];
const frontFarLeg: readonly Point[] = [[96, 67], [104, 66], [108, 78], [107, 94], [100, 96], [95, 92], [98, 79]];
const frontNearLeg: readonly Point[] = [[107, 64], [115, 63], [120, 76], [119, 94], [112, 96], [106, 91], [110, 78]];
const rearPaw: readonly Point[] = [[44, 91], [56, 91], [59, 95], [57, 98], [45, 98], [42, 96]];
const rearNearPaw: readonly Point[] = [[54, 92], [67, 92], [70, 96], [67, 99], [56, 99], [52, 97]];
const frontPaw: readonly Point[] = [[96, 92], [108, 92], [111, 96], [108, 99], [98, 99], [94, 97]];
const frontNearPaw: readonly Point[] = [[107, 91], [120, 91], [123, 95], [120, 98], [109, 98], [105, 96]];

function midpoint(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function smoothClosedPath(points: readonly Point[]) {
  if (points.length < 3) return "";
  const start = midpoint(points[points.length - 1], points[0]);
  let d = `M ${start[0]} ${start[1]}`;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const next = points[(index + 1) % points.length];
    const mid = midpoint(point, next);
    d += ` Q ${point[0]} ${point[1]} ${mid[0]} ${mid[1]}`;
  }

  return `${d} Z`;
}

function pointString(points: readonly Point[]) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

export function WanderingFrenchie() {
  const [pose, setPose] = useState<Pose>({ x: 18, y: 70, flip: 1, duration: 5000, walking: false });
  const lastX = useRef(18);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const beginWalk = () => {
      if (cancelled) return;

      let x = 12 + Math.random() * 76;
      if (Math.abs(x - lastX.current) < 36) {
        x = lastX.current < 50 ? 74 + Math.random() * 12 : 12 + Math.random() * 14;
      }

      const y = 68 + Math.random() * 5;
      const flip: 1 | -1 = x >= lastX.current ? 1 : -1;
      const duration = 4300 + Math.round(Math.random() * 1700);
      lastX.current = x;

      setPose({ x, y, flip, duration, walking: true });

      timer = setTimeout(() => {
        if (cancelled) return;
        setPose((current) => ({ ...current, walking: false }));
        timer = setTimeout(beginWalk, 900 + Math.random() * 1700);
      }, duration);
    };

    timer = setTimeout(beginWalk, 900);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes frenchie-rig-body {
          0%, 100% { transform: translateY(0px) rotate(-0.25deg); }
          25% { transform: translateY(-1.2px) rotate(0.15deg); }
          50% { transform: translateY(0.15px) rotate(-0.1deg); }
          75% { transform: translateY(-0.9px) rotate(0.2deg); }
        }
        @keyframes frenchie-rig-front-a {
          0%, 100% { transform: rotate(10deg) translateY(0px); }
          50% { transform: rotate(-14deg) translateY(-1px); }
        }
        @keyframes frenchie-rig-front-b {
          0%, 100% { transform: rotate(-13deg) translateY(-1px); }
          50% { transform: rotate(11deg) translateY(0px); }
        }
        @keyframes frenchie-rig-rear-a {
          0%, 100% { transform: rotate(-11deg) translateY(-1px); }
          50% { transform: rotate(13deg) translateY(0px); }
        }
        @keyframes frenchie-rig-rear-b {
          0%, 100% { transform: rotate(12deg) translateY(0px); }
          50% { transform: rotate(-12deg) translateY(-1px); }
        }
        @keyframes frenchie-rig-head {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-1.2deg); }
        }
        @keyframes frenchie-rig-tail {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(4deg); }
        }
        .frenchie-rig-walking .frenchie-rig-torso { animation: frenchie-rig-body .52s ease-in-out infinite; transform-origin: 82px 58px; }
        .frenchie-rig-walking .frenchie-rig-head { animation: frenchie-rig-head .52s ease-in-out infinite; transform-origin: 119px 48px; }
        .frenchie-rig-walking .frenchie-rig-front-near { animation: frenchie-rig-front-a .52s ease-in-out infinite; }
        .frenchie-rig-walking .frenchie-rig-front-far { animation: frenchie-rig-front-b .52s ease-in-out infinite; }
        .frenchie-rig-walking .frenchie-rig-rear-near { animation: frenchie-rig-rear-a .52s ease-in-out infinite; }
        .frenchie-rig-walking .frenchie-rig-rear-far { animation: frenchie-rig-rear-b .52s ease-in-out infinite; }
        .frenchie-rig-walking .frenchie-rig-tail { animation: frenchie-rig-tail .7s ease-in-out infinite; }
        .frenchie-rig-front-near, .frenchie-rig-front-far { transform-box: fill-box; transform-origin: 50% 12%; }
        .frenchie-rig-rear-near, .frenchie-rig-rear-far { transform-box: fill-box; transform-origin: 50% 14%; }
        .frenchie-rig-tail { transform-box: fill-box; transform-origin: 85% 50%; }
        @media (prefers-reduced-motion: reduce) {
          .frenchie-rig-walking .frenchie-rig-torso,
          .frenchie-rig-walking .frenchie-rig-head,
          .frenchie-rig-walking .frenchie-rig-front-near,
          .frenchie-rig-walking .frenchie-rig-front-far,
          .frenchie-rig-walking .frenchie-rig-rear-near,
          .frenchie-rig-walking .frenchie-rig-rear-far,
          .frenchie-rig-walking .frenchie-rig-tail { animation: none !important; }
        }
      `}</style>

      <div
        className="absolute h-[76px] w-[124px] transition-[left,top,transform] ease-linear"
        style={{
          left: `${pose.x}%`,
          top: `${pose.y}%`,
          transitionDuration: `${pose.duration}ms`,
          transform: `translate(-50%, -50%) scaleX(${pose.flip})`,
        }}
      >
        <svg
          viewBox="0 0 164 104"
          className={`h-full w-full overflow-visible drop-shadow-[0_4px_3px_rgba(82,67,56,0.14)] ${pose.walking ? "frenchie-rig-walking" : ""}`}
        >
          <defs>
            <linearGradient id="frenchie-rig-coat" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f2e8df" />
              <stop offset="0.58" stopColor="#e8d6c7" />
              <stop offset="1" stopColor="#d8bea9" />
            </linearGradient>
            <linearGradient id="frenchie-rig-chest" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff8f1" />
              <stop offset="1" stopColor="#ead8c8" />
            </linearGradient>
            <linearGradient id="frenchie-rig-mask" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#6f5852" />
              <stop offset="1" stopColor="#4d3d39" />
            </linearGradient>
          </defs>

          <ellipse cx="82" cy="99" rx="53" ry="4.4" fill="#71865b" opacity="0.18" />

          <g className="frenchie-rig-rear-far">
            <path d={smoothClosedPath(rearFarLeg)} fill="#d8bfad" stroke="#66554e" strokeWidth="1.8" />
            <polygon points={pointString(rearPaw)} fill="#f4e8de" stroke="#66554e" strokeWidth="1.5" />
          </g>
          <g className="frenchie-rig-front-far">
            <path d={smoothClosedPath(frontFarLeg)} fill="#d8bfad" stroke="#66554e" strokeWidth="1.8" />
            <polygon points={pointString(frontPaw)} fill="#f4e8de" stroke="#66554e" strokeWidth="1.5" />
          </g>

          <g className="frenchie-rig-tail">
            <path d="M42 48 C31 44 29 51 34 56 C38 60 44 57 42 53" fill="none" stroke="#66554e" strokeWidth="3.2" strokeLinecap="round" />
          </g>

          <g className="frenchie-rig-torso">
            <path d={smoothClosedPath(bodyPoints)} fill="url(#frenchie-rig-coat)" stroke="#66554e" strokeWidth="2.1" strokeLinejoin="round" />
            <path d={smoothClosedPath(chestPoints)} fill="url(#frenchie-rig-chest)" opacity="0.96" />
            <path d="M54 39 C67 33 84 34 97 38" fill="none" stroke="#c9ad9b" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
            <path d="M48 53 C51 60 51 66 47 72" fill="none" stroke="#c5a997" strokeWidth="1.1" strokeLinecap="round" opacity="0.5" />
          </g>

          <g className="frenchie-rig-rear-near">
            <path d={smoothClosedPath(rearNearLeg)} fill="#e4cebe" stroke="#66554e" strokeWidth="1.9" />
            <polygon points={pointString(rearNearPaw)} fill="#fff7f0" stroke="#66554e" strokeWidth="1.5" />
          </g>
          <g className="frenchie-rig-front-near">
            <path d={smoothClosedPath(frontNearLeg)} fill="#ead8ca" stroke="#66554e" strokeWidth="1.9" />
            <polygon points={pointString(frontNearPaw)} fill="#fff7f0" stroke="#66554e" strokeWidth="1.5" />
          </g>

          <g className="frenchie-rig-head">
            <path d={smoothClosedPath(headPoints)} fill="url(#frenchie-rig-coat)" stroke="#66554e" strokeWidth="2.1" strokeLinejoin="round" />
            <polygon points={pointString(earRearPoints)} fill="#d2ad9b" stroke="#66554e" strokeWidth="2.1" strokeLinejoin="round" />
            <polygon points={pointString(earFrontPoints)} fill="#d2ad9b" stroke="#66554e" strokeWidth="2.1" strokeLinejoin="round" />
            <polygon points={pointString(earRearInner)} fill="#d88f94" opacity="0.58" />
            <polygon points={pointString(earFrontInner)} fill="#d88f94" opacity="0.58" />

            <path d={smoothClosedPath(facePatchPoints)} fill="url(#frenchie-rig-mask)" opacity="0.92" />
            <path d={smoothClosedPath(muzzlePoints)} fill="#f5e9df" stroke="#66554e" strokeWidth="1.7" />

            <ellipse cx="118" cy="34" rx="2.8" ry="3.2" fill="#2f2927" />
            <circle cx="117.3" cy="33.1" r="0.65" fill="#fff" opacity="0.8" />
            <ellipse cx="139" cy="35" rx="2.6" ry="3.1" fill="#2f2927" />
            <circle cx="138.4" cy="34.1" r="0.6" fill="#fff" opacity="0.8" />

            <path d="M132 46 C135 43 141 43 144 46 C145 50 141 53 138 53 C134 53 131 50 132 46 Z" fill="#3c3330" />
            <path d="M138 53 C138 58 135 60 131 60 M138 53 C139 58 143 60 148 58" fill="none" stroke="#5b4943" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M112 27 C116 24 121 24 125 26" fill="none" stroke="#9b786a" strokeWidth="1.25" strokeLinecap="round" />
            <path d="M134 25 C138 23 142 24 145 27" fill="none" stroke="#9b786a" strokeWidth="1.15" strokeLinecap="round" />
            <path d="M109 42 C111 47 112 52 110 56 M115 44 C116 48 116 52 114 55" fill="none" stroke="#b89482" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
            <path d="M127 57 C131 59 135 59 139 57" fill="none" stroke="#c49f8c" strokeWidth="1" strokeLinecap="round" opacity="0.65" />
          </g>
        </svg>
      </div>
    </div>
  );
}
