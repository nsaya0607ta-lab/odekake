"use client";

/**
 * おさんぽのおみやげの絵（SVG）。家具と同じく、光は左上から。
 * どれも viewBox 0 0 100 100 で、足もと（y=92 あたり）に置いた形に描く（棚や床にそのまま乗る）。
 */
import { useId } from "react";
import type { SouvenirId } from "@/lib/room/souvenirs";

const SVG_CLASS = "pointer-events-none block h-auto w-full";

function Shadow({ rx = 30 }: { rx?: number }) {
  return <ellipse cx="50" cy="93" rx={rx} ry="4.5" fill="#3A2614" opacity="0.18" />;
}

export function SouvenirArt({ id, label }: { id: SouvenirId; label?: string }) {
  const u = `sv${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const g = (n: string) => `${u}-${n}`;
  const a11y = label ? { role: "img" as const, "aria-label": label } : {};
  const body = (() => {
    switch (id) {
      case "pebble":
        return (
          <>
            <defs><radialGradient id={g("s")} cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#E6E2DA" /><stop offset="1" stopColor="#9C958A" /></radialGradient></defs>
            <Shadow rx={32} />
            <ellipse cx="50" cy="76" rx="32" ry="18" fill={`url(#${g("s")})`} />
            <ellipse cx="40" cy="69" rx="10" ry="4" fill="#FFFFFF" opacity="0.45" />
            <path d="M58 82 q8 -3 14 -10" stroke="#8A8378" strokeWidth="1.2" fill="none" opacity="0.5" />
          </>
        );
      case "heart-stone":
        return (
          <>
            <defs><radialGradient id={g("s")} cx="0.35" cy="0.3" r="0.85"><stop offset="0" stopColor="#FFD9E2" /><stop offset="1" stopColor="#D98AA0" /></radialGradient></defs>
            <Shadow rx={28} />
            <path d="M50 90 C 24 76 16 60 24 50 C 32 40 46 44 50 54 C 54 44 68 40 76 50 C 84 60 76 76 50 90 Z" fill={`url(#${g("s")})`} />
            <ellipse cx="36" cy="55" rx="7" ry="4" fill="#FFFFFF" opacity="0.6" transform="rotate(-30 36 55)" />
            <path d="M74 36 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" fill="#FFE07A" />
          </>
        );
      case "feather":
        return (
          <>
            <defs><linearGradient id={g("f")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F4F6FA" /><stop offset="1" stopColor="#9FB4CC" /></linearGradient></defs>
            <Shadow rx={26} />
            <g transform="rotate(-38 50 60)">
              <path d="M50 14 C 66 30 66 70 52 92 L 48 92 C 34 70 34 30 50 14 Z" fill={`url(#${g("f")})`} />
              <path d="M50 18 L50 98" stroke="#7A8CA4" strokeWidth="1.6" />
              {[30, 42, 54, 66, 78].map((y) => <path key={y} d={`M50 ${y} l-12 -6 M50 ${y} l12 -6`} stroke="#C2CEDD" strokeWidth="1" />)}
              <path d="M50 60 l-9 4" stroke="#FFFFFF" strokeWidth="2" opacity="0.6" />
            </g>
          </>
        );
      case "twig":
        return (
          <>
            <Shadow rx={36} />
            <path d="M14 86 C 34 80 60 74 88 60" stroke="#8A5A34" strokeWidth="6" strokeLinecap="round" fill="none" />
            <path d="M14 86 C 34 80 60 74 88 60" stroke="#B88456" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7" />
            <path d="M46 77 C 50 66 58 60 64 56 M66 69 C 72 66 76 58 76 50" stroke="#8A5A34" strokeWidth="3.4" strokeLinecap="round" fill="none" />
            <ellipse cx="64" cy="54" rx="6" ry="3.4" fill="#7CB65A" transform="rotate(-30 64 54)" />
          </>
        );
      case "sakura":
        return (
          <>
            <Shadow rx={30} />
            {[[36, 70, -20, 1], [62, 74, 25, 0.9], [50, 58, 0, 1.1]].map(([x, y, r, s], i) => (
              <g key={i} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
                <path d="M0 14 C -12 6 -12 -10 -3 -14 L 0 -9 L 3 -14 C 12 -10 12 6 0 14 Z" fill="#FFC9D9" stroke="#F09AB3" strokeWidth="1" />
                <path d="M0 10 L0 -6" stroke="#F7A8C0" strokeWidth="1" />
              </g>
            ))}
          </>
        );
      case "dandelion":
        return (
          <>
            <Shadow rx={22} />
            <path d="M50 92 C 48 74 52 60 50 44" stroke="#5E9A44" strokeWidth="3" fill="none" />
            <path d="M50 80 C 40 76 34 70 30 62 M50 84 C 60 80 66 74 70 66" stroke="#6CAE4E" strokeWidth="4" strokeLinecap="round" fill="none" />
            {Array.from({ length: 16 }, (_, i) => <ellipse key={i} cx="50" cy="28" rx="3" ry="11" fill={i % 2 ? "#FFD23A" : "#FFC21A"} transform={`rotate(${i * 22.5} 50 38)`} />)}
            <circle cx="50" cy="38" r="6" fill="#F2A81A" />
          </>
        );
      case "clover":
        return (
          <>
            <Shadow rx={24} />
            <path d="M50 92 C 50 80 52 70 50 58" stroke="#4E8A3A" strokeWidth="3" fill="none" />
            {[0, 90, 180, 270].map((r) => (
              <g key={r} transform={`rotate(${r + 45} 50 44)`}>
                <path d="M50 44 C 40 34 40 22 50 26 C 60 22 60 34 50 44 Z" fill="#6CBE5A" stroke="#3F8A3A" strokeWidth="1.2" />
                <path d="M50 40 L50 30" stroke="#B9E6A6" strokeWidth="1" />
              </g>
            ))}
            <path d="M76 22 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" fill="#FFE07A" />
          </>
        );
      case "shell":
        return (
          <>
            <defs><linearGradient id={g("s")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFF4E6" /><stop offset="1" stopColor="#E8BF98" /></linearGradient></defs>
            <Shadow rx={30} />
            <path d="M50 88 C 22 88 16 60 22 50 C 30 36 70 36 78 50 C 84 60 78 88 50 88 Z" fill={`url(#${g("s")})`} stroke="#C99A72" strokeWidth="1.4" />
            {[-24, -12, 0, 12, 24].map((dx) => <path key={dx} d={`M50 86 Q ${50 + dx * 0.6} 64 ${50 + dx} 42`} stroke="#D9A982" strokeWidth="1.4" fill="none" />)}
            <path d="M42 86 h16 l-2 6 h-12 z" fill="#E8BF98" />
          </>
        );
      case "sakura-shell":
        return (
          <>
            <defs><linearGradient id={g("s")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFE6EE" /><stop offset="1" stopColor="#F49AB8" /></linearGradient></defs>
            <Shadow rx={26} />
            <path d="M50 86 C 26 86 22 62 30 52 C 40 40 66 44 72 56 C 78 70 70 86 50 86 Z" fill={`url(#${g("s")})`} stroke="#E07FA0" strokeWidth="1.2" />
            <path d="M36 62 C 46 56 60 58 66 66" stroke="#FFFFFF" strokeWidth="2.4" fill="none" opacity="0.7" />
            <path d="M74 32 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" fill="#FFE07A" />
          </>
        );
      case "sunflower":
        return (
          <>
            <Shadow rx={22} />
            <path d="M50 92 L50 50" stroke="#5E9A44" strokeWidth="4" />
            <ellipse cx="38" cy="74" rx="11" ry="5" fill="#6CAE4E" transform="rotate(-30 38 74)" />
            {Array.from({ length: 14 }, (_, i) => <ellipse key={i} cx="50" cy="22" rx="5" ry="11" fill="#FFC62A" stroke="#E8A21A" strokeWidth="0.6" transform={`rotate(${i * 25.7} 50 36)`} />)}
            <circle cx="50" cy="36" r="10" fill="#7A4A22" />
            <circle cx="50" cy="36" r="10" fill="none" stroke="#5A3418" strokeDasharray="1.5 2" />
          </>
        );
      case "acorn":
      case "gold-acorn": {
        const gold = id === "gold-acorn";
        return (
          <>
            <defs>
              <radialGradient id={g("n")} cx="0.35" cy="0.35" r="0.8"><stop offset="0" stopColor={gold ? "#FFF2A8" : "#D99A5A"} /><stop offset="1" stopColor={gold ? "#D9A21A" : "#8A4E22"} /></radialGradient>
              <linearGradient id={g("c")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={gold ? "#C9921A" : "#8A6A44"} /><stop offset="1" stopColor={gold ? "#8A5E0A" : "#5E4428"} /></linearGradient>
            </defs>
            <Shadow rx={22} />
            <path d="M28 52 C 28 80 40 92 50 92 C 60 92 72 80 72 52 Z" fill={`url(#${g("n")})`} />
            <path d="M24 54 C 24 36 76 36 76 54 C 66 58 34 58 24 54 Z" fill={`url(#${g("c")})`} />
            <path d="M28 50 h44 M30 45 h40" stroke="#000" strokeOpacity="0.18" strokeDasharray="2 2" />
            <path d="M50 38 C 50 32 52 28 56 26" stroke={gold ? "#8A5E0A" : "#5E4428"} strokeWidth="3" strokeLinecap="round" fill="none" />
            <ellipse cx="40" cy="66" rx="5" ry="9" fill="#FFFFFF" opacity={gold ? 0.6 : 0.3} />
            {gold ? <path d="M78 30 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" fill="#FFF6C0" /> : null}
          </>
        );
      }
      case "maple":
        return (
          <>
            <defs><linearGradient id={g("m")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FF8A4A" /><stop offset="1" stopColor="#C8321E" /></linearGradient></defs>
            <Shadow rx={28} />
            <g transform="rotate(-12 50 56)">
              <path d="M50 18 L56 38 L74 30 L66 48 L84 52 L66 60 L72 74 L54 66 L50 82 L46 66 L28 74 L34 60 L16 52 L34 48 L26 30 L44 38 Z" fill={`url(#${g("m")})`} stroke="#A8281A" strokeWidth="1" strokeLinejoin="round" />
              <path d="M50 82 L50 94 M50 70 L50 26 M50 58 L30 40 M50 58 L70 40 M50 64 L24 54 M50 64 L76 54" stroke="#A8281A" strokeWidth="1.2" fill="none" />
            </g>
          </>
        );
      case "pinecone":
        return (
          <>
            <Shadow rx={22} />
            <ellipse cx="50" cy="60" rx="22" ry="32" fill="#7A4E2A" />
            {[[0, 36], [-10, 46], [10, 46], [0, 56], [-14, 60], [14, 60], [-8, 70], [8, 70], [0, 80], [-14, 76], [14, 76]].map(([dx, y], i) => (
              <path key={i} d={`M${50 + dx! - 7} ${y} q7 8 14 0 q-7 -3 -14 0 z`} fill="#A8723E" stroke="#5E3818" strokeWidth="0.8" />
            ))}
            <path d="M50 28 L50 22" stroke="#5E3818" strokeWidth="3" strokeLinecap="round" />
          </>
        );
      case "camellia":
        return (
          <>
            <Shadow rx={26} />
            <ellipse cx="30" cy="76" rx="14" ry="7" fill="#2F6A3A" transform="rotate(-20 30 76)" />
            <ellipse cx="70" cy="78" rx="14" ry="7" fill="#3F7A44" transform="rotate(20 70 78)" />
            {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx="50" cy="44" rx="13" ry="17" fill="#E0304A" stroke="#A81E30" strokeWidth="0.8" transform={`rotate(${r} 50 60)`} />)}
            <circle cx="50" cy="60" r="8" fill="#FFE07A" />
            {[0, 60, 120, 180, 240, 300].map((r) => <circle key={r} cx="50" cy="53" r="1.6" fill="#F2B21A" transform={`rotate(${r} 50 60)`} />)}
          </>
        );
      case "nanten":
        return (
          <>
            <Shadow rx={26} />
            <path d="M50 92 C 48 72 46 56 40 40 M48 62 C 58 54 64 46 66 34" stroke="#6A4A2A" strokeWidth="2.4" fill="none" />
            {[[30, 70, -40], [66, 66, 30], [58, 82, 10]].map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx="10" ry="4.5" fill="#4E8A3A" transform={`rotate(${r} ${x} ${y})`} />)}
            {[[38, 36], [44, 32], [36, 28], [42, 40], [64, 30], [70, 34], [66, 24], [60, 36]].map(([x, y], i) => (
              <g key={i}><circle cx={x} cy={y} r="5" fill="#D8202A" /><circle cx={x! - 1.6} cy={y! - 1.6} r="1.4" fill="#FFFFFF" opacity="0.7" /></g>
            ))}
          </>
        );
      case "snow-crystal":
        return (
          <>
            <defs><radialGradient id={g("i")} cx="0.4" cy="0.35" r="0.8"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#9FD4F2" /></radialGradient></defs>
            <Shadow rx={24} />
            <g transform="translate(50 54)">
              {[0, 60, 120].map((r) => (
                <g key={r} transform={`rotate(${r})`}>
                  <path d="M0 -34 L0 34" stroke={`url(#${g("i")})`} strokeWidth="6" strokeLinecap="round" />
                  <path d="M0 -22 l-9 -8 M0 -22 l9 -8 M0 22 l-9 8 M0 22 l9 8" stroke="#BFE6FA" strokeWidth="3.6" strokeLinecap="round" />
                </g>
              ))}
              <circle r="7" fill="#E6F6FF" stroke="#9FD4F2" strokeWidth="1.4" />
            </g>
            <path d="M80 24 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" fill="#FFE07A" />
          </>
        );
    }
  })();
  return <svg viewBox="0 0 100 100" className={SVG_CLASS} {...a11y}>{body}</svg>;
}
