"use client";

import { useEffect, useRef, useState } from "react";

export function SignaturePad({
  onSave,
}: {
  onSave: (dataUrl: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    function resize() {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const width = container.clientWidth;
      const height = Math.max(160, Math.min(200, width * 0.4));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
      }
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

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
    const dpr = window.devicePixelRatio || 1;
    pair.ctx.clearRect(0, 0, pair.canvas.width / dpr, pair.canvas.height / dpr);
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL("image/png"));
  }

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="w-full">
        <canvas
          ref={canvasRef}
          className="w-full touch-none rounded-lg border border-slate-300 bg-white shadow-sm"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          aria-label="Zone de signature"
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={clear} className="btn-secondary flex-1">
          Effacer
        </button>
        <button type="button" onClick={save} className="btn-primary-block flex-1">
          Enregistrer signature
        </button>
      </div>
    </div>
  );
}
