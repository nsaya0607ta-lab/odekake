import { IconChevronRight, IconQuestion } from "@/components/icons";
import { SNS_GUIDE_URL } from "@/lib/sns-guide";

/** SNSでできることをまとめた説明書（Web）への入り口。アプリの状態を保つため別タブで開く。 */
export function SnsGuideCard() {
  return (
    <a
      href={SNS_GUIDE_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-haptic="light"
      className="sns-settings-feature-card sns-guide-card pressable"
    >
      <div className="sns-settings-feature-title is-guide">
        <span aria-hidden="true"><IconQuestion size={19} /></span>
        <div>
          <h2>SNSの説明書</h2>
          <p>できることを、画面をさわりながら確かめられます</p>
        </div>
        <span className="sns-guide-card-go" aria-hidden="true"><IconChevronRight size={15} /></span>
      </div>
      <span className="sr-only">（新しいタブで開きます）</span>
    </a>
  );
}

/** ホームに置く、説明書への細い導線。カード版より控えめで、流れを邪魔しない。 */
export function SnsGuideStrip() {
  return (
    <a
      href={SNS_GUIDE_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-haptic="light"
      className="sns-guide-strip pressable"
    >
      <span className="sns-guide-strip-icon" aria-hidden="true"><IconQuestion size={15} /></span>
      <span className="min-w-0 flex-1">
        <strong>はじめての方へ</strong>
        <small>SNSでできることを、説明書で見てみる</small>
      </span>
      <IconChevronRight size={15} aria-hidden="true" />
      <span className="sr-only">（新しいタブで開きます）</span>
    </a>
  );
}
