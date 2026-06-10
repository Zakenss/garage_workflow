"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PriorityBadge } from "@/components/VehicleCard";
import { StatusBadge } from "@/components/StatusBadge";
import type { VehicleWithMechanic } from "@/lib/workshop-vehicles";

export function MechanicQueueEditor({
  vehicles,
  onSaveOrder,
  saving,
}: {
  vehicles: VehicleWithMechanic[];
  onSaveOrder: (orderedIds: string[]) => Promise<void>;
  saving?: boolean;
}) {
  const [items, setItems] = useState(vehicles);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const initialRef = useRef(vehicles.map((v) => v.id).join(","));

  useEffect(() => {
    const key = vehicles.map((v) => v.id).join(",");
    if (key !== initialRef.current) {
      initialRef.current = key;
      setItems(vehicles);
      setDirty(false);
    }
  }, [vehicles]);

  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    setDirty(true);
  }

  async function save() {
    await onSaveOrder(items.map((v) => v.id));
    setDirty(false);
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500">Aucun véhicule assigné à ce mécanicien.</p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Glissez-déposez pour définir l&apos;ordre de priorité (1 = en premier).
      </p>

      <ol className="space-y-2">
        {items.map((v, index) => (
          <li
            key={v.id}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) reorder(dragIndex, index);
              setDragIndex(null);
            }}
            onDragEnd={() => setDragIndex(null)}
            className={`card-padded flex cursor-grab items-center gap-3 active:cursor-grabbing ${
              dragIndex === index ? "opacity-50 ring-2 ring-slate-400" : ""
            }`}
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white"
              aria-hidden
            >
              {index + 1}
            </span>
            <span className="text-slate-400" aria-hidden title="Glisser pour réordonner">
              ⠿
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/workshop/vehicle/${v.id}`}
                  className="font-semibold text-slate-900 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {v.license_plate}
                </Link>
                <PriorityBadge priority={index + 1} />
              </div>
              <p className="text-sm text-slate-600">
                {v.make} {v.model}
              </p>
            </div>
            <StatusBadge status={v.status} />
          </li>
        ))}
      </ol>

      {dirty && (
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="btn-primary-block"
        >
          {saving ? "Enregistrement…" : "Enregistrer l'ordre de priorité"}
        </button>
      )}
    </div>
  );
}
