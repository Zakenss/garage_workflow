import { redirect } from "next/navigation";

export default async function RepairRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/vehicles/checklist/${id}`);
}
