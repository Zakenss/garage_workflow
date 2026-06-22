import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/session";
import {
  deleteExpertCalendarEvent,
  syncExpertAppointmentToCalendar,
} from "@/lib/google-calendar";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getServerSession();
  if (!user || user.role !== "seller") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = (await request.json()) as {
    vehicleId?: string;
    expert?: { name?: string; date?: string; time?: string };
  };

  const vehicleId = body.vehicleId;
  if (!vehicleId) {
    return NextResponse.json({ error: "vehicleId requis" }, { status: 400 });
  }

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select(
      "id, license_plate, make, model, seller_expert_calendar_event_id"
    )
    .eq("id", vehicleId)
    .single();

  if (!vehicle) {
    return NextResponse.json({ error: "Véhicule introuvable" }, { status: 404 });
  }

  const name = body.expert?.name?.trim() ?? "";
  const date = body.expert?.date ?? "";
  const time = body.expert?.time ?? "";

  try {
    if (!name || !date || !time) {
      if (vehicle.seller_expert_calendar_event_id) {
        await deleteExpertCalendarEvent(vehicle.seller_expert_calendar_event_id);
        await supabase
          .from("vehicles")
          .update({ seller_expert_calendar_event_id: null })
          .eq("id", vehicleId);
      }
      return NextResponse.json({ synced: false, reason: "appointment_incomplete" });
    }

    const eventId = await syncExpertAppointmentToCalendar({
      vehicleId: vehicle.id,
      licensePlate: vehicle.license_plate,
      make: vehicle.make,
      model: vehicle.model,
      expertName: name,
      date,
      time,
      existingEventId: vehicle.seller_expert_calendar_event_id,
    });

    if (eventId) {
      await supabase
        .from("vehicles")
        .update({ seller_expert_calendar_event_id: eventId })
        .eq("id", vehicleId);
    }

    return NextResponse.json({ synced: !!eventId, eventId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur calendrier";
    console.error("calendar sync:", message);
    return NextResponse.json(
      { error: message, synced: false, configured: true },
      { status: 502 }
    );
  }
}
