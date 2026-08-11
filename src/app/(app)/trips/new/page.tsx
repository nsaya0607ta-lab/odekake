import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { safeNextPath } from "@/lib/navigation";
import { getRecordSpace } from "@/lib/data/space";
import { getRecordDestinationHierarchy } from "@/lib/data/trips";
import { requireUser } from "@/lib/supabase/server";
import { TripForm } from "./trip-form";

export const metadata = { title: "旅行の計画を立てる | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function NewTripPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; parent?: string }>;
}) {
  const [{ next, parent }, { user, supabase }] = await Promise.all([searchParams, requireUser()]);
  const space = await getRecordSpace(supabase, user.id);
  const destinations = await getRecordDestinationHierarchy(supabase, user.id, space.name);
  const roots = [...(destinations.personal ? [destinations.personal] : []), ...destinations.shared];

  return (
    <>
      <PageHeader title="旅行の計画を立てる" />
      <PageBody>
        <TripForm
          userId={user.id}
          next={next ? safeNextPath(next) : null}
          roots={roots.map((root) => ({ id: root.id, title: root.title, kind: root.kind }))}
          initialParentId={roots.some((root) => root.id === parent) ? parent : destinations.personal?.id}
        />
      </PageBody>
    </>
  );
}
