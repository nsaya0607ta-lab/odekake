import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { safeNextPath } from "@/lib/navigation";
import { requireUser } from "@/lib/supabase/server";
import { TripForm } from "../trip-form";

export const metadata = { title: "旅行の計画を立てる | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function NewPersonalTripPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ next }, { user }] = await Promise.all([searchParams, requireUser()]);

  return (
    <>
      <PageHeader title="旅行の計画を立てる" />
      <PageBody>
        <TripForm userId={user.id} tripType="solo" next={next ? safeNextPath(next) : null} />
      </PageBody>
    </>
  );
}
