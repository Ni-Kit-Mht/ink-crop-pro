import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { X, Printer, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type PhotoOnPage = {
  id: string;
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
};

type PageSize = {
  name: string;
  widthIn: number;
  heightIn: number;
};

const PAGE_SIZES: Record<string, PageSize> = {
  "4x6": { name: "4×6 inches", widthIn: 4, heightIn: 6 },
  "a4": { name: "A4 (8.27×11.69 in)", widthIn: 8.27, heightIn: 11.69 },
};

interface PrintLayoutEditorProps {
  savedCrops: Array<{ id: string; dataUrl: string; width: number; height: number }>;
  onClose: () => void;
}

export const PrintLayoutEditor = ({ savedCrops, onClose }: PrintLayoutEditorProps) => {
  const [pageSize, setPageSize] = useState<string>("4x6");
  const [photos, setPhotos] = useState<PhotoOnPage[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const pageRef = useRef<HTMLDivElement>(null);

  const DPI = 96; // Screen DPI for display
  const currentPageSize = PAGE_SIZES[pageSize];
  const pageWidthPx = currentPageSize.widthIn * DPI;
  const pageHeightPx = currentPageSize.heightIn * DPI;

  const handleAddPhoto = (crop: { id: string; dataUrl: string; width: number; height: number }) => {
    // Add photo to center of page
    const photoWidth = 100;
    const photoHeight = (crop.height / crop.width) * photoWidth;
    
    const newPhoto: PhotoOnPage = {
      id: `photo-${Date.now()}-${Math.random()}`,
      dataUrl: crop.dataUrl,
      x: (pageWidthPx - photoWidth) / 2,
      y: (pageHeightPx - photoHeight) / 2,
      width: photoWidth,
      height: photoHeight,
      originalWidth: crop.width,
      originalHeight: crop.height,
    };
    
    setPhotos([...photos, newPhoto]);
    toast.success("Photo added to layout");
  };

  const handleDeletePhoto = (photoId: string) => {
    setPhotos(photos.filter(p => p.id !== photoId));
    if (selectedPhotoId === photoId) setSelectedPhotoId(null);
  };

  const handleMouseDown = (e: React.MouseEvent, photoId: string) => {
    e.stopPropagation();
    setSelectedPhotoId(photoId);
    setDragging(true);
    
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return;
    
    const rect = pageRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setDragOffset({
      x: e.clientX - rect.left - photo.x,
      y: e.clientY - rect.top - photo.y,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging || !selectedPhotoId) return;
    
    const rect = pageRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const newX = e.clientX - rect.left - dragOffset.x;
    const newY = e.clientY - rect.top - dragOffset.y;
    
    setPhotos(prevPhotos => prevPhotos.map(p => 
      p.id === selectedPhotoId 
        ? { ...p, x: Math.max(0, Math.min(newX, pageWidthPx - p.width)), y: Math.max(0, Math.min(newY, pageHeightPx - p.height)) }
        : p
    ));
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, selectedPhotoId, dragOffset, photos, pageWidthPx, pageHeightPx]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!selectedPhotoId) return;
    
    const step = e.shiftKey ? 10 : 1;
    let handled = false;
    
    setPhotos(prevPhotos => {
      return prevPhotos.map(p => {
        if (p.id !== selectedPhotoId) return p;
        
        let newX = p.x;
        let newY = p.y;
        
        switch (e.key) {
          case 'ArrowLeft':
            newX = Math.max(0, p.x - step);
            handled = true;
            break;
          case 'ArrowRight':
            newX = Math.min(pageWidthPx - p.width, p.x + step);
            handled = true;
            break;
          case 'ArrowUp':
            newY = Math.max(0, p.y - step);
            handled = true;
            break;
          case 'ArrowDown':
            newY = Math.min(pageHeightPx - p.height, p.y + step);
            handled = true;
            break;
          case 'Delete':
          case 'Backspace':
            // Handle deletion separately to avoid returning modified photo
            setTimeout(() => handleDeletePhoto(p.id), 0);
            handled = true;
            return p;
        }
        
        if (handled) e.preventDefault();
        return { ...p, x: newX, y: newY };
      });
    });
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhotoId, photos, pageWidthPx, pageHeightPx]);

  const handlePrint = () => {
    if (photos.length === 0) {
      toast.error("Add at least one photo to print");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `<!DOCTYPE html>
<html>
<head>
<title>Print Layout</title>
<style>
@page {
  size: ${currentPageSize.widthIn}in ${currentPageSize.heightIn}in;
  margin: 0;
}
* {
  margin: 0 !important;
  padding: 0 !important;
  box-sizing: border-box;
}
html, body {
  width: ${currentPageSize.widthIn}in;
  height: ${currentPageSize.heightIn}in;
  overflow: hidden;
}
body {
  position: relative;
  background: white;
}
.photo {
  position: absolute;
  overflow: hidden;
}
.photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
@media print {
  html, body {
    margin: 0 !important;
    padding: 0 !important;
  }
}
</style>
</head>
<body>
${photos.map(photo => `<div class="photo" style="left:${(photo.x / pageWidthPx) * 100}%;top:${(photo.y / pageHeightPx) * 100}%;width:${(photo.width / pageWidthPx) * 100}%;height:${(photo.height / pageHeightPx) * 100}%"><img src="${photo.dataUrl}" alt="Photo"/></div>`).join('')}
<script>window.onload=()=>{setTimeout(()=>{window.print()},500)};</script>
</body>
</html>`;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-7xl bg-card border-border p-6 my-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Print Layout Editor</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Drag photos to arrange • Use arrow keys to fine-tune • Press Delete to remove
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          {/* Controls */}
          <div className="space-y-4">
            <div>
              <Label className="text-foreground mb-2 block">Page Size</Label>
              <Select value={pageSize} onValueChange={setPageSize}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="4x6">4×6 inches (default)</SelectItem>
                  <SelectItem value="a4">A4 (8.27×11.69 in)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-foreground mb-2 block">Available Photos</Label>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {savedCrops.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No saved crops available</p>
                ) : (
                  savedCrops.map((crop) => (
                    <div
                      key={crop.id}
                      className="flex items-center gap-2 p-2 bg-secondary rounded-lg border border-border hover:border-primary transition-colors"
                    >
                      <img
                        src={crop.dataUrl}
                        alt="Crop"
                        className="w-12 h-12 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground truncate">
                          {crop.width}×{crop.height}px
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAddPhoto(crop)}
                        className="shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 space-y-2">
              <Button
                onClick={handlePrint}
                disabled={photos.length === 0}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Layout
              </Button>
              <Button
                variant="outline"
                onClick={() => setPhotos([])}
                disabled={photos.length === 0}
                className="w-full border-border hover:bg-secondary"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All Photos
              </Button>
            </div>

            {selectedPhotoId && (
              <div className="p-3 bg-muted rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">
                  Selected photo • Use arrow keys to move (Shift for larger steps)
                </p>
              </div>
            )}
          </div>

          {/* Page Preview */}
          <div className="flex flex-col items-center">
            <div className="bg-muted/30 p-8 rounded-lg border border-border">
              <div
                ref={pageRef}
                className="relative bg-white shadow-2xl cursor-crosshair"
                style={{
                  width: `${pageWidthPx}px`,
                  height: `${pageHeightPx}px`,
                }}
                onClick={() => setSelectedPhotoId(null)}
              >
                {/* Grid overlay */}
                <div className="absolute inset-0 pointer-events-none opacity-10">
                  <svg width="100%" height="100%">
                    <defs>
                      <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                        <path d="M 50 0 L 0 0 0 50" fill="none" stroke="gray" strokeWidth="0.5"/>
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                  </svg>
                </div>

                {/* Photos */}
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className={`absolute cursor-move ${
                      selectedPhotoId === photo.id
                        ? 'ring-2 ring-primary shadow-lg z-10'
                        : 'hover:ring-2 hover:ring-primary/50'
                    }`}
                    style={{
                      left: `${photo.x}px`,
                      top: `${photo.y}px`,
                      width: `${photo.width}px`,
                      height: `${photo.height}px`,
                    }}
                    onMouseDown={(e) => handleMouseDown(e, photo.id)}
                  >
                    <img
                      src={photo.dataUrl}
                      alt="Photo"
                      className="w-full h-full object-cover pointer-events-none"
                      draggable={false}
                    />
                    {selectedPhotoId === photo.id && (
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePhoto(photo.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}

                {photos.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-gray-400 text-center">
                      Click "+" on a photo to add it to the layout
                    </p>
                  </div>
                )}
              </div>
              <div className="text-center mt-4 text-sm text-muted-foreground">
                {currentPageSize.name} • {photos.length} photo{photos.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
