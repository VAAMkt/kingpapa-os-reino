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
import { ProductImageDialog } from "@/components/admin/ProductImageDialog";

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
  nombre_override: string | null;
  orden: number;
  activo: boolean;
};
type MEClass = "star" | "plowhorse" | "puzzle" | "dog" | null;
type Prod = {
  id: string;
  rp_id: number;
  categoria_id: string | null;
  nombre: string;
  nombre_override: string | null;
  descripcion: string | null;
  descripcion_override: string | null;
  precio: number;
  imagen_url: string | null;
  imagen_override_url: string | null;
  imagen_source: string | null;
  imagen_updated_at: string | null;
  disponible: boolean;
  orden: number;
  destacado: boolean;
  es_nuevo: boolean;
  es_mas_vendido: boolean;
  es_recomendado: boolean;
  etiqueta_custom: string | null;
  clasificacion_me: MEClass;
  margen_pct: number | null;
};



function AdminMenuPage() {
  const queryClient = useQueryClient();
  const [hideInactive, setHideInactive] = useState(false);
  const [editImageProd, setEditImageProd] = useState<Prod | null>(null);


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

  type CatPatch = {
    id: string;
    activo?: boolean;
    nombre_override?: string | null;
  };
  const catMut = useMutation({
    mutationFn: (v: CatPatch) => updateCat({ data: v }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  type ProdPatch = {
    id: string;
    disponible?: boolean;
    destacado?: boolean;
    es_nuevo?: boolean;
    es_mas_vendido?: boolean;
    es_recomendado?: boolean;
    etiqueta_custom?: string | null;
    clasificacion_me?: MEClass;
    margen_pct?: number | null;
    nombre_override?: string | null;
    descripcion_override?: string | null;
  };
  const prodMut = useMutation({
    mutationFn: (v: ProdPatch) => updateProd({ data: v }),
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
                        onPatch={(patch) => prodMut.mutate({ id: p.id, ...patch })}
                        onEditImagen={() => setEditImageProd(p)}
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
  onPatch,
}: {
  prod: Prod;
  idx: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
  onPatch: (patch: Partial<{
    disponible: boolean;
    destacado: boolean;
    es_nuevo: boolean;
    es_mas_vendido: boolean;
    es_recomendado: boolean;
    etiqueta_custom: string | null;
    clasificacion_me: MEClass;
    margen_pct: number | null;
    nombre_override: string | null;
  }>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: prod.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const Pill = ({
    label,
    active,
    onClick,
    title,
  }: {
    label: string;
    active: boolean;
    onClick: () => void;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`h-7 px-2 border-2 border-kp-ink font-display uppercase text-[10px] shadow-brutal-sm transition-all ${
        active ? "bg-kp-red text-kp-cheese" : "bg-kp-cheese text-kp-ink hover:bg-kp-yellow"
      }`}
    >
      {label}
    </button>
  );

  const displayName = prod.nombre_override ?? prod.nombre;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border-2 border-kp-ink bg-kp-cheese p-2 shadow-brutal-sm space-y-2"
    >
      <div className="grid grid-cols-[24px_48px_1fr_auto_auto] gap-2 items-center">
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
            {displayName}
            {prod.nombre_override && (
              <span className="ml-2 text-[10px] text-kp-ink/50">(editado)</span>
            )}
            {!prod.disponible && (
              <span className="ml-2 text-xs text-kp-ink/50">(oculto)</span>
            )}
          </p>
          <p className="text-xs text-kp-ink/60">
            ${Number(prod.precio).toLocaleString("es-CO")}
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            disabled={idx === 0}
            onClick={() => onMove(-1)}
            aria-label="Subir"
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            disabled={idx === total - 1}
            onClick={() => onMove(1)}
            aria-label="Bajar"
          >
            <ArrowDown className="size-4" />
          </Button>
        </div>
        <Switch
          checked={prod.disponible}
          onCheckedChange={(v) => onPatch({ disponible: v })}
        />
      </div>

      {/* Ingeniería de menú: badges + clasificación */}
      <div className="flex flex-wrap gap-1 items-center pl-[60px]">
        <Pill
          label="★ Destacado"
          active={prod.destacado}
          onClick={() => onPatch({ destacado: !prod.destacado })}
          title="Sale grande en el menú (col-span-2)"
        />
        <Pill
          label="🆕 Nuevo"
          active={prod.es_nuevo}
          onClick={() => onPatch({ es_nuevo: !prod.es_nuevo })}
          title="Badge NUEVO"
        />
        <Pill
          label="🔥 Top"
          active={prod.es_mas_vendido}
          onClick={() => onPatch({ es_mas_vendido: !prod.es_mas_vendido })}
          title="Badge Más vendido + entra a Coronas del Rey"
        />
        <Pill
          label="👑 Reco"
          active={prod.es_recomendado}
          onClick={() => onPatch({ es_recomendado: !prod.es_recomendado })}
          title="Badge Recomendado del chef"
        />
        <select
          value={prod.clasificacion_me ?? ""}
          onChange={(e) =>
            onPatch({
              clasificacion_me: (e.target.value || null) as MEClass,
            })
          }
          className="h-7 border-2 border-kp-ink bg-kp-cheese px-1 font-display uppercase text-[10px] shadow-brutal-sm"
          title="Matriz Kasavana & Smith: Estrella (alta pop, alto margen) / Caballo (alta pop, bajo margen) / Puzzle (baja pop, alto margen) / Perro (baja pop, bajo margen)"
        >
          <option value="">— ME —</option>
          <option value="star">★ Estrella</option>
          <option value="plowhorse">🐴 Caballo</option>
          <option value="puzzle">🧩 Puzzle</option>
          <option value="dog">🐶 Perro</option>
        </select>
        <input
          type="text"
          defaultValue={prod.etiqueta_custom ?? ""}
          placeholder="Etiqueta libre"
          maxLength={40}
          onBlur={(e) => {
            const val = e.target.value.trim();
            if (val !== (prod.etiqueta_custom ?? "")) {
              onPatch({ etiqueta_custom: val || null });
            }
          }}
          className="h-7 border-2 border-kp-ink bg-kp-cheese px-2 font-display uppercase text-[10px] shadow-brutal-sm w-32"
        />
        <input
          type="text"
          defaultValue={prod.nombre_override ?? ""}
          placeholder="Renombrar"
          maxLength={120}
          onBlur={(e) => {
            const val = e.target.value.trim();
            if (val !== (prod.nombre_override ?? "")) {
              onPatch({ nombre_override: val || null });
            }
          }}
          className="h-7 border-2 border-kp-ink bg-kp-cheese px-2 font-display uppercase text-[10px] shadow-brutal-sm w-40"
          title="Cambia el nombre que ve el cliente sin perder el del POS"
        />
      </div>
    </div>
  );
}

