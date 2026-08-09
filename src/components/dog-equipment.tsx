import type { EquipmentMap } from "@/lib/data/equipment";

type Props = {
  equipment: EquipmentMap;
  pose?: string;
  className?: string;
};

type PoseProfile = {
  head: string;
  neck: string;
  back: string;
};

const DEFAULT_PROFILE: PoseProfile = {
  head: "translate(0 0)",
  neck: "translate(0 0)",
  back: "translate(0 0)",
};

/**
 * All Frenchie pose assets use the same 300 x 254 canvas, but the dog changes posture.
 * These small corrections keep each accessory attached to the same body part instead of
 * floating at a fixed screen position.
 */
const POSE_PROFILES: Record<string, PoseProfile> = {
  stand: DEFAULT_PROFILE,
  happy: { head: "translate(0 1)", neck: "translate(0 2)", back: "translate(1 0)" },
  walk: { head: "translate(-6 2)", neck: "translate(-7 3)", back: "translate(-2 1)" },
  sit: { head: "translate(-2 1)", neck: "translate(-2 3)", back: "translate(0 4)" },
  shake: { head: "translate(-3 7) rotate(-2 120 62)", neck: "translate(-3 9)", back: "translate(0 6)" },
  wink: { head: "translate(-2 1) rotate(-3 120 62)", neck: "translate(-2 2)", back: "translate(0 1)" },
  wave: { head: "translate(-5 0) rotate(-7 120 62)", neck: "translate(-5 4)", back: "translate(-1 2)" },
  camera: { head: "translate(-3 2)", neck: "translate(-3 5)", back: "translate(0 3)" },
  cheer: { head: "translate(-7 1) rotate(-7 120 62)", neck: "translate(-5 5)", back: "translate(-2 2)" },
  smile: { head: "translate(-1 2)", neck: "translate(-1 4)", back: "translate(0 2)" },
  treat: { head: "translate(0 3)", neck: "translate(0 5)", back: "translate(1 2)" },
  yawn: { head: "translate(-4 6)", neck: "translate(-4 7)", back: "translate(0 4)" },
  sniff: { head: "translate(-7 55) rotate(-8 120 62)", neck: "translate(-6 42) rotate(-5 120 112)", back: "translate(-1 5)" },
  bow: { head: "translate(-5 58) rotate(-10 120 62)", neck: "translate(-5 46) rotate(-7 120 112)", back: "translate(0 9)" },
  dig: { head: "translate(-7 50) rotate(-8 120 62)", neck: "translate(-6 39) rotate(-5 120 112)", back: "translate(-1 5)" },
  drink: { head: "translate(-6 40) rotate(-8 120 62)", neck: "translate(-6 31) rotate(-5 120 112)", back: "translate(0 5)" },
  doze: { head: "translate(0 70) rotate(-7 120 62)", neck: "translate(0 56)", back: "translate(-4 29) rotate(-4 200 118)" },
  roll: { head: "translate(-1 79) rotate(-18 120 62)", neck: "translate(0 61) rotate(-14 120 112)", back: "translate(-5 36) rotate(-12 200 118)" },
  lieWave: { head: "translate(1 74) rotate(-8 120 62)", neck: "translate(0 58)", back: "translate(-3 27) rotate(-4 200 118)" },
};

const outline = "#5b4b38";
const HAT_FIT = "translate(12 -14) scale(.9)";
const CROWN_FIT = "translate(12 -2) scale(.9)";
const NECK_FIT = "translate(19 61) scale(.83)";
const BACK_FIT = "translate(35 30) scale(.78)";

function Headwear({ level }: { level: number }) {
  if (level === 18) {
    return (
      <g>
        <ellipse cx="120" cy="72" rx="67" ry="12" fill="#d6ab62" stroke={outline} strokeWidth="3" />
        <path d="M78 67c4-34 80-36 86 0-22 10-63 10-86 0Z" fill="#edcf8b" stroke={outline} strokeWidth="3" />
        <path d="M82 58c22 7 54 7 78 0" fill="none" stroke="#66804e" strokeWidth="9" />
        <path d="M151 54c9-9 17-8 20-2-8 1-11 4-13 10" fill="#7f9b62" stroke={outline} strokeWidth="2" />
        <path d="M154 56c4 1 8 4 11 8" fill="none" stroke="#526a43" strokeWidth="2" />
      </g>
    );
  }

  if (level === 27) {
    return (
      <g>
        <path d="M69 61c9-37 90-39 102 0-28 12-72 12-102 0Z" fill="#fffaf0" stroke={outline} strokeWidth="3" />
        <path d="M73 58c27 9 69 9 94 0l-3 14c-27 9-61 9-88 0Z" fill="#2f4054" stroke={outline} strokeWidth="3" />
        <path d="M64 73c29-8 83-8 112 0-6 9-19 13-33 13H94c-14 0-24-4-30-13Z" fill="#26384b" stroke={outline} strokeWidth="3" />
        <path d="M112 42h16m-8-7v15" stroke="#c69a43" strokeWidth="3" strokeLinecap="round" />
        <path d="M114 49c6 5 7 9 6 13 5-2 8-7 7-13" fill="none" stroke="#c69a43" strokeWidth="2.5" />
      </g>
    );
  }

  return null;
}

function Crown() {
  return (
    <g>
      <path d="M78 65 75 25l24 18 20-30 20 30 25-18-3 40Z" fill="#c94f45" stroke={outline} strokeWidth="3" />
      <path d="M79 55h82v17H79Z" fill="#e5b74f" stroke={outline} strokeWidth="3" />
      <path d="M81 31 98 48l21-30 20 30 20-17" fill="none" stroke="#efc96b" strokeWidth="5" />
      <circle cx="96" cy="63" r="4" fill="#6ca0b8" />
      <circle cx="120" cy="63" r="4" fill="#e98a87" />
      <circle cx="144" cy="63" r="4" fill="#6ca0b8" />
      <circle cx="75" cy="24" r="5" fill="#e9c35f" stroke={outline} strokeWidth="2" />
      <circle cx="119" cy="13" r="5" fill="#e9c35f" stroke={outline} strokeWidth="2" />
      <circle cx="164" cy="24" r="5" fill="#e9c35f" stroke={outline} strokeWidth="2" />
    </g>
  );
}

function Collar({ level }: { level: number }) {
  const color = level === 11 ? "#d8875d" : level === 21 ? "#263f67" : "#75925c";
  const tag = level === 11 ? "#efb55b" : level === 21 ? "#e4b64e" : "#6f9258";
  return (
    <g>
      <path d="M79 103c20 14 58 17 83-1l-2 15c-24 16-58 16-80 1Z" fill={color} stroke={outline} strokeWidth="3" />
      {level === 21 ? (
        <g fill="#f4d172">
          <circle cx="96" cy="111" r="2" />
          <path d="m112 107 2 4 4 .5-3 3 .8 4.5-3.8-2-4 2 .9-4.5-3-3 4.2-.5Z" />
          <circle cx="135" cy="111" r="2" />
          <path d="m149 107 2 4 4 .5-3 3 .8 4.5-3.8-2-4 2 .9-4.5-3-3 4.2-.5Z" />
        </g>
      ) : null}
      {level === 4 ? <path d="M91 109c18 7 39 7 57-1" fill="none" stroke="#a8bd89" strokeWidth="3" strokeDasharray="7 7" /> : null}
      {level === 11 ? <path d="M88 111h65" stroke="#f0b28d" strokeWidth="3" strokeLinecap="round" /> : null}
      <path d="M119 118v10" stroke="#b48739" strokeWidth="3" />
      {level === 4 ? (
        <path d="M111 132c8-10 18-8 18-8 0 9-5 16-14 17-3-2-4-5-4-9Z" fill={tag} stroke={outline} strokeWidth="2" />
      ) : level === 21 ? (
        <path d="m120 125 5 9 10 1-7 7 2 10-10-5-9 5 2-10-8-7 11-1Z" fill={tag} stroke={outline} strokeWidth="2" />
      ) : (
        <circle cx="120" cy="135" r="9" fill={tag} stroke={outline} strokeWidth="2" />
      )}
    </g>
  );
}

function Bandana({ level }: { level: number }) {
  const blue = level === 15;
  return (
    <g>
      <path d="M77 103c22 14 62 15 86-2l-9 23-32 40-34-40Z" fill={blue ? "#77afd0" : "#78965d"} stroke={outline} strokeWidth="3" strokeLinejoin="round" />
      <path d="M82 109c23 12 53 12 76-1" fill="none" stroke={blue ? "#a9d0e3" : "#9fba7d"} strokeWidth="4" />
      {blue ? (
        <g fill="#f8f7e9" opacity=".95">
          <path d="M94 127c1-6 10-7 13-2 5-4 13 0 12 6H94Z" />
          <path d="M126 144c1-6 10-7 13-2 5-4 13 0 12 6h-25Z" />
        </g>
      ) : (
        <g fill="#f6e9b5">
          <g transform="translate(103 128)"><circle r="3" fill="#e6ae5f" /><circle cx="0" cy="-6" r="4" /><circle cx="6" r="4" /><circle cy="6" r="4" /><circle cx="-6" r="4" /></g>
          <g transform="translate(136 140) scale(.8)"><circle r="3" fill="#e6ae5f" /><circle cx="0" cy="-6" r="4" /><circle cx="6" r="4" /><circle cy="6" r="4" /><circle cx="-6" r="4" /></g>
        </g>
      )}
      <path d="M158 108c11-4 20 2 22 10-8-1-14 2-19 9" fill={blue ? "#77afd0" : "#78965d"} stroke={outline} strokeWidth="2.5" />
    </g>
  );
}

function Backpack({ level }: { level: number }) {
  const explorer = level === 25;
  const body = explorer ? "#b98d54" : "#758d55";
  const trim = explorer ? "#e0b86e" : "#a9bd78";
  return (
    <g>
      <path d="M164 105c-5-21 4-35 23-40 19-5 47 5 57 23 8 14 8 60-3 71-13 13-61 5-70-6-6-8-4-32-7-48Z" fill={body} stroke={outline} strokeWidth="4" />
      <path d="M178 73c7-17 32-24 47-8" fill="none" stroke={trim} strokeWidth="8" strokeLinecap="round" />
      <path d="M170 99c22 5 49 2 70-8M180 105v51M231 99v58" fill="none" stroke={trim} strokeWidth="5" />
      <rect x="190" y="112" width="34" height="29" rx="7" fill={explorer ? "#d9ae69" : "#91a968"} stroke={outline} strokeWidth="3" />
      {explorer ? (
        <g>
          <circle cx="207" cy="126" r="10" fill="#f4ead1" stroke={outline} strokeWidth="2" />
          <path d="m207 117 3 7 6 2-6 3-3 7-2-7-7-3 7-2Z" fill="#6d9cb5" />
          <path d="M170 127c-15-7-17-31-6-40" fill="none" stroke="#8b653e" strokeWidth="5" strokeLinecap="round" />
        </g>
      ) : (
        <path d="M199 127c4-7 12-7 16 0-2 5-6 8-8 9-3-1-7-4-8-9Z" fill="#e4bd69" />
      )}
      <path d="M239 106c13 2 17 11 13 23l-5 19c-2 8-9 12-16 9" fill={body} stroke={outline} strokeWidth="3" />
    </g>
  );
}

/** Draws the unlocked reward as clothing on the dog's 300 x 254 illustration canvas. */
export function DogEquipment({ equipment, pose = "stand", className }: Props) {
  const profile = POSE_PROFILES[pose] ?? DEFAULT_PROFILE;
  const headLevel = equipment.crown ?? equipment.hat;
  const neckLevel = equipment.bandana ?? equipment.collar;
  const backpackLevel = equipment.backpack;

  if (headLevel === undefined && neckLevel === undefined && backpackLevel === undefined) return null;

  return (
    <svg
      viewBox="0 0 300 254"
      className={className}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <g style={{ filter: "drop-shadow(0 2px 1px rgb(91 75 56 / 0.18))" }}>
        {backpackLevel !== undefined ? (
          <g transform={profile.back}><g transform={BACK_FIT}><Backpack level={backpackLevel} /></g></g>
        ) : null}
        {neckLevel !== undefined ? (
          <g transform={profile.neck}>
            <g transform={NECK_FIT}>
              {equipment.bandana !== undefined ? <Bandana level={neckLevel} /> : <Collar level={neckLevel} />}
            </g>
          </g>
        ) : null}
        {headLevel !== undefined ? (
          <g transform={profile.head}>
            <g transform={equipment.crown !== undefined ? CROWN_FIT : HAT_FIT}>
              {equipment.crown !== undefined ? <Crown /> : <Headwear level={headLevel} />}
            </g>
          </g>
        ) : null}
      </g>
    </svg>
  );
}
