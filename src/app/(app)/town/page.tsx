import { redirect } from "next/navigation";

/** わんこタウンの飾り部屋は「おへや」になった */
export default function TownPage() {
  redirect("/room");
}
