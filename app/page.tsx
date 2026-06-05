import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { getRoleHome } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  redirect(getRoleHome(session.role));
}
