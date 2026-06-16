import { addTimeline, updateVehicleStatus } from "./db";
import { getPublicUrl, supabase } from "./supabase";
import type { SessionUser, Vehicle, VehicleStatus } from "./types";

export type SellerVehicle = Vehicle & {
  washed_at?: string | null;
  ready_at?: string | null;
  listed_at?: string | null;
  reserved_at?: string | null;
  sold_at?: string | null;
  seller_expert_name?: string | null;
  seller_expert_date?: string | null;
  seller_expert_time?: string | null;
};

export type SellerExpertInput = {
  name: string;
  date: string;
  time: string;
};

export type FinalPhoto = {
  id: string;
  storage_path: string;
  url: string;
};

const SELLER_STATUSES: VehicleStatus[] = [
  "ready_to_sell",
  "for_sale",
  "reserved",
  "sold",
];

export async function fetchSellerVehicles(): Promise<SellerVehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .in("status", SELLER_STATUSES)
    .order("ready_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("fetchSellerVehicles:", error.message);
    return [];
  }
  return (data as SellerVehicle[]) ?? [];
}

export async function fetchFinalPhotos(vehicleId: string): Promise<FinalPhoto[]> {
  const { data } = await supabase
    .from("vehicle_photos")
    .select("id, storage_path")
    .eq("vehicle_id", vehicleId)
    .eq("photo_type", "final")
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    storage_path: row.storage_path,
    url: getPublicUrl("vehicle-photos", row.storage_path),
  }));
}

export async function saveExpertAppointment(
  vehicleId: string,
  expert: SellerExpertInput,
  user: SessionUser
): Promise<void> {
  const { error } = await supabase
    .from("vehicles")
    .update({
      seller_expert_name: expert.name.trim() || null,
      seller_expert_date: expert.date || null,
      seller_expert_time: expert.time || null,
    })
    .eq("id", vehicleId);
  if (error) throw error;

  await addTimeline(vehicleId, user.id, "seller_expert_scheduled", {
    expert_name: expert.name.trim() || null,
    appointment_date: expert.date || null,
    appointment_time: expert.time || null,
  });
}

export async function markVehicleWashed(
  vehicleId: string,
  user: SessionUser
): Promise<void> {
  const { error } = await supabase
    .from("vehicles")
    .update({ washed_at: new Date().toISOString() })
    .eq("id", vehicleId);
  if (error) throw error;

  await addTimeline(vehicleId, user.id, "vehicle_washed", {});
}

export async function saveFinalPhotos(
  vehicleId: string,
  paths: string[],
  userId: string
): Promise<void> {
  const { error } = await supabase.from("vehicle_photos").insert(
    paths.map((p) => ({
      vehicle_id: vehicleId,
      storage_path: p,
      photo_type: "final",
      uploaded_by: userId,
    }))
  );
  if (error) throw error;
}

export async function setSellerSaleStatus(
  vehicleId: string,
  status: "for_sale" | "reserved" | "sold",
  input: { expert: SellerExpertInput; saleNotes: string },
  user: SessionUser
): Promise<void> {
  if ((status === "reserved" || status === "sold") && !input.saleNotes.trim()) {
    throw new Error("Les notes sont requises pour « Réservé » ou « Vendu ».");
  }

  const extra: Record<string, string | null> = {
    sale_notes: input.saleNotes.trim() || null,
    seller_expert_name: input.expert.name.trim() || null,
    seller_expert_date: input.expert.date || null,
    seller_expert_time: input.expert.time || null,
  };

  if (status === "for_sale") extra.listed_at = new Date().toISOString();
  if (status === "reserved") extra.reserved_at = new Date().toISOString();
  if (status === "sold") extra.sold_at = new Date().toISOString();

  const { error } = await supabase.from("vehicles").update(extra).eq("id", vehicleId);
  if (error) throw error;

  await updateVehicleStatus(vehicleId, status, user);
  await addTimeline(vehicleId, user.id, "seller_status_change", { status });
}
