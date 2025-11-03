import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Upload, RotateCcw, Download, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";

type PaperSize = { w: number; h: number };
type CropSize = { w: number; h: number };
type ImageState = {
  scale: number;
  offsetX: number;
  offsetY: number;
  dragging: boolean;
  lastX: number;
  lastY: number;
};

const Index = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [dragMoved, setDragMoved] = useState(false);
  
  const [dpi, setDpi] = useState(300);
  const [paperSize, setPaperSize] = useState<PaperSize>({ w: 4, h: 6 });
  const [paperPreset, setPaperPreset] = useState("4x6");
  const [customPaper, setCustomPaper] = useState({ w: "4", h: "6" });
  
  const [cropSize, setCropSize] = useState<CropSize>({ w: 1.13, h: 1.37 });
  const [cropInput, setCropInput] = useState({ w: "1.13", h: "1.37" });
  
  const [fitMode, setFitMode] = useState<"fit" | "fill">("fit");
  const [isDragging, setIsDragging] = useState(false);
  
  const [imageState, setImageState] = useState<ImageState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
  });

  const getScaleFactor = () => {
    const screenH = window.innerHeight - 120;
    const defaultPaperHIn = 6;
    return screenH / (defaultPaperHIn * dpi);
  };

  const inchesToPx = (inches: number) => Math.round(inches * dpi * getScaleFactor());
  const mmToIn = (mm: number) => mm / 25.4;

  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const wPx = inchesToPx(paperSize.w);
    const hPx = inchesToPx(paperSize.h);
    canvas.width = wPx;
    canvas.height = hPx;
    canvas.style.width = `${wPx}px`;
    canvas.style.height = `${hPx}px`;
  }, [paperSize, dpi]);

  const resetImageState = useCallback(() => {
    if (!imageLoaded || !image) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = image.width;
    const ih = image.height;

    const scale = fitMode === "fit" 
      ? Math.min(cw / iw, ch / ih)
      : Math.max(cw / iw, ch / ih);

    setImageState({
      scale,
      offsetX: (cw - iw * scale) / 2,
      offsetY: (ch - ih * scale) / 2,
      dragging: false,
      lastX: 0,
      lastY: 0,
    });
  }, [imageLoaded, image, fitMode]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (imageLoaded && image) {
      ctx.save();
      ctx.translate(imageState.offsetX, imageState.offsetY);
      ctx.scale(imageState.scale, imageState.scale);
      ctx.drawImage(image, 0, 0);
      ctx.restore();
    }

    // Crop overlay
    const cropPxW = inchesToPx(cropSize.w);
    const cropPxH = inchesToPx(cropSize.h);
    const cx = (canvas.width - cropPxW) / 2;
    const cy = (canvas.height - cropPxH) / 2;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.rect(cx, cy, cropPxW, cropPxH);
    ctx.fill("evenodd");
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "hsl(174 62% 47%)";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx + 1, cy + 1, cropPxW - 2, cropPxH - 2);
    
    // Crosshair
    ctx.beginPath();
    ctx.moveTo(cx + cropPxW / 2 - 12, cy + cropPxH / 2);
    ctx.lineTo(cx + cropPxW / 2 + 12, cy + cropPxH / 2);
    ctx.moveTo(cx + cropPxW / 2, cy + cropPxH / 2 - 12);
    ctx.lineTo(cx + cropPxW / 2, cy + cropPxH / 2 + 12);
    ctx.stroke();
    ctx.restore();
  }, [imageLoaded, image, imageState, cropSize, dpi, paperSize]);

  useEffect(() => {
    updateCanvasSize();
    drawCanvas();
  }, [updateCanvasSize, drawCanvas]);

  useEffect(() => {
    const handleResize = () => {
      updateCanvasSize();
      drawCanvas();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateCanvasSize, drawCanvas]);

  const loadImageFromURL = (src: string) => {
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setImageLoaded(true);
      toast.success("Image loaded successfully");
    };
    img.onerror = () => {
      toast.error("Failed to load image");
    };
    img.src = src;
  };

  useEffect(() => {
    if (imageLoaded) {
      resetImageState();
    }
  }, [imageLoaded, resetImageState]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        loadImageFromURL(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            if (ev.target?.result) {
              loadImageFromURL(ev.target.result as string);
            }
          };
          reader.readAsDataURL(file);
          e.preventDefault();
          return;
        }
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          loadImageFromURL(ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageLoaded) return;
    setDragMoved(false);
    setImageState((prev) => ({
      ...prev,
      dragging: true,
      lastX: e.clientX,
      lastY: e.clientY,
    }));
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!imageState.dragging) return;
    const dx = e.clientX - imageState.lastX;
    const dy = e.clientY - imageState.lastY;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) setDragMoved(true);
    
    setImageState((prev) => ({
      ...prev,
      offsetX: prev.offsetX + dx,
      offsetY: prev.offsetY + dy,
      lastX: e.clientX,
      lastY: e.clientY,
    }));
  }, [imageState.dragging, imageState.lastX, imageState.lastY]);

  const handleMouseUp = useCallback(() => {
    setImageState((prev) => ({ ...prev, dragging: false }));
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!imageLoaded) return;
    e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const delta = -e.deltaY;
    const zoomFactor = Math.exp(delta * 0.0012);
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    const beforeX = (mx - imageState.offsetX) / imageState.scale;
    const beforeY = (my - imageState.offsetY) / imageState.scale;
    
    const newScale = Math.max(0.05, Math.min(5, imageState.scale * zoomFactor));
    
    setImageState((prev) => ({
      ...prev,
      scale: newScale,
      offsetX: mx - beforeX * newScale,
      offsetY: my - beforeY * newScale,
    }));
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!imageLoaded) return;
    const step = 2;
    
    setImageState((prev) => {
      switch (e.key) {
        case "ArrowUp":
          return { ...prev, offsetY: prev.offsetY - step };
        case "ArrowDown":
          return { ...prev, offsetY: prev.offsetY + step };
        case "ArrowLeft":
          return { ...prev, offsetX: prev.offsetX - step };
        case "ArrowRight":
          return { ...prev, offsetX: prev.offsetX + step };
        default:
          return prev;
      }
    });
  }, [imageLoaded]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleZoomChange = (value: number[]) => {
    if (!imageLoaded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const newScale = value[0];
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    
    const beforeX = (cx - imageState.offsetX) / imageState.scale;
    const beforeY = (cy - imageState.offsetY) / imageState.scale;
    
    setImageState((prev) => ({
      ...prev,
      scale: newScale,
      offsetX: cx - beforeX * newScale,
      offsetY: cy - beforeY * newScale,
    }));
  };

  const handlePaperPresetChange = (value: string) => {
    setPaperPreset(value);
    if (value === "4x6") {
      setPaperSize({ w: 4, h: 6 });
    } else if (value === "a4") {
      setPaperSize({ w: 8.27, h: 11.69 });
    }
  };

  const applyCustomPaper = () => {
    const w = parseFloat(customPaper.w) || 4;
    const h = parseFloat(customPaper.h) || 6;
    setPaperSize({ w, h });
    toast.success("Custom paper size applied");
  };

  const applyCropSize = () => {
    const w = parseFloat(cropInput.w) || 1.13;
    const h = parseFloat(cropInput.h) || 1.37;
    setCropSize({ w, h });
    toast.success("Crop size applied");
  };

  const handlePresetClick = (w: string, h: string) => {
    const parseValue = (val: string) => {
      if (val.endsWith("mm")) return mmToIn(parseFloat(val));
      if (val.endsWith("in")) return parseFloat(val);
      return parseFloat(val);
    };
    
    const wIn = parseValue(w);
    const hIn = parseValue(h);
    
    setCropInput({ w: wIn.toFixed(2), h: hIn.toFixed(2) });
    setCropSize({ w: wIn, h: hIn });
    toast.success("Preset applied");
  };

  const handleExport = () => {
    if (!imageLoaded || !image) {
      toast.error("Load an image first");
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const cropPxW = inchesToPx(cropSize.w);
    const cropPxH = inchesToPx(cropSize.h);
    const cropX = Math.round((canvas.width - cropPxW) / 2);
    const cropY = Math.round((canvas.height - cropPxH) / 2);
    
    const outCanvas = document.createElement("canvas");
    outCanvas.width = cropPxW;
    outCanvas.height = cropPxH;
    const outCtx = outCanvas.getContext("2d", { alpha: true });
    if (!outCtx) return;
    
    outCtx.fillStyle = "#fff";
    outCtx.fillRect(0, 0, outCanvas.width, outCanvas.height);
    outCtx.save();
    outCtx.translate(imageState.offsetX - cropX, imageState.offsetY - cropY);
    outCtx.scale(imageState.scale, imageState.scale);
    outCtx.drawImage(image, 0, 0);
    outCtx.restore();
    
    const dataUrl = outCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `crop_${outCanvas.width}x${outCanvas.height}_px.png`;
    link.click();
    
    toast.success("Image exported successfully");
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (dragMoved) {
      setDragMoved(false);
      return;
    }
    if (!imageLoaded) {
      fileInputRef.current?.click();
    }
  };

  const cropPxW = inchesToPx(cropSize.w);
  const cropPxH = inchesToPx(cropSize.h);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-card p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 text-center">
          <h1 className="mb-2 text-3xl font-bold text-foreground">Image Cropper</h1>
          <p className="text-sm text-muted-foreground">
            Precise image cropping with inch/mm presets • Paste, upload or drag images
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Canvas Area */}
          <Card className="relative overflow-hidden bg-gradient-to-br from-card to-muted/10 p-4 shadow-lg">
            <div className="absolute left-4 top-4 z-10 rounded-lg bg-black/40 px-3 py-2 text-sm backdrop-blur-sm">
              <div className="font-semibold text-accent">
                {paperSize.w.toFixed(2)} in × {paperSize.h.toFixed(2)} in
              </div>
              <div className="text-xs text-muted-foreground">
                Canvas: {inchesToPx(paperSize.w)} × {inchesToPx(paperSize.h)} px
              </div>
            </div>

            <div
              className={`relative flex min-h-[500px] items-center justify-center rounded-lg border-2 border-dashed transition-all ${
                isDragging
                  ? "border-accent bg-accent/5 shadow-[0_0_40px_rgba(94,234,212,0.3)]"
                  : "border-border bg-background/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleCanvasClick}
            >
              <canvas
                ref={canvasRef}
                className={`max-w-full rounded-md shadow-2xl ${
                  imageLoaded ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                }`}
                onMouseDown={handleMouseDown}
                onWheel={handleWheel}
              />
              {!imageLoaded && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                  <Upload className="h-12 w-12 text-muted-foreground/50" />
                  <p className="text-muted-foreground">
                    Drop an image here, paste (Ctrl+V) or click to upload
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Pan: drag • Zoom: wheel • Arrow keys for fine adjustment
              </p>
              <div className="flex gap-2">
                <Button onClick={resetImageState} variant="outline" size="sm" disabled={!imageLoaded}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
                <Button onClick={handleExport} size="sm" disabled={!imageLoaded}>
                  <Download className="mr-2 h-4 w-4" />
                  Export PNG
                </Button>
              </div>
            </div>
          </Card>

          {/* Controls Panel */}
          <div className="space-y-4">
            <Card className="bg-card/80 p-4 backdrop-blur-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-accent">
                <Maximize2 className="h-4 w-4" />
                Paper / Viewport
              </h2>
              
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Paper preset</Label>
                  <Select value={paperPreset} onValueChange={handlePaperPresetChange}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4x6">4 in × 6 in (default)</SelectItem>
                      <SelectItem value="a4">A4 (8.27 in × 11.69 in)</SelectItem>
                      <SelectItem value="custom">Custom (inches)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {paperPreset === "custom" && (
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Width (in)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.1"
                        value={customPaper.w}
                        onChange={(e) => setCustomPaper((prev) => ({ ...prev, w: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <span className="pb-2 text-muted-foreground">×</span>
                    <div className="flex-1">
                      <Label className="text-xs">Height (in)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.1"
                        value={customPaper.h}
                        onChange={(e) => setCustomPaper((prev) => ({ ...prev, h: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <Button onClick={applyCustomPaper} size="sm">
                      Apply
                    </Button>
                  </div>
                )}

                <div>
                  <Label className="text-xs">DPI</Label>
                  <Select value={dpi.toString()} onValueChange={(v) => setDpi(parseInt(v))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="300">300 DPI (print)</SelectItem>
                      <SelectItem value="76">76 DPI (screen)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            <Card className="bg-card/80 p-4 backdrop-blur-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-accent">
                <Minimize2 className="h-4 w-4" />
                Crop Size
              </h2>
              
              <div className="space-y-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Width (in)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={cropInput.w}
                      onChange={(e) => setCropInput((prev) => ({ ...prev, w: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <span className="pb-2 text-muted-foreground">×</span>
                  <div className="flex-1">
                    <Label className="text-xs">Height (in)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={cropInput.h}
                      onChange={(e) => setCropInput((prev) => ({ ...prev, h: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <Button onClick={applyCropSize} size="sm">
                    Apply
                  </Button>
                </div>

                <div>
                  <Label className="text-xs">Quick presets</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handlePresetClick("35mm", "45mm")}
                    >
                      35×45 mm
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handlePresetClick("30mm", "40mm")}
                    >
                      30×40 mm
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handlePresetClick("32mm", "40mm")}
                    >
                      32×40 mm
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handlePresetClick("1.13in", "1.37in")}
                    >
                      1.13×1.37 in
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handlePresetClick("2in", "2in")}
                    >
                      2×2 in
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="bg-card/80 p-4 backdrop-blur-sm">
              <h2 className="mb-3 text-sm font-semibold text-accent">Image Controls</h2>
              
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Zoom: {imageState.scale.toFixed(2)}x</Label>
                  <Slider
                    value={[imageState.scale]}
                    onValueChange={handleZoomChange}
                    min={0.05}
                    max={5}
                    step={0.01}
                    className="mt-2"
                    disabled={!imageLoaded}
                  />
                </div>

                <div>
                  <Label className="text-xs">Fit mode</Label>
                  <Select value={fitMode} onValueChange={(v: any) => setFitMode(v)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fit">Fit to viewport</SelectItem>
                      <SelectItem value="fill">Fill viewport (crop)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-md bg-muted/30 p-2 text-xs font-mono text-muted-foreground">
                  <div>Position: x:{Math.round(imageState.offsetX)} y:{Math.round(imageState.offsetY)}</div>
                  <div>Scale: {imageState.scale.toFixed(3)}</div>
                </div>
              </div>
            </Card>

            <Card className="bg-card/80 p-4 backdrop-blur-sm">
              <h2 className="mb-3 text-sm font-semibold text-accent">Export Info</h2>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div>Crop size: {cropPxW} × {cropPxH} px</div>
                <div>Resolution: {dpi} DPI</div>
                <div>Physical: {cropSize.w.toFixed(2)} × {cropSize.h.toFixed(2)} in</div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
