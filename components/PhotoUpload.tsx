"use client";

import { useState } from "react";
import { uploadFile } from "@/lib/db";
import { getPublicUrl } from "@/lib/supabase";

export function PhotoUpload({
  bucket,
  pathPrefix,
  onUploaded,
  label = "Ajouter photos",
  multiple = true,
}: {
  bucket: string;
  pathPrefix: string;
  onUploaded: (paths: string[]) => void;
  label?: string;
  multiple?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const paths: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const name = `${pathPrefix}/${Date.now()}-${file.name}`;
        const path = await uploadFile(bucket, name, file);
        paths.push(path);
        setPreviews((p) => [...p, getPublicUrl(bucket, path)]);
      }
      onUploaded(paths);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center hover:border-slate-400">
        <span className="text-sm font-medium text-slate-700">
          {uploading ? "Envoi en cours…" : label}
        </span>
        <span className="mt-1 text-xs text-slate-500">Caméra ou galerie</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple={multiple}
          className="hidden"
          onChange={handleChange}
          disabled={uploading}
        />
      </label>
      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {previews.map((src) => (
            <img
              key={src}
              src={src}
              alt=""
              className="aspect-square rounded-lg object-cover"
            />
          ))}
        </div>
      )}
    </div>
  );
}
