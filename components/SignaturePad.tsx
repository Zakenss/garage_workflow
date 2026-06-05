"use client";

import { useRef, useState } from "react";

export function SignaturePad({
  onSave,
}: {
  onSave: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);

  function getCtx() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    return { canvas, ctx };
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const pair = getCtx();
    if (!pair) return;
    setDrawing(true);
    const { x, y } = pointerPos(e);
    pair.ctx.beginPath();
    pair.ctx.moveTo(x, y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const pair = getCtx();
    if (!pair) return;
    const { x, y } = pointerPos(e);
    pair.ctx.lineTo(x, y);
    pair.ctx.stroke();
  }

  function end() {
    setDrawing(false);
  }

  function clear() {
    const pair = getCtx();
    if (!pair) return;
    pair.ctx.clearRect(0, 0, pair.canvas.width, pair.canvas.height);
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL("image/png"));
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={400}
        height={160}
        className="w-full touch-none rounded-lg border border-slate-300 bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={clear}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          Effacer
        </button>
        <button
          type="button"
          onClick={save}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
        >
          Enregistrer signature
        </button>
      </div>
    </div>
  );
}
