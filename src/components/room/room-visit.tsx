"use client";

/**
 * わんこのおへや：フレンドの部屋にあそびに行く
 * - VisitPanel … フレンドの部屋の下に出す「いいね」と置き手紙
 * - RoomGuests … 自分の部屋の下に出す、届いた「いいね」・置き手紙と、あそびに行けるフレンドの一覧
 */
import Link from "next/link";
import { useEffect, useState } from "react";

const NOTE_MAX = 60;
const NOTE_STAMPS = ["すてきなおへや！", "わんこかわいい🐶", "また来るね👋", "おじゃましました🍪"];

export type VisitState = {
  friendId: string;
  name: string;
  liked: boolean;
  likeCount: number;
  myNotes: { id: string; body: string; createdAt: string }[];
};

/** 「〇分前」の基準の時刻。サーバーの描画と食い違わないよう、ひらいたあとに決める（それまでは日付だけ） */
function useNowMs() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(t); }, []);
  return now;
}

const fmtWhen = (iso: string, now: number | null) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mins = now === null ? Infinity : Math.round((now - d.getTime()) / 60_000);
  if (mins < 1) return "いま";
  if (mins < 60) return `${mins}分前`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}時間前`;
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).format(d);
};

async function send(payload: Record<string, unknown>, method: "POST" | "DELETE" = "POST") {
  const r = await fetch("/api/my-room/visit", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const j = (await r.json().catch(() => null)) as Record<string, unknown> | null;
  if (!r.ok) throw new Error(typeof j?.error === "string" ? j.error : "うまくいきませんでした。");
  return j ?? {};
}

/** ヘッダーの右に出す、ハートのいいねボタン */
export function LikeButton({ liked, count, busy, onToggle }: { liked: boolean; count: number; busy: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} disabled={busy} aria-pressed={liked} aria-label={liked ? "いいねを取り消す" : "いいねする"}
      className={`flex min-w-[72px] items-center justify-center gap-1 rounded-full px-3 py-2.5 text-sm font-black shadow-sm transition active:scale-95 disabled:opacity-70 ${liked ? "bg-[#FF6F91] text-white" : "border border-[#FF6F91]/40 bg-[#FFF0F4] text-[#E2557A]"}`}>
      <span aria-hidden className={liked ? "room-heart-pop" : ""}>{liked ? "♥" : "♡"}</span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

export function useVisit(initial: VisitState) {
  const [liked, setLiked] = useState(initial.liked);
  const [likeCount, setLikeCount] = useState(initial.likeCount);
  const [busy, setBusy] = useState(false);
  const toggleLike = async () => {
    const next = !liked;
    setBusy(true); setLiked(next); setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      const j = await send({ friendId: initial.friendId, action: next ? "like" : "unlike" });
      if (typeof j.likeCount === "number") setLikeCount(j.likeCount);
      if (typeof j.liked === "boolean") setLiked(j.liked);
    } catch {
      setLiked(!next); setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
    } finally { setBusy(false); }
  };
  return { liked, likeCount, busy, toggleLike };
}

export function VisitPanel({ visit, dogName, liked, likeCount, onLike, likeBusy }: {
  visit: VisitState; dogName: string; liked: boolean; likeCount: number; onLike: () => void; likeBusy: boolean;
}) {
  const now = useNowMs();
  const [notes, setNotes] = useState(visit.myNotes);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState("");
  const left = NOTE_MAX - [...text].length;
  const post = async (body: string) => {
    if (!body.trim() || state === "sending") return;
    setState("sending"); setError("");
    try {
      const j = await send({ friendId: visit.friendId, action: "note", body });
      const note = j.note as VisitState["myNotes"][number] | undefined;
      if (note) setNotes((n) => [note, ...n].slice(0, 5));
      setText(""); setState("idle");
    } catch (e) { setError(e instanceof Error ? e.message : "置けませんでした。"); setState("error"); }
  };
  const remove = async (id: string) => {
    const before = notes;
    setNotes((n) => n.filter((x) => x.id !== id));
    try { await send({ noteId: id }, "DELETE"); } catch { setNotes(before); }
  };
  return (
    <section className="space-y-3 px-4 pt-4">
      <div className="flex items-center gap-3 rounded-2xl border border-[#FFD3DE] bg-[linear-gradient(135deg,#FFF6F8,#FFEFF3)] px-4 py-3 shadow-sm">
        <button type="button" onClick={onLike} disabled={likeBusy} aria-pressed={liked}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl shadow-md transition active:scale-90 ${liked ? "bg-[#FF6F91] text-white" : "bg-white text-[#FF6F91]"}`}>
          <span aria-hidden className={liked ? "room-heart-pop" : ""}>{liked ? "♥" : "♡"}</span>
          <span className="sr-only">{liked ? "いいねを取り消す" : "いいねする"}</span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-black text-ink">{liked ? "いいねしました！" : `${visit.name}さんのおへやに いいね`}</p>
          <p className="text-[11px] font-bold text-ink-soft"><span className="tabular-nums text-[#E2557A]">{likeCount}</span>人が いいね しています</p>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-card p-3 shadow-sm">
        <p className="flex items-center gap-1.5 text-[13px] font-black text-ink"><span aria-hidden>✉️</span>置き手紙をのこす</p>
        <p className="mt-0.5 text-[10px] font-bold text-ink-faint">{visit.name}さんだけが読めます</p>
        <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {NOTE_STAMPS.map((s) => (
            <button key={s} type="button" onClick={() => void post(s)} disabled={state === "sending"} className="shrink-0 rounded-full border border-line bg-paper px-2.5 py-1.5 text-[11px] font-bold text-ink-soft active:scale-95 disabled:opacity-60">{s}</button>
          ))}
        </div>
        <form className="mt-1.5 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void post(text); }}>
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">置き手紙</span>
            <textarea value={text} onChange={(e) => setText([...e.target.value].slice(0, NOTE_MAX).join(""))} rows={2} placeholder={`${dogName}によろしくね、など`}
              className="block w-full resize-none rounded-xl border border-line bg-[repeating-linear-gradient(180deg,#FFFDF8_0_21px,#EFE4D2_21px_22px)] px-3 py-1.5 text-[16px] leading-[22px] text-ink" />
            <span className={`absolute bottom-1 right-2 text-[9px] font-bold ${left < 10 ? "text-[#b94c60]" : "text-ink-faint"}`}>{left}</span>
          </label>
          <button type="submit" disabled={!text.trim() || state === "sending"} className="shrink-0 rounded-full bg-leaf-deep px-4 py-2.5 text-[13px] font-black text-white shadow-sm active:scale-95 disabled:opacity-50">{state === "sending" ? "…" : "置く"}</button>
        </form>
        {error ? <p role="alert" className="mt-1.5 text-[11px] font-bold text-[#b94c60]">{error}</p> : null}
        {notes.length ? (
          <ul className="mt-2.5 space-y-1.5 border-t border-dashed border-line pt-2.5">
            {notes.map((n) => (
              <li key={n.id} className="flex items-start gap-2 text-[12px]">
                <span aria-hidden>📝</span>
                <p className="min-w-0 flex-1 break-words font-bold text-ink-soft">{n.body}<span className="ml-1.5 text-[10px] font-semibold text-ink-faint">{fmtWhen(n.createdAt, now)}</span></p>
                <button type="button" onClick={() => void remove(n.id)} className="shrink-0 text-[10px] font-bold text-ink-faint underline">とりけす</button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <Link href="/room" className="flex w-full items-center justify-center gap-2 rounded-full border border-leaf/40 bg-leaf-soft py-3 text-sm font-black text-leaf-deep active:scale-[.98]">🏠 じぶんのおへやに帰る</Link>
    </section>
  );
}

export type RoomMailItem = { kind: "note" | "like"; id: string; userId: string; name: string; body: string | null; createdAt: string };
export type RoomFriend = { id: string; name: string; avatar: string | null };

/** 自分の部屋に届いたものと、あそびに行けるフレンド */
export function RoomGuests({ mail, friends }: { mail: RoomMailItem[]; friends?: RoomFriend[] }) {
  const now = useNowMs();
  const [items, setItems] = useState(mail);
  const [showAll, setShowAll] = useState(false);
  const likes = items.filter((m) => m.kind === "like");
  const notes = items.filter((m) => m.kind === "note");
  const removeNote = async (id: string) => {
    const before = items;
    setItems((m) => m.filter((x) => !(x.kind === "note" && x.id === id)));
    try { await send({ noteId: id }, "DELETE"); } catch { setItems(before); }
  };
  const shownNotes = showAll ? notes : notes.slice(0, 3);
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-line bg-[linear-gradient(180deg,#FBF6EE,#F3EADB)] px-4 py-2.5">
          <span aria-hidden className="text-lg">📮</span>
          <p className="flex-1 text-[13px] font-black text-ink">おへやのポスト</p>
          <p className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-black text-[#E2557A] shadow-sm">♥ {likes.length}</p>
        </div>
        {items.length ? (
          <div className="space-y-2 px-4 py-3">
            {likes.length ? (
              <p className="text-[11px] font-bold text-ink-soft">
                <span className="text-[#E2557A]">♥</span> {likes.slice(0, 3).map((l) => l.name).join("、")}さん{likes.length > 3 ? `ほか${likes.length - 3}人` : ""}が いいね しました
              </p>
            ) : null}
            {shownNotes.map((n) => (
              <div key={n.id} className="relative rounded-xl bg-[repeating-linear-gradient(180deg,#FFFDF8_0_21px,#EFE4D2_21px_22px)] px-3 pb-1.5 pt-1 shadow-[0_1px_2px_rgba(80,60,30,.15)]">
                <p className="text-[13px] font-bold leading-[22px] text-ink">{n.body}</p>
                <p className="flex items-center justify-between text-[10px] font-bold text-ink-faint">
                  <Link href={`/room/visit/${n.userId}`} className="underline decoration-dotted">— {n.name}さん</Link>
                  <span className="flex items-center gap-2">{fmtWhen(n.createdAt, now)}<button type="button" onClick={() => void removeNote(n.id)} className="underline">片づける</button></span>
                </p>
              </div>
            ))}
            {notes.length > 3 ? <button type="button" onClick={() => setShowAll((v) => !v)} className="w-full text-center text-[11px] font-bold text-leaf-deep">{showAll ? "とじる" : `ほかの置き手紙 ${notes.length - 3}通`}</button> : null}
          </div>
        ) : (
          <p className="px-4 py-3 text-[11px] font-bold text-ink-faint">フレンドがあそびに来て「いいね」や置き手紙をくれると、ここに届きます</p>
        )}
      </div>

      {friends ? <div className="rounded-2xl border border-line bg-card px-4 py-3 shadow-sm">
        <p className="text-[13px] font-black text-ink">🚪 フレンドのおへやに あそびに行く</p>
        {friends.length ? (
          <ul className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
            {friends.map((f) => (
              <li key={f.id} className="shrink-0">
                <Link href={`/room/visit/${f.id}`} className="flex w-[76px] flex-col items-center gap-1 rounded-2xl border border-line bg-paper px-1.5 pb-2 pt-2.5 active:scale-95">
                  <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-leaf-soft text-base font-black text-leaf-deep shadow-[0_0_0_2px_#fff,0_1px_4px_rgba(0,0,0,.15)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {f.avatar ? <img src={f.avatar} alt="" className="h-full w-full object-cover" /> : [...f.name][0]}
                  </span>
                  <span className="w-full truncate text-center text-[10px] font-bold text-ink-soft">{f.name}</span>
                  <span className="rounded-full bg-leaf-deep px-2 py-0.5 text-[9px] font-black text-white">あそびに行く</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[11px] font-bold text-ink-faint">フレンドになると、おたがいのおへやに あそびに行けます。<Link href="/mypage/friends" className="text-leaf-deep underline">フレンドをさがす</Link></p>
        )}
      </div> : null}
    </div>
  );
}
