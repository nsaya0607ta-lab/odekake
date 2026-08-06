import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/supabase/server";
import { TripForm } from "../trip-form";

export const metadata = { title: "新しい共有旅 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function NewSharedTripPage() {
  const { user } = await requireUser();

  return (
    <>
      <PageHeader title="新しい共有旅" />
      <PageBody>
        <TripForm userId={user.id} tripType="shared" />
      </PageBody>
    </>
  );
}
