"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconChevronDown, IconLayers } from "@/components/icons";

export type JourneyScopeOption = {
  value: string;
  name: string;
  kind: "personal" | "shared";
};

export function JourneyScopeSwitcher({
  options,
  selectedValue,
  basePath,
  queryKey = "trip",
  triggerLabel = "旅を切り替え",
  preserveParams = {},
}: {
  options: JourneyScopeOption[];
  selectedValue: string;
  basePath: string;
  queryKey?: string;
  triggerLabel?: string;
  preserveParams?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [optimisticValue, setOptimisticValue] = useState(selectedValue);
  const [isPending, startTransition] = useTransition();
  const dialogTitleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedButtonRef = useRef<HTMLButtonElement>(null);

  const hrefs = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of options) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(preserveParams)) {
        if (value) params.set(key, value);
      }
      if (option.kind === "shared") params.set(queryKey, option.value);
      const query = params.toString();
      map.set(option.value, query ? `${basePath}?${query}` : basePath);
    }
    return map;
  }, [basePath, options, preserveParams, queryKey]);

  useEffect(() => {
    setOptimisticValue(selectedValue);
  }, [selectedValue]);

  // メニューを開く前に遷移先を先読みする。
  // ダイアログ内のLinkは開くまでDOMに存在しなかったため、従来はタップ後に初めて取得が始まっていた。
  useEffect(() => {
    for (const href of new Set(hrefs.values())) router.prefetch(href);
  }, [hrefs, router]);

  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const root = document.documentElement;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      overscrollBehavior: root.style.overscrollBehavior,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => selectedButtonRef.current?.focus());

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      root.style.overscrollBehavior = previous.overscrollBehavior;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  function selectOption(option: JourneyScopeOption) {
    if (option.value === optimisticValue) {
      setOpen(false);
      return;
    }

    const href = hrefs.get(option.value);
    if (!href) return;

    // まず見た目だけ即時に切り替え、その後のサーバー更新はtransitionで行う。
    setOptimisticValue(option.value);
    setOpen(false);
    startTransition(() => router.push(href, { scroll: false }));
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={isPending}
        onClick={() => setOpen(true)}
        className={`pressable flex h-9 shrink-0 items-center gap-1 rounded-full border bg-card px-3 text-xs font-semibold shadow-sm transition-colors ${
          isPending ? "border-leaf bg-leaf-soft text-leaf-deep" : "border-leaf text-leaf-deep"
        }`}
      >
        <IconLayers size={15} />
        {isPending ? "切替中…" : triggerLabel}
        <IconChevronDown size={13} className={open ? "rotate-180" : undefined} />
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[90] bg-[#463b2f]/20 backdrop-blur-[1px]" onPointerDown={() => setOpen(false)}>
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={dialogTitleId}
                className="absolute top-[calc(env(safe-area-inset-top)+72px)] right-4 left-4 ml-auto max-w-sm overflow-hidden rounded-[24px] border border-line bg-card p-3 shadow-[0_18px_48px_rgba(70,59,47,0.24)]"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <p id={dialogTitleId} className="px-3 pt-1 pb-2 text-xs font-semibold text-ink-faint">
                  表示する旅を選択
                </p>
                <nav aria-label="表示する旅" className="max-h-[60dvh] touch-pan-y overflow-y-auto overscroll-contain">
                  {options.map((option) => {
                    const selected = option.value === optimisticValue;
                    return (
                      <button
                        ref={selected ? selectedButtonRef : undefined}
                        key={`${option.kind}-${option.value}`}
                        type="button"
                        aria-current={selected ? "page" : undefined}
                        onPointerDown={() => {
                          // iPhoneでも押した瞬間に選択色を変えて、反応待ち感をなくす。
                          if (option.value !== optimisticValue) setOptimisticValue(option.value);
                        }}
                        onClick={() => selectOption(option)}
                        className={`flex min-h-14 w-full items-center gap-2 rounded-2xl px-4 py-2 text-left text-sm transition-colors active:bg-paper-deep ${
                          selected ? "bg-leaf-soft font-semibold text-leaf-deep" : "text-ink"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] leading-tight text-ink-faint">
                            {option.kind === "personal" ? "個人旅" : "共有旅"}
                          </span>
                          <span className="mt-0.5 block truncate text-base">{option.name}</span>
                        </span>
                        {selected ? <IconCheck size={18} className="shrink-0" /> : null}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
