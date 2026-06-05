import { supabase } from "./supabase";
import type { SessionUser } from "./types";

export async function addTimeline(
  vehicleId: string,
  userId: string | null,
  action: string,
  details: Record<string, unknown> = {}
) {
  await supabase.from("vehicle_timeline").insert({
    vehicle_id: vehicleId,
    user_id: userId,
    action,
    details,
  });
}

export async function notifyUser(
  userId: string,
  type: string,
  message: string,
  vehicleId?: string
) {
  await supabase.from("notifications").insert({
    user_id: userId,
    type,
    message,
    vehicle_id: vehicleId ?? null,
  });
}

export async function notifyRole(
  role: string,
  type: string,
  message: string,
  vehicleId?: string
) {
  await supabase.from("notifications").insert({
    target_role: role,
    type,
    message,
    vehicle_id: vehicleId ?? null,
  });
}

export async function updateVehicleStatus(
  vehicleId: string,
  status: string,
  user: SessionUser | null,
  extra: Record<string, unknown> = {}
) {
  const { error } = await supabase
    .from("vehicles")
    .update({ status, ...extra })
    .eq("id", vehicleId);
  if (error) throw error;
  await addTimeline(vehicleId, user?.id ?? null, "status_change", {
    status,
    ...extra,
  });
}

export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
  });
  if (error) throw error;
  return path;
}
