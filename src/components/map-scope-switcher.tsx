import Link from "next/link";
import { IconCheck, IconChevronDown, IconLayers } from "@/components/icons";
import { PERSONAL_MAP_SCOPE, type MapScopeOption } from "@/lib/data/map-scope";

export function MapScopeSwitcher({
  options,
  selectedValue,
}: {
  options: MapScopeOption[];
  selectedValue: string;
}) {
  return (
    <details className="group relative shrink-0">
      <summary className="pressable flex h-9 cursor-pointer list-none items-center gap-1 rounded-full border border-leaf bg-card px-3 text-xs font-semibold text-leaf-deep shadow-sm [&::-webkit-details-marker]:hidden">
        <IconLayers size={15} />
        地図を変更
        <IconChevronDown size={13} className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute top-11 right-0 z-50 w-64 overflow-hidden rounded-2xl border border-line bg-card p-2 shadow-lg">
        <p className="px-3 pt-1 pb-2 text-[11px] font-semibold text-ink-faint">表示する旅を選択</p>
        <nav aria-label="表示する地図" className="max-h-[60vh] overflow-y-auto overscroll-contain">
          {options.map((option) => {
            const selected = option.value === selectedValue;
            const href = option.value === PERSONAL_MAP_SCOPE ? "/map" : `/map?trip=${option.value}`;
            return (
              <Link
                key={option.value}
                href={href}
                aria-current={selected ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors active:bg-paper-deep ${
                  selected ? "bg-leaf-soft font-semibold text-leaf-deep" : "text-ink"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] leading-tight text-ink-faint">
                    {option.kind === "personal" ? "個人の旅" : "共有旅"}
                  </span>
                  <span className="block truncate">{option.name}</span>
                </span>
                {selected ? <IconCheck size={16} className="shrink-0" /> : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </details>
  );
}
