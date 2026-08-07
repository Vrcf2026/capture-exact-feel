import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Lock, PenLine } from "lucide-react";

interface SignaturePadProps {
  value?: string | null;
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
  /** Título do quadro da assinatura (ex: "Assinatura do Cliente (Aceitação de Termos)"). */
  label?: string;
  /** Chamado ao clicar em "Gravar" — grava e bloqueia a assinatura. */
  onSave?: () => void;
}

export function SignaturePad({ value, onChange, disabled, label, onSave }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(!value);
  const [bloqueada, setBloqueada] = useState(false);

  const readOnly = disabled || bloqueada;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = value;
      setEmpty(false);
    }
  }, [value]);

  function pos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const point = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    return {
      x: ((point.clientX - rect.left) / rect.width) * canvas.width,
      y: ((point.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    if (readOnly) return;
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current || readOnly) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setEmpty(false);
  }
  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current!.toDataURL("image/png"));
  }

  function limpar() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    setBloqueada(false);
    onChange("");
  }

  function gravar() {
    if (canvasRef.current) onChange(canvasRef.current.toDataURL("image/png"));
    onSave?.();
    setBloqueada(true);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {label && (
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <PenLine className="h-3.5 w-3.5 text-primary" />
            {label}
          </span>
        )}
        {!disabled && (
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" size="sm" className="h-7 gap-1.5 text-xs" onClick={gravar} disabled={empty}>
              <Lock className="h-3.5 w-3.5" /> Gravar
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={limpar}>
              <Eraser className="h-3.5 w-3.5" /> Limpar
            </Button>
          </div>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={500}
        height={160}
        className={`w-full h-40 rounded-md border border-dashed border-border bg-white touch-none ${
          readOnly ? "cursor-not-allowed" : "cursor-crosshair"
        }`}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <span className="block text-xs text-muted-foreground">
        {bloqueada
          ? "Assinatura gravada e bloqueada. Clique em «Limpar» para assinar de novo."
          : empty
            ? "Assine acima e clique em «Gravar» para bloquear."
            : "Assinatura registada — clique em «Gravar» para bloquear."}
      </span>
    </div>
  );
}
