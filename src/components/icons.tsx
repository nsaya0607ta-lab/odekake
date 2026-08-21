import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 22, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 10.5 12 4l8 6.5" />
    <path d="M6 10v9h12v-9" />
    <path d="M10 19v-5h4v5" />
  </Base>
);

export const IconMapPin = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 21c4-4.6 6-7.9 6-10.6A6 6 0 0 0 6 10.4C6 13.1 8 16.4 12 21Z" />
    <circle cx="12" cy="10.3" r="2.2" />
  </Base>
);

export const IconPlus = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconNotebook = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3.5" />
    <path d="M8.5 10.5 11 13l4.5-4.5" />
  </Base>
);

export const IconUser = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="8.5" r="3.4" />
    <path d="M5 20c1.3-3.4 4-5 7-5s5.7 1.6 7 5" />
  </Base>
);

export const IconUsers = (p: IconProps) => (
  <Base {...p}>
    <circle cx="9.5" cy="9" r="3" />
    <path d="M3.5 19c1-2.8 3.3-4.2 6-4.2s5 1.4 6 4.2" />
    <path d="M16 6.4a2.9 2.9 0 0 1 0 5.4" />
    <path d="M17.4 14.9c1.6.6 2.7 1.9 3.3 4.1" />
  </Base>
);

export const IconChevronLeft = (p: IconProps) => (
  <Base {...p}>
    <path d="M14.5 5 8 12l6.5 7" />
  </Base>
);

export const IconChevronRight = (p: IconProps) => (
  <Base {...p}>
    <path d="M9.5 5 16 12l-6.5 7" />
  </Base>
);

export const IconChevronDown = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 9.5 12 16l7-6.5" />
  </Base>
);

export const IconHeart = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Base {...p} fill={filled ? "currentColor" : "none"}>
    <path d="M12 20s-7-4.4-7-9.1A3.9 3.9 0 0 1 12 8.3a3.9 3.9 0 0 1 7 2.6C19 15.6 12 20 12 20Z" />
  </Base>
);

export const IconStar = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Base {...p} fill={filled ? "currentColor" : "none"}>
    <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8Z" />
  </Base>
);

export const IconCamera = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 8.5h3.2L9 6h6l1.8 2.5H20a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.2" r="3.2" />
  </Base>
);

export const IconCalendar = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="5.5" width="17" height="15" rx="3" />
    <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
  </Base>
);

export const IconClock = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.2" />
    <path d="M12 7.6V12l3 1.8" />
  </Base>
);

export const IconTrash = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.5 7h15M9.5 7V4.8h5V7M6.8 7l.8 12.2h8.8L17.2 7" />
  </Base>
);

export const IconCheck = (p: IconProps) => (
  <Base {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Base>
);

export const IconClose = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const IconSearch = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.2" />
    <path d="m15.6 15.6 4 4" />
  </Base>
);

export const IconFlag = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 20V4.8" />
    <path d="M6 5.4c3.4-1.6 6.6 1.6 10 0v7c-3.4 1.6-6.6-1.6-10 0Z" />
  </Base>
);

export const IconGlobe = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.2" />
    <path d="M3.8 12h16.4" />
    <path d="M12 3.8c2.2 2.4 3.3 5.1 3.3 8.2S14.2 17.8 12 20.2c-2.2-2.4-3.3-5.1-3.3-8.2S9.8 6.2 12 3.8Z" />
  </Base>
);

export const IconYen = (p: IconProps) => (
  <Base {...p}>
    <path d="M7 5.5 12 12l5-6.5" />
    <path d="M8 12.6h8M8 15.6h8M12 12v7" />
  </Base>
);

export const IconLayers = (p: IconProps) => (
  <Base {...p}>
    <path d="m12 4 8 4.2-8 4.2-8-4.2L12 4Z" />
    <path d="m4 13.4 8 4.2 8-4.2" />
  </Base>
);

export const IconSliders = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 8h10M18 8h2M4 16h4M12 16h8" />
    <circle cx="16" cy="8" r="2" />
    <circle cx="10" cy="16" r="2" />
  </Base>
);

export const IconLeaf = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 19c0-7 4.5-12 14-12 0 8.5-5 13-11 13" />
    <path d="M8.5 15.5c1.8-2.6 4-4.4 7-5.5" />
  </Base>
);

export const IconMail = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="3" />
    <path d="m4.5 8 7.5 5 7.5-5" />
  </Base>
);

export const IconLogout = (p: IconProps) => (
  <Base {...p}>
    <path d="M14 5.5H6.5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1H14" />
    <path d="M16.5 8.5 20 12l-3.5 3.5M10 12h10" />
  </Base>
);

export const IconSpinner = (p: IconProps) => (
  <Base {...p} className={`animate-spin ${p.className ?? ""}`}>
    <path d="M12 4a8 8 0 1 1-5.7 2.4" />
  </Base>
);

export const IconChat = (p: IconProps) => (
  <Base {...p}>
    <path d="M20.2 12c0 3.8-3.7 6.9-8.2 6.9-1 0-2-.2-2.9-.5l-4.3 1.4 1.4-3.6C4.7 15 3.8 13.6 3.8 12c0-3.8 3.7-6.9 8.2-6.9s8.2 3.1 8.2 6.9Z" />
  </Base>
);

/** おでかけコイン（肉球入りの金貨）。金色は固定で、currentColor には従わない */
export const IconCoin = ({ size = 22, ...p }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...p}>
    <circle cx="12" cy="12.5" r="9.4" fill="#e0ab41" />
    <circle cx="12" cy="11.8" r="9.4" fill="#f5cd74" />
    <circle cx="12" cy="11.8" r="6.8" fill="#efbe58" opacity={0.55} />
    <g fill="#fffaf0">
      <ellipse cx="12" cy="13.6" rx="2.9" ry="2.3" />
      <circle cx="8.4" cy="10.7" r="1.2" />
      <circle cx="10.6" cy="8.9" r="1.3" />
      <circle cx="13.4" cy="8.9" r="1.3" />
      <circle cx="15.6" cy="10.7" r="1.2" />
    </g>
  </svg>
);

/** 肉球 */
export const IconPaw = ({ size = 22, ...p }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <ellipse cx="12" cy="16" rx="4.3" ry="3.5" />
    <circle cx="6.6" cy="11.4" r="1.9" />
    <circle cx="9.9" cy="8.4" r="2.1" />
    <circle cx="14.1" cy="8.4" r="2.1" />
    <circle cx="17.4" cy="11.4" r="1.9" />
  </svg>
);

export const IconBag = (p: IconProps) => (
  <Base {...p}>
    <path d="M5.5 8.5h13l1 11.5h-15z" />
    <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
  </Base>
);

export const IconQuestion = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.8 9.6A2.3 2.3 0 0 1 12 8c1.4 0 2.3.9 2.3 2.1 0 1.6-2.3 1.7-2.3 3.4" />
    <path d="M12 16.6h.01" />
  </Base>
);

export const IconImage = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
    <circle cx="9" cy="9.8" r="1.6" />
    <path d="m5.5 17 4.8-5.2a1.4 1.4 0 0 1 2.1.05L15 15.4l1.2-1.3a1.4 1.4 0 0 1 2.1 0l2.2 2.4" />
  </Base>
);

export const IconSend = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.5 12 19.5 4.5 15 19.5l-3.6-6.4L4.5 12Z" />
    <path d="M11.4 13.1 19.5 4.5" />
  </Base>
);

export const IconInfo = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.2" />
    <path d="M12 7.8h.01" />
  </Base>
);

export const IconClipboard = (p: IconProps) => (
  <Base {...p}>
    <rect x="5.5" y="4.5" width="13" height="15" rx="2.5" />
    <path d="M9.5 4.5V3h5v1.5" />
    <path d="M9 10h6M9 13.5h4" />
  </Base>
);

export const IconLock = (p: IconProps) => (
  <Base {...p}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2.4" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </Base>
);

export const IconSettings = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="2.8" />
    <path d="M12 3.6v2.1M12 18.3v2.1M20.4 12h-2.1M5.7 12H3.6M17.4 6.6l-1.5 1.5M8.1 15.9l-1.5 1.5M17.4 17.4l-1.5-1.5M8.1 8.1 6.6 6.6" />
  </Base>
);

export const IconMenu = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Base>
);

export const IconMore = ({ size = 22, ...p }: IconProps) => (
  <Base size={size} {...p}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </Base>
);
