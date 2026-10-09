import { TownGame } from "@/components/games/frenchie-town/town-game";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "フレンチーの街づくり | おでかけ記録", description: "白コインで家やお店を建てて、わんこたちと暮らす3Dの街づくり。" };
export const dynamic = "force-dynamic";

export default async function FrenchieTownPage() {
  const { user } = await requireUser();
  return <TownGame key={user.id} userId={user.id}/>;
}
