import { IconClose, IconUser } from "@/components/icons";

type ChatMessage = {
  id: string;
  user_id: string;
  display_name: string;
  profile_image_url: string | null;
  body: string;
  created_at: string;
};

type DeleteAction = (formData: FormData) => void | Promise<void>;

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(iso));
}

/** 全体チャット・グループチャットで共通の、新しい順のタイムライン表示 */
export function SnsChatList({
  messages,
  avatarUrls,
  currentUserId,
  deleteAction,
  hiddenFieldsFor,
}: {
  messages: ChatMessage[];
  avatarUrls: Map<string, string>;
  currentUserId: string;
  deleteAction: DeleteAction;
  hiddenFieldsFor: (message: ChatMessage) => Record<string, string>;
}) {
  if (messages.length === 0) {
    return <p className="px-1 text-center text-xs text-ink-faint">まだメッセージがありません。</p>;
  }

  return (
    <ul className="space-y-3">
      {messages.map((message) => {
        const avatarUrl = message.profile_image_url ? avatarUrls.get(message.profile_image_url) : null;
        const canDelete = message.user_id === currentUserId;
        return (
          <li key={message.id} className="flex items-start gap-2 px-1">
            <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-paper-deep">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-ink-faint">
                  <IconUser size={18} />
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1 rounded-2xl bg-paper-deep px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-bold">{message.display_name}</span>
                <span className="shrink-0 text-[10px] text-ink-faint">{formatDateTime(message.created_at)}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
            </div>
            {canDelete ? (
              <form action={deleteAction} className="shrink-0">
                {Object.entries(hiddenFieldsFor(message)).map(([name, value]) => (
                  <input key={name} type="hidden" name={name} value={value} />
                ))}
                <button
                  type="submit"
                  aria-label="このメッセージを削除"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-ink-faint active:bg-paper-deep"
                >
                  <IconClose size={14} />
                </button>
              </form>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
