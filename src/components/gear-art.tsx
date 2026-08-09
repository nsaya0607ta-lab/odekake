/**
 * そうび（レベルアップ報酬のアクセサリー）の絵。
 *
 * 犬の絵は差し替えできる素材を持たないため、実際の見た目には反映されない。
 * ここでは装着状況をこの画面の中だけで示すための小さいアイコンを描いている。
 * `level` は src/lib/exp.ts の LEVEL_REWARDS のレベルと対応する。
 */

type GearIconProps = { level: number; className?: string };

function Collar({ color }: { color: string }) {
  return (
    <>
      <path
        d="M4.5 12a7.5 6 0 0 1 15 0 7.5 6 0 0 1-15 0Z"
        fill="none"
        stroke={color}
        strokeWidth={2.4}
      />
      <circle cx="12" cy="18.2" r="1.9" fill={color} />
    </>
  );
}

function Bandana({ color, pattern }: { color: string; pattern: "flower" | "wave" }) {
  return (
    <>
      <path d="M3.5 6h17L12 19.5Z" fill={color} />
      {pattern === "flower" ? (
        <g fill="#fffaf0">
          <circle cx="12" cy="10.5" r="1.3" />
          <circle cx="9.6" cy="8.6" r="1" />
          <circle cx="14.4" cy="8.6" r="1" />
          <circle cx="9.9" cy="12.3" r="1" />
          <circle cx="14.1" cy="12.3" r="1" />
        </g>
      ) : (
        <g stroke="#fffaf0" strokeWidth={1.1} fill="none" opacity={0.9}>
          <path d="M7 8.5c1 1 2 1 3 0s2-1 3 0 2 1 3 0" />
          <path d="M8.5 11.5c.8.8 1.6.8 2.4 0s1.6-.8 2.4 0" />
        </g>
      )}
    </>
  );
}

function Backpack({ color, strapColor }: { color: string; strapColor: string }) {
  return (
    <>
      <rect x="5.5" y="10.5" width="13" height="10.5" rx="3.5" fill={color} />
      <rect x="7.5" y="7.5" width="9" height="4.5" rx="2" fill={color} />
      <path
        d="M9 10.3V8a1.6 1.6 0 0 1 3.2 0M14.8 10.3V8"
        fill="none"
        stroke={strapColor}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <rect x="9" y="14.5" width="6" height="4.2" rx="1.4" fill={strapColor} opacity={0.85} />
    </>
  );
}

function StrawHat() {
  return (
    <>
      <ellipse cx="12" cy="16" rx="9.5" ry="2.6" fill="#d9b978" />
      <path d="M6 15.2a6 4.6 0 0 1 12 0z" fill="#e8ce97" stroke="#c9a662" strokeWidth={1} />
      <path d="M8 14.6h8" stroke="#5d8049" strokeWidth={1.4} strokeLinecap="round" />
    </>
  );
}

function CaptainHat() {
  return (
    <>
      <ellipse cx="12" cy="16.4" rx="9" ry="2.2" fill="#2f4054" />
      <path d="M5.5 15.6a6.5 5 0 0 1 13 0z" fill="#fffaf0" stroke="#5b4b38" strokeWidth=".8" />
      <rect x="7.5" y="13" width="9" height="2.4" rx="1.1" fill="#2f4054" />
      <path d="M10.7 13.2 12 11.6l1.3 1.6" fill="none" stroke="#e0b862" strokeWidth={1.1} />
    </>
  );
}

function Crown() {
  return (
    <>
      <path
        d="M4 17.5 5.5 8l3.7 4.6L12 6l2.8 6.6L18.5 8 20 17.5Z"
        fill="#c94f45"
        stroke="#d9a13c"
        strokeWidth={1.2}
      />
      <rect x="4" y="17" width="16" height="2.4" rx="1" fill="#e0ab41" />
      <circle cx="12" cy="12.6" r="1.3" fill="#dd9aa6" />
      <circle cx="7.4" cy="13.6" r="1" fill="#7fa8c9" />
      <circle cx="16.6" cy="13.6" r="1" fill="#7fa8c9" />
    </>
  );
}

/** レベルに対応するそうびの絵。未対応のレベルは何も描かない */
export function GearIcon({ level, className }: GearIconProps) {
  const inner = (() => {
    switch (level) {
      case 4:
        return <Collar color="#7fa568" />;
      case 11:
        return <Collar color="#e2a377" />;
      case 21:
        return <Collar color="#263f67" />;
      case 6:
        return <Bandana color="#78965d" pattern="flower" />;
      case 15:
        return <Bandana color="#7fa8c9" pattern="wave" />;
      case 9:
        return <Backpack color="#758d55" strapColor="#a9bd78" />;
      case 25:
        return <Backpack color="#b98d54" strapColor="#e0b86e" />;
      case 18:
        return <StrawHat />;
      case 27:
        return <CaptainHat />;
      case 30:
        return <Crown />;
      default:
        return null;
    }
  })();

  if (!inner) return null;

  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {inner}
    </svg>
  );
}
