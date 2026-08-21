import Link from "next/link";
import type { ReactNode } from "react";
import type { SnsMentionRow } from "@/lib/supabase/types";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 本文中の @メンションと #ハッシュタグだけをリンク化する。本文自体は常にReactがエスケープする。 */
export function SnsRichText({
  body,
  mentions = [],
  className,
}: {
  body: string;
  mentions?: SnsMentionRow[];
  className?: string;
}) {
  const mentionByLabel = new Map(mentions.map((mention) => [`@${mention.display_name}`, mention.user_id]));
  const mentionPattern = [...mentionByLabel.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
  const pattern = new RegExp(
    `(${mentionPattern ? `${mentionPattern}|` : ""}#[\\p{L}\\p{N}_ー]+)`,
    "gu",
  );
  const pieces: ReactNode[] = [];
  let cursor = 0;

  for (const match of body.matchAll(pattern)) {
    const index = match.index ?? 0;
    const token = match[0];
    if (index > cursor) pieces.push(body.slice(cursor, index));

    const mentionedUserId = mentionByLabel.get(token);
    if (mentionedUserId) {
      pieces.push(
        <Link key={`${index}:${token}`} href={`/sns/users/${mentionedUserId}`} className="sns-rich-link is-mention">
          {token}
        </Link>,
      );
    } else {
      pieces.push(
        <Link
          key={`${index}:${token}`}
          href={`/sns/search?q=${encodeURIComponent(token)}`}
          className="sns-rich-link is-hashtag"
        >
          {token}
        </Link>,
      );
    }
    cursor = index + token.length;
  }

  if (cursor < body.length) pieces.push(body.slice(cursor));
  return <p className={className}>{pieces}</p>;
}
