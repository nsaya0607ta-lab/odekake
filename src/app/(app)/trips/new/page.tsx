import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/supabase/server";
import { TripForm } from "./trip-form";

export const metadata = { title: "新しい旅行 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function NewTripPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const [{ type }, { user }] = await Promise.all([searchParams, requireUser()]);
  const defaultType = type === "shared" ? "shared" : "solo";

  return (
    <>
      <PageHeader title="新しい旅行" />
      <PageBody>
        <TripForm userId={user.id} defaultType={defaultType} />
      </PageBody>
    </>
  );
}
