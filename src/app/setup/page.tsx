import { IconLeaf } from "@/components/icons";

export const metadata = { title: "セットアップ | おでかけ記録" };

const STEPS = [
  {
    title: "Supabase プロジェクトを作成する",
    body: "supabase.com でプロジェクトを作成し、Project Settings → API から URL と anon key を控えます。",
  },
  {
    title: "環境変数を設定する",
    body: "リポジトリ直下に .env.local を作成し、下記の3つを設定します。Vercel では Environment Variables に登録してください。",
    code: "NEXT_PUBLIC_SUPABASE_URL=...\nNEXT_PUBLIC_SUPABASE_ANON_KEY=...\nNEXT_PUBLIC_SITE_URL=http://localhost:3000",
  },
  {
    title: "データベースを初期化する",
    body: "supabase/migrations/ の SQL を番号順にすべて SQL Editor へ貼り付けて実行します。0001 だけでは集計関数などが入らないため、必ず最後まで適用してください。Supabase CLI なら supabase db push でも構いません。",
  },
  {
    title: "メール認証を有効にする",
    body: "Authentication → Providers → Email を有効にし、Confirm email をオンにします。URL Configuration の Redirect URLs に {サイトURL}/auth/callback を追加してください。",
  },
];

export default function SetupPage() {
  return (
    <div className="mx-auto min-h-dvh max-w-lg px-5 py-10">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-leaf bg-leaf-soft text-leaf-deep">
          <IconLeaf size={28} />
        </span>
        <h1 className="text-xl font-bold">セットアップが必要です</h1>
        <p className="text-sm leading-relaxed text-ink-soft">
          Supabase への接続情報が設定されていないため、アプリを開始できません。
          <br />
          以下の手順で設定してください。
        </p>
      </div>

      <ol className="space-y-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="rough-card p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-sm font-bold text-leaf-deep">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold">{step.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{step.body}</p>
                {step.code ? (
                  <pre className="mt-2 overflow-x-auto rounded-xl bg-paper-deep px-3 py-2 text-xs leading-relaxed text-ink-soft">
                    {step.code}
                  </pre>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-center text-xs text-ink-faint">設定後、アプリを再起動すると利用できます。</p>
    </div>
  );
}
