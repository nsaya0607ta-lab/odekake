import type { Kind } from "@/lib/games/frenchie-town/state";

export function Coin({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><circle cx="12" cy="13" r="10" fill="#cbb988"/><circle cx="12" cy="11" r="9.3" fill="#fff9e9" stroke="#d6c49b" strokeWidth="1.4"/><circle cx="12" cy="11" r="6.8" fill="#f3f0e6" stroke="#e4d7b8"/><path d="m12 6 1.6 3.3 3.7.5-2.7 2.6.7 3.6-3.3-1.7-3.3 1.7.7-3.6-2.7-2.6 3.7-.5Z" fill="#cabb91"/><path d="M6 7.5a7 7 0 0 1 6-3.5" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="2"/></svg>;
}

export function TownArt({ kind, className = "" }: { kind: Kind; className?: string }) {
  const roof = ({ house: "#eaa28e", bakery: "#e5b46e", cafe: "#8cb9bc", onsen: "#bda1c5", windmill: "#c6957b", tree: "#89bb92", flowers: "#e9a9bc", bench: "#c79775", fountain: "#8ac8d2", lamp: "#819489" })[kind];
  return <svg viewBox="0 0 90 78" className={className} aria-hidden="true">
    <ellipse cx="45" cy="65" rx="32" ry="8" fill="#749888" opacity=".12"/>
    <path d="m12 58 33-16 33 16-33 16Z" fill="#d4d8b4"/>
    {(["house", "bakery", "cafe", "windmill"] as Kind[]).includes(kind) ? <>
      <path d="m24 32 22-12 22 12v26L46 69 24 56Z" fill="#f8e7cd"/>
      <path d="m46 43 22-11v26L46 69Z" fill="#d7c2a4"/>
      <path d="M19 32 44 14l29 17-25 14Z" fill={roof}/><path d="m44 14 29 17-25 14Z" fill="#725d59" opacity=".16"/>
      <path d="m31 45 9 4v15l-9-4Z" fill="#b3957a"/><path d="m53 46 10-5v10l-10 5Z" fill="#a6d3d4" stroke="#f7e9d5" strokeWidth="2"/>
      {(kind === "bakery" || kind === "cafe") ? <><path d="m24 40 23 12 3 6-28-14Z" fill={roof}/><path d="m28 42 4 2-2 3-4-2m8 1 4 2-2 3-4-2m8 1 4 2-2 3-4-2" fill="#fff4e1"/></> : null}
      {kind === "windmill" ? <g stroke="#eee4cc" strokeWidth="5" strokeLinecap="round"><path d="m49 23-16 28m2-27 27 24"/><circle cx="47" cy="36" r="4" fill="#a58466" strokeWidth="1"/></g> : null}
    </> : kind === "tree" ? <><path d="M42 31h7v32h-7Z" fill="#b99070"/><ellipse cx="47" cy="29" rx="21" ry="24" fill={roof}/><ellipse cx="38" cy="22" rx="12" ry="16" fill="#a2cca5"/></> : kind === "flowers" ? <><path d="m18 51 30-14 27 13-28 16Z" fill="#b18d72"/><path d="m18 51 29 15v7L18 58m29 8 28-16v7L47 73" fill="#c5a082"/>{[28, 43, 59].map((x, i) => <g key={x}><path d={`M${x} 49v-15`} stroke="#89a77d" strokeWidth="3"/><circle cx={x} cy={32 + i * 2} r="8" fill={["#edb0bd", "#ead080", "#bcabd1"][i]}/><circle cx={x} cy={32 + i * 2} r="3" fill="#fff0c3"/></g>)}</> : kind === "bench" ? <><path d="m22 47 35-17 11 9-35 17Z" fill={roof}/><path d="m24 32 34-16 4 16-34 16Z" fill="#dbb18a"/><path d="m24 46 1 16m34-32 1 17m-28 7v14m34-22v14" stroke="#76847c" strokeWidth="4"/></> : kind === "lamp" ? <><path d="M45 28v36" stroke="#71887d" strokeWidth="5"/><path d="m36 19 10-6 10 6v18l-10 6-10-6Z" fill="#fff0b8"/><path d="m33 19 13-11 13 11-13 7Z" fill={roof}/><path d="m46 26 10-7v18l-10 6Z" fill="#eddba4"/></> : kind === "onsen" ? <><path d="m18 51 27-14 29 15-27 15Z" fill="#d8c1a5"/><path d="m24 50 21-9 24 11-22 11Z" fill="#9dd1d2"/><path d="M23 43V23m44 21V24" stroke="#ae8e72" strokeWidth="4"/><path d="m15 23 29-15 31 16-28 14Z" fill={roof}/><path d="M40 46q-7-9 0-15m11 21q-7-9 0-15" fill="none" stroke="#fff6e4" strokeWidth="3" strokeLinecap="round"/></> : <><ellipse cx="45" cy="57" rx="26" ry="12" fill="#c1baa8"/><ellipse cx="45" cy="53" rx="23" ry="11" fill="#9bced2"/><path d="M45 32v21" stroke="#d9d5c0" strokeWidth="9"/><ellipse cx="45" cy="33" rx="12" ry="5" fill="#e7dfc9"/><path d="M45 29q-7-8 0-18 7 10 0 18" fill="#a1d1d7"/></>}
  </svg>;
}
