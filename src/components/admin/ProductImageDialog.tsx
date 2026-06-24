import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, RotateCcw, ImageIcon } from "lucide-react";
import { uploadProductoImagen, revertProductoImagen } from "@/lib/rp.functions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producto: {
    id: string;
    nombre: string;
    imagen_url: string | null;
    imagen_override_url: string | null;
  } | null;
};

// Comprime a WebP en el cliente (máx 1200px lado largo, calidad 0.85).
// Fallback al File original si el navegador no soporta encode.
async function compressToWebp(file: File, max = 1200, quality = 0.85): Promise<File> {
  try {
    const img = await createImageBitmap(file);
    const ratio = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), "image/webp", quality),
    );
    if (!blob) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}

export function ProductImageDialog({ open, onOpenChange, producto }: Props) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFn = useServerFn(uploadProductoImagen);
  const revertFn = useServerFn(revertProductoImagen);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreviewUrl(null);
    }
  }, [open]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!producto || !file) throw new Error("Falta producto o archivo");
      const compressed = await compressToWebp(file);
      const fd = new FormData();
      fd.append("producto_id", producto.id);
      fd.append("file", compressed);
      return uploadFn({ data: fd });
    },
    onMutate: async () => {
      if (!producto || !file) return { prev: null };
      await queryClient.cancelQueries({ queryKey: ["admin-menu-master"] });
      const prev = queryClient.getQueryData(["admin-menu-master"]);
      const optimisticUrl = URL.createObjectURL(file);
      queryClient.setQueryData<{ productos: unknown[]; categorias: unknown[] }>(
        ["admin-menu-master"],
        (old) => {
          if (!old) return old as never;
          return {
            ...old,
            productos: (old.productos as Array<{ id: string }>).map((p) =>
              p.id === producto.id
                ? { ...p, imagen_override_url: optimisticUrl, imagen_source: "admin" }
                : p,
            ),
          };
        },
      );
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["admin-menu-master"], ctx.prev);
      toast.error(e.message);
    },
    onSuccess: () => {
      toast.success("Foto actualizada");
      queryClient.invalidateQueries({ queryKey: ["admin-menu-master"] });
      queryClient.invalidateQueries({ queryKey: ["menu"] });
      onOpenChange(false);
    },
  });

  const revertMut = useMutation({
    mutationFn: () => {
      if (!producto) throw new Error("Sin producto");
      return revertFn({ data: { id: producto.id } });
    },
    onMutate: async () => {
      if (!producto) return { prev: null };
      await queryClient.cancelQueries({ queryKey: ["admin-menu-master"] });
      const prev = queryClient.getQueryData(["admin-menu-master"]);
      queryClient.setQueryData<{ productos: unknown[]; categorias: unknown[] }>(
        ["admin-menu-master"],
        (old) => {
          if (!old) return old as never;
          return {
            ...old,
            productos: (old.productos as Array<{ id: string }>).map((p) =>
              p.id === producto.id
                ? { ...p, imagen_override_url: null, imagen_source: "rp" }
                : p,
            ),
          };
        },
      );
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["admin-menu-master"], ctx.prev);
      toast.error(e.message);
    },
    onSuccess: () => {
      toast.success("Foto revertida al POS");
      queryClient.invalidateQueries({ queryKey: ["admin-menu-master"] });
      queryClient.invalidateQueries({ queryKey: ["menu"] });
      onOpenChange(false);
    },
  });

  const currentUrl = producto?.imagen_override_url ?? producto?.imagen_url ?? null;
  const showPreview = previewUrl ?? currentUrl;
  const busy = uploadMut.isPending || revertMut.isPending;

  const handlePick = (f: File | null) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
      toast.error("Formato no soportado (jpeg/png/webp)");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      toast.error("Imagen > 8MB");
      return;
    }
    setFile(f);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display uppercase text-2xl">
            Foto: {producto?.nombre}
          </DialogTitle>
          <DialogDescription>
            La foto custom reemplaza la del POS en el menú público.
            La sincronización con Restaurant.pe nunca la pisa.
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handlePick(f);
          }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed border-kp-ink p-4 text-center cursor-pointer transition-colors ${
            dragging ? "bg-kp-yellow" : "bg-kp-cheese"
          }`}
        >
          {showPreview ? (
            <img
              src={showPreview}
              alt=""
              className="max-h-64 w-auto mx-auto border-2 border-kp-ink"
            />
          ) : (
            <div className="py-10 flex flex-col items-center gap-2 text-kp-ink/60">
              <ImageIcon className="size-10" />
              <p className="font-display uppercase text-sm">Sin foto</p>
            </div>
          )}
          <p className="mt-3 text-xs font-display uppercase text-kp-ink/70">
            Arrastra una imagen o haz click. JPG, PNG o WebP. Máx 8MB.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handlePick(e.target.files?.[0] ?? null)}
          />
        </div>

        {file && (
          <p className="text-xs text-kp-ink/60">
            Seleccionado: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(0)} KB)
          </p>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {producto?.imagen_override_url && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => revertMut.mutate()}
              className="sm:mr-auto"
            >
              <RotateCcw className="size-4 mr-2" />
              Revertir a original
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!file || busy}
            onClick={() => uploadMut.mutate()}
          >
            <Upload className="size-4 mr-2" />
            {uploadMut.isPending ? "Subiendo…" : "Guardar foto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
