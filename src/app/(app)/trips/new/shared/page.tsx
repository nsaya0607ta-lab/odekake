import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { safeNextPath } from "@/lib/navigation";
import { requireUser } from "@/lib/supabase/server";
import { TripForm } from "../trip-form";

export const metadata = { title: "新しい共有旅 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function NewSharedTripPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ next }, { user }] = await Promise.all([searchParams, requireUser()]);

  return (
    <>
      <PageHeader title="新しい共有旅" />
      <PageBody>
        <TripForm userId={user.id} tripType="shared" next={next ? safeNextPath(next) : null} />
      </PageBody>
    </>
  );
}
