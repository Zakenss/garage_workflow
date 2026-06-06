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
      <label className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-6 text-center transition-all duration-200 hover:border-slate-400 hover:bg-slate-50 focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-900/10 sm:min-h-[140px]">
        <span className="text-sm font-medium text-slate-700">
          {uploading ? "Envoi en cours…" : label}
        </span>
        <span className="mt-1 text-xs text-slate-500">Caméra ou galerie</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple={multiple}
          className="sr-only"
          onChange={handleChange}
          disabled={uploading}
          aria-label={label}
        />
      </label>
      {uploading && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton aspect-square rounded-lg" />
          ))}
        </div>
      )}
      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {previews.map((src) => (
            <img
              key={src}
              src={src}
              alt="Aperçu photo"
              className="aspect-square rounded-lg border border-slate-200 object-cover shadow-sm"
            />
          ))}
        </div>
      )}
    </div>
  );
}
