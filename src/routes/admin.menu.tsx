import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  listAdminMenu,
  updateAdminCategoria,
  updateAdminProducto,
  reorderAdminCategorias,
  reorderAdminProductos,
} from "@/lib/rp.functions";

export const Route = createFileRoute("/admin/menu")({
  head: () => ({ meta: [{ title: "Menú maestro — Admin" }] }),
  component: AdminMenuPage,
});

type Cat = {
  id: string;
  rp_id: number;
  nombre: string;
  orden: number;
  activo: boolean;
};
type Prod = {
  id: string;
  rp_id: number;
  categoria_id: string | null;
  nombre: string;
  precio: number;
  imagen_url: string | null;
  disponible: boolean;
  orden: number;
};

function AdminMenuPage() {
  const queryClient = useQueryClient();
  const [hideInactive, setHideInactive] = useState(false);

  const fetchMenu = useServerFn(listAdminMenu);
  const menuQ = useQuery({
    queryKey: ["admin-menu-master"],
    queryFn: () => fetchMenu(),
  });

  const updateCat = useServerFn(updateAdminCategoria);
  const updateProd = useServerFn(updateAdminProducto);
  const reorderCats = useServerFn(reorderAdminCategorias);
  const reorderProds = useServerFn(reorderAdminProductos);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-menu-master"] });
    queryClient.invalidateQueries({ queryKey: ["menu"] });
  };

  const catMut = useMutation({
    mutationFn: (v: { id: string; activo: boolean }) => updateCat({ data: v }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const prodMut = useMutation({
    mutationFn: (v: { id: string; disponible: boolean }) => updateProd({ data: v }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderCatsMut = useMutation({
    mutationFn: (updates: { id: string; orden: number }[]) =>
      reorderCats({ data: { updates } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderProdsMut = useMutation({
    mutationFn: (updates: { id: string; orden: number }[]) =>
      reorderProds({ data: { updates } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const categorias = (menuQ.data?.categorias ?? []) as Cat[];
  const productos = (menuQ.data?.productos ?? []) as Prod[];

  const visibleCategorias = useMemo(
    () => (hideInactive ? categorias.filter((c) => c.activo) : categorias),
    [categorias, hideInactive],
  );

  const prodsByCat = useMemo(() => {
    const m = new Map<string, Prod[]>();
    for (const p of productos) {
      if (hideInactive && !p.disponible) continue;
      const k = p.categoria_id ?? "_sin";
      const arr = m.get(k) ?? [];
      arr.push(p);
      m.set(k, arr);
    }
    return m;
  }, [productos, hideInactive]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleCatsDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = visibleCategorias.findIndex((c) => c.id === active.id);
    const newIdx = visibleCategorias.findIndex((c) => c.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(visibleCategorias, oldIdx, newIdx);
    reorderCatsMut.mutate(next.map((c, i) => ({ id: c.id, orden: (i + 1) * 10 })));
  };

  const handleProdsDragEnd = (catId: string) => (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const list = prodsByCat.get(catId) ?? [];
    const oldIdx = list.findIndex((p) => p.id === active.id);
    const newIdx = list.findIndex((p) => p.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(list, oldIdx, newIdx);
    reorderProdsMut.mutate(next.map((p, i) => ({ id: p.id, orden: (i + 1) * 10 })));
  };

  const moveCat = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= visibleCategorias.length) return;
    const next = arrayMove(visibleCategorias, idx, target);
    reorderCatsMut.mutate(next.map((c, i) => ({ id: c.id, orden: (i + 1) * 10 })));
  };

  const moveProd = (catId: string, idx: number, dir: -1 | 1) => {
    const list = prodsByCat.get(catId) ?? [];
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    const next = arrayMove(list, idx, target);
    reorderProdsMut.mutate(next.map((p, i) => ({ id: p.id, orden: (i + 1) * 10 })));
  };

  return (
    <div className="space-y-6">
      <header>
        <BrutalBadge tone="yellow">Menú maestro</BrutalBadge>
        <h1 className="font-display text-3xl uppercase mt-2 leading-none">
          Catálogo global de la marca
        </h1>
        <p className="text-sm text-kp-ink/70 mt-1">
          Una sola lista para las {/* */}14 sedes. Reordena, oculta o renombra acá y
          se refleja en todo el reino al instante. Para apagar un producto solo en
          una sede (agotado), usa el panel de cada sede.
        </p>
      </header>

      <BrutalCard tone="cheese" className="p-4 flex items-center gap-4">
        <label className="flex items-center gap-2 font-display uppercase text-sm">
          <Switch checked={hideInactive} onCheckedChange={setHideInactive} />
          Ocultar inactivos
        </label>
        <span className="text-xs text-kp-ink/60 ml-auto">
          {categorias.length} categorías · {productos.length} productos
        </span>
      </BrutalCard>

      {menuQ.isLoading && <p className="text-sm">Cargando catálogo…</p>}

      {menuQ.data && (
        <BrutalCard tone="cheese" className="p-4 space-y-3">
          <h2 className="font-display uppercase text-lg">Categorías</h2>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCatsDragEnd}>
            <SortableContext items={visibleCategorias.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <div className="grid gap-2">
                {visibleCategorias.map((c, idx) => (
                  <SortableCatRow
                    key={c.id}
                    cat={c}
                    idx={idx}
                    total={visibleCategorias.length}
                    onMove={(d) => moveCat(idx, d)}
                    onToggle={(v) => catMut.mutate({ id: c.id, activo: v })}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </BrutalCard>
      )}

      {menuQ.data &&
        visibleCategorias.map((c) => {
          const list = prodsByCat.get(c.id) ?? [];
          if (list.length === 0) return null;
          return (
            <BrutalCard key={c.id} tone="cheese" className="p-4 space-y-3">
              <h3 className="font-display uppercase text-base">
                {c.nombre}{" "}
                <span className="text-kp-ink/50 text-xs">({list.length})</span>
              </h3>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleProdsDragEnd(c.id)}>
                <SortableContext items={list.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  <div className="grid gap-2">
                    {list.map((p, idx) => (
                      <SortableProdRow
                        key={p.id}
                        prod={p}
                        idx={idx}
                        total={list.length}
                        onMove={(d) => moveProd(c.id, idx, d)}
                        onToggle={(v) => prodMut.mutate({ id: p.id, disponible: v })}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </BrutalCard>
          );
        })}

      {menuQ.data && categorias.length === 0 && (
        <p className="text-sm">
          El catálogo maestro está vacío. Ve a Sincronización para importarlo desde Restaurant.pe.
        </p>
      )}
    </div>
  );
}

function SortableCatRow({
  cat,
  idx,
  total,
  onMove,
  onToggle,
}: {
  cat: Cat;
  idx: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
  onToggle: (v: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cat.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[32px_1fr_auto_auto] gap-2 items-center border-2 border-kp-ink bg-kp-cheese p-2 shadow-brutal-sm"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-kp-ink/60 hover:text-kp-ink"
        aria-label="Arrastrar para reordenar"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="font-display uppercase text-sm truncate">
        {cat.nombre}
        {!cat.activo && <span className="ml-2 text-xs text-kp-ink/50">(oculta)</span>}
      </span>
      <div className="flex gap-1">
        <Button size="icon" variant="outline" className="h-8 w-8" disabled={idx === 0} onClick={() => onMove(-1)} aria-label="Subir">
          <ArrowUp className="size-4" />
        </Button>
        <Button size="icon" variant="outline" className="h-8 w-8" disabled={idx === total - 1} onClick={() => onMove(1)} aria-label="Bajar">
          <ArrowDown className="size-4" />
        </Button>
      </div>
      <Switch checked={cat.activo} onCheckedChange={onToggle} />
    </div>
  );
}

function SortableProdRow({
  prod,
  idx,
  total,
  onMove,
  onToggle,
}: {
  prod: Prod;
  idx: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
  onToggle: (v: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: prod.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[24px_48px_1fr_auto_auto] gap-2 items-center border-2 border-kp-ink bg-kp-cheese p-2 shadow-brutal-sm"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-kp-ink/60 hover:text-kp-ink"
        aria-label="Arrastrar para reordenar"
      >
        <GripVertical className="size-4" />
      </button>
      <div className="w-12 h-12 border-2 border-kp-ink bg-kp-yellow overflow-hidden">
        {prod.imagen_url ? (
          <img
            src={prod.imagen_url}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="font-display uppercase text-sm truncate">
          {prod.nombre}
          {!prod.disponible && <span className="ml-2 text-xs text-kp-ink/50">(oculto)</span>}
        </p>
        <p className="text-xs text-kp-ink/60">${Number(prod.precio).toLocaleString("es-CO")}</p>
      </div>
      <div className="flex gap-1">
        <Button size="icon" variant="outline" className="h-8 w-8" disabled={idx === 0} onClick={() => onMove(-1)} aria-label="Subir">
          <ArrowUp className="size-4" />
        </Button>
        <Button size="icon" variant="outline" className="h-8 w-8" disabled={idx === total - 1} onClick={() => onMove(1)} aria-label="Bajar">
          <ArrowDown className="size-4" />
        </Button>
      </div>
      <Switch checked={prod.disponible} onCheckedChange={onToggle} />
    </div>
  );
}
