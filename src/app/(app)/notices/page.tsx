import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { DUMMY_NOTICES } from "@/lib/dummy-notices";

export const metadata = { title: "お知らせ | おでかけ記録" };

export default function NoticesPage() {
  return (
    <>
      <PageHeader title="お知らせ" backHref="/home" />
      <PageBody>
        <ul className="space-y-2">
          {DUMMY_NOTICES.map((notice) => (
            <li key={notice.id} className="rough-card p-4">
              <p className="text-xs text-ink-faint">{notice.publishedAt}</p>
              <p className="mt-1 font-semibold">{notice.title}</p>
            </li>
          ))}
        </ul>
      </PageBody>
    </>
  );
}
