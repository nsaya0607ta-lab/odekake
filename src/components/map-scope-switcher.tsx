"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconChevronDown, IconLayers } from "@/components/icons";
import { PERSONAL_MAP_SCOPE, type MapScopeOption } from "@/lib/data/map-scope";

export function MapScopeSwitcher({
  options,
  selectedValue,
}: {
  options: MapScopeOption[];
  selectedValue: string;
}) {
  const [open, setOpen] = useState(false);
  const dialogTitleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedLinkRef = useRef<HTMLAnchorElement>(null);

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
    requestAnimationFrame(() => selectedLinkRef.current?.focus());

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

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="pressable flex h-9 shrink-0 items-center gap-1 rounded-full border border-leaf bg-card px-3 text-xs font-semibold text-leaf-deep shadow-sm"
      >
        <IconLayers size={15} />
        地図を変更
        <IconChevronDown size={13} className={open ? "rotate-180" : undefined} />
      </button>

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[90] bg-[#463b2f]/20 backdrop-blur-[1px]"
              onPointerDown={() => setOpen(false)}
            >
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
                <nav
                  aria-label="表示する地図"
                  className="max-h-[60dvh] touch-pan-y overflow-y-auto overscroll-contain"
                >
                  {options.map((option) => {
                    const selected = option.value === selectedValue;
                    const href = option.value === PERSONAL_MAP_SCOPE ? "/map" : `/map?trip=${option.value}`;
                    return (
                      <Link
                        ref={selected ? selectedLinkRef : undefined}
                        key={option.value}
                        href={href}
                        aria-current={selected ? "page" : undefined}
                        onClick={() => setOpen(false)}
                        className={`flex min-h-14 items-center gap-2 rounded-2xl px-4 py-2 text-sm transition-colors active:bg-paper-deep ${
                          selected ? "bg-leaf-soft font-semibold text-leaf-deep" : "text-ink"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] leading-tight text-ink-faint">
                            {option.kind === "personal" ? "個人の旅" : "共有旅"}
                          </span>
                          <span className="mt-0.5 block truncate text-base">{option.name}</span>
                        </span>
                        {selected ? <IconCheck size={18} className="shrink-0" /> : null}
                      </Link>
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
