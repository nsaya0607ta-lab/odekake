import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/supabase/server";
import { TripForm } from "../trip-form";

export const metadata = { title: "旅行の計画を立てる | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function NewPersonalTripPage() {
  const { user } = await requireUser();

  return (
    <>
      <PageHeader title="旅行の計画を立てる" />
      <PageBody>
        <TripForm userId={user.id} tripType="solo" />
      </PageBody>
    </>
  );
}
