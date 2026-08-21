"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconClose, IconSearch } from "@/components/icons";
import type { SnsSearchScope } from "@/lib/data/sns-search";
import { snsSearchHref } from "@/lib/data/sns-search";

/** ネイティブ<form>のGET送信だとページ全体がリロードされてしまうため、
 * router.pushでクライアント側遷移にして検索時の読み込みを軽くする。 */
export function SnsSearchBox({ query, scope }: { query: string; scope: SnsSearchScope }) {
  const router = useRouter();
  const [value, setValue] = useState(query);

  return (
    <form
      role="search"
      className="sns-search-box"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(snsSearchHref(value.trim(), scope));
      }}
    >
      <IconSearch size={20} />
      <input
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={60}
        autoFocus
        placeholder="キーワード、#タグ、場所を検索"
        aria-label="SNSを検索"
      />
      {value ? (
        <Link
          href={snsSearchHref("", scope)}
          prefetch={false}
          aria-label="検索語を消す"
          className="pressable"
          onClick={() => setValue("")}
        >
          <IconClose size={16} />
        </Link>
      ) : null}
    </form>
  );
}
