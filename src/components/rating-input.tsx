"use client";

import { useRef } from "react";
import { IconStar } from "./icons";
import { useDraftState } from "./use-draft-state";

export function RatingInput({
  name,
  defaultValue = 0,
  label = "評価",
  draftKey = null,
}: {
  name: string;
  defaultValue?: number;
  label?: string;
  /** 指定すると、画面を離れても選んだ評価を覚えておく */
  draftKey?: string | null;
}) {
  // 評価は hidden input で送るため、FormDraft の DOM 復元では戻せない。
  // React 側が値を持っているので、このコンポーネント自身で下書きを保存する。
  const rootRef = useRef<HTMLFieldSetElement>(null);
  const [value, setValue] = useDraftState(draftKey, defaultValue, rootRef);

  return (
    <fieldset ref={rootRef}>
      <legend className="field-label">
        {label}
        <span className="ml-1.5 text-[11px] font-normal text-ink-faint">（任意）</span>
      </legend>
      <input type="hidden" name={name} value={value || ""} />
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n}点`}
            aria-pressed={value === n}
            onClick={() => setValue((current) => (current === n ? 0 : n))}
            className="p-1.5 text-sun transition-transform active:scale-90"
          >
            <IconStar size={30} filled={n <= value} strokeWidth={1.4} />
          </button>
        ))}
        <span className="ml-2 text-sm text-ink-soft tabular-nums">{value > 0 ? `（${value}）` : "未評価"}</span>
      </div>
    </fieldset>
  );
}
