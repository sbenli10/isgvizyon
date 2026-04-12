import { useState, useRef } from "react";
import { Camera, Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ImageUploadProps {
  onImageSelected: (file: File) => void;
  currentImage?: string | null;
  onRemoveImage?: () => void;
  disabled?: boolean;
}

export function ImageUpload({ onImageSelected, currentImage, onRemoveImage, disabled }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen bir resim dosyası seçin");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Dosya boyutu 5MB'dan küçük olmalıdır");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    onImageSelected(file);
  };

  const handleRemove = () => {
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    onRemoveImage?.();
  };

  return (
    <div className="space-y-3">
      {preview ? (
        <div className="relative rounded-lg overflow-hidden border-2 border-border bg-secondary/30">
          <img src={preview} alt="Önizleme" className="w-full h-64 object-cover" />
          <button
            onClick={handleRemove}
            disabled={disabled}
            className="absolute top-2 right-2 p-2 rounded-full bg-destructive/90 hover:bg-destructive text-white transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center bg-secondary/20">
          <ImageIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground mb-4">Saha fotoğrafı ekleyin</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
              disabled={disabled}
            />
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => cameraInputRef.current?.click()}
              disabled={disabled || uploading}
              className="gap-2 h-14 text-base"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Camera className="h-5 w-5" />
              )}
              Fotoğraf Çek
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              disabled={disabled}
            />
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading}
              className="gap-2 h-14 text-base"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Upload className="h-5 w-5" />
              )}
              Galeriden Seç
            </Button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Maksimum dosya boyutu: 5MB • Desteklenen formatlar: JPG, PNG, WEBP
      </p>
    </div>
  );
}
