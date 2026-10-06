import { Rulebook } from "@/components/guide/rulebook";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "ルールブック | おでかけ記録" };

export default function GuidePage() {
  return (
    <>
      <PageHeader title="ルールブック" subtitle="このアプリのしくみ、ぜんぶ" backHref="/home" />
      <PageBody>
        <Rulebook />
      </PageBody>
    </>
  );
}
