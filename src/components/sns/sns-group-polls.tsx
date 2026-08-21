"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useActionState, useEffect, useState, useTransition } from "react";
import {
  createFriendGroupPollAction,
  deleteFriendGroupPollAction,
  voteFriendGroupPollAction,
} from "@/app/actions/sns";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";
import { FormDraft } from "@/components/form-draft";
import { IconCheck, IconClose, IconPlus, IconPoll, IconTrash } from "@/components/icons";
import type { FriendGroupPollRow } from "@/lib/supabase/types";

export function SnsGroupPolls({
  groupId,
  currentUserId,
  initialPolls,
}: {
  groupId: string;
  currentUserId: string;
  initialPolls: FriendGroupPollRow[];
}) {
  const [polls, setPolls] = useState(initialPolls);
  const [expanded, setExpanded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [, startTransition] = useTransition();

  useEffect(() => setPolls(initialPolls), [initialPolls]);
  const visible = expanded ? polls : polls.slice(0, 1);

  function vote(poll: FriendGroupPollRow, optionId: string) {
    if (poll.my_option_id === optionId || isClosed(poll.closes_at)) return;
    const previous = polls;
    setPolls((current) => current.map((item) => {
      if (item.id !== poll.id) return item;
      const counts = [...item.option_vote_counts];
      const previousIndex = item.my_option_id ? item.option_ids.indexOf(item.my_option_id) : -1;
      const nextIndex = item.option_ids.indexOf(optionId);
      if (previousIndex >= 0) counts[previousIndex] = Math.max(0, (counts[previousIndex] ?? 0) - 1);
      if (nextIndex >= 0) counts[nextIndex] = (counts[nextIndex] ?? 0) + 1;
      return { ...item, my_option_id: optionId, option_vote_counts: counts, total_votes: item.total_votes + (item.my_option_id ? 0 : 1) };
    }));
    if ("vibrate" in navigator) navigator.vibrate?.(9);
    startTransition(async () => {
      const data = new FormData();
      data.set("groupId", groupId);
      data.set("pollId", poll.id);
      data.set("optionId", optionId);
      const result = await voteFriendGroupPollAction(data);
      if (!result.ok) {
        setPolls(previous);
        setMessage(result.error);
      } else {
        setMessage("投票しました ✦");
      }
      window.setTimeout(() => setMessage(""), 2200);
    });
  }

  return (
    <section className="sns-group-polls">
      <div className="sns-polls-heading">
        <span className="sns-polls-art"><Image src="/illustrations/sns/group-poll-v2.webp" alt="" width={70} height={70} sizes="70px" /></span>
        <span className="min-w-0 flex-1"><small>QUICK VOTE</small><strong>みんなで決める</strong><em>{polls.length > 0 ? `${polls.length}件の投票` : "最短2タップで相談"}</em></span>
        <button type="button" onClick={() => setCreating((value) => !value)} aria-expanded={creating} className="sns-poll-create pressable">
          {creating ? <IconClose size={16} /> : <IconPlus size={16} />}{creating ? "閉じる" : "作る"}
        </button>
      </div>

      {creating ? <PollComposer groupId={groupId} onDone={() => setCreating(false)} /> : null}
      {message ? <p className="sns-poll-toast" role="status">{message}</p> : null}

      {visible.map((poll) => {
        const closed = isClosed(poll.closes_at);
        return (
          <article key={poll.id} className="sns-poll-card">
            <div className="flex items-start gap-2">
              <span className="sns-poll-icon"><IconPoll size={18} /></span>
              <div className="min-w-0 flex-1"><h3>{poll.question}</h3><p>{poll.display_name}さん・{closed ? "終了" : deadlineLabel(poll.closes_at)}</p></div>
              {poll.user_id === currentUserId ? (
                <form action={deleteFriendGroupPollAction}>
                  <input type="hidden" name="pollId" value={poll.id} />
                  <input type="hidden" name="groupId" value={groupId} />
                  <ConfirmSubmitButton message="この投票を削除しますか？" pendingLabel="" className="pressable flex h-11 w-11 items-center justify-center rounded-full text-ink-faint"><IconTrash size={14} /><span className="sr-only">投票を削除</span></ConfirmSubmitButton>
                </form>
              ) : null}
            </div>
            <div className="mt-3 space-y-2">
              {poll.option_ids.map((optionId, index) => {
                const count = poll.option_vote_counts[index] ?? 0;
                const percent = poll.total_votes > 0 ? Math.round((count / poll.total_votes) * 100) : 0;
                const selected = poll.my_option_id === optionId;
                return (
                  <button
                    key={optionId}
                    type="button"
                    onClick={() => vote(poll, optionId)}
                    disabled={closed}
                    aria-pressed={selected}
                    className={`sns-poll-option pressable ${selected ? "is-selected" : ""}`}
                    style={{ "--poll-fill": `${percent}%` } as CSSProperties}
                  >
                    <span className="sns-poll-option-fill" aria-hidden="true" />
                    <span className="sns-poll-check">{selected ? <IconCheck size={13} /> : null}</span>
                    <strong>{poll.option_labels[index]}</strong>
                    <small>{percent}%</small>
                  </button>
                );
              })}
            </div>
            <p className="sns-poll-total">{poll.total_votes}票{poll.my_option_id ? "・投票済み" : closed ? "" : "・選んで投票"}</p>
          </article>
        );
      })}
      {polls.length > 1 ? (
        <button type="button" onClick={() => setExpanded((value) => !value)} className="sns-polls-more pressable">
          {expanded ? "最新だけ表示" : `ほか${polls.length - 1}件を見る`}
        </button>
      ) : null}
    </section>
  );
}

function PollComposer({ groupId, onDone }: { groupId: string; onDone: () => void }) {
  const [state, action] = useActionState(createFriendGroupPollAction, emptyActionState);
  const formId = `sns-poll-compose-${groupId}`;
  useEffect(() => { if (state.ok) onDone(); }, [state.ok, onDone]);
  return (
    <form id={formId} action={action} className="sns-poll-composer space-y-2">
      <FormDraft formId={formId} storageKey={`sns-group-poll-${groupId}`} />
      <input type="hidden" name="groupId" value={groupId} />
      <input name="question" maxLength={120} defaultValue={state.values?.question ?? ""} className="field text-sm font-bold" placeholder="どこへ行く？ 何時にする？" />
      {[0, 1, 2, 3].map((index) => <input key={index} name={`option${index}`} maxLength={50} className="field text-sm" placeholder={index < 2 ? `選択肢 ${index + 1}（必須）` : `選択肢 ${index + 1}（任意）`} />)}
      <label className="block text-[11px] font-bold text-ink-soft">締切（任意）<input type="datetime-local" name="closesAt" className="field mt-1 text-sm" /></label>
      <FormMessage state={state} />
      <SubmitButton className="sns-pin-save pressable" pendingLabel="作成中…"><IconPoll size={16} />投票を始める</SubmitButton>
    </form>
  );
}

function isClosed(value: string | null): boolean {
  return Boolean(value && Date.parse(value) <= Date.now());
}

function deadlineLabel(value: string | null): string {
  if (!value) return "締切なし";
  return `${new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" }).format(new Date(value))}まで`;
}
