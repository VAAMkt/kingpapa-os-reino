// SERVER-ONLY: arma el payload del checkout y lo manda a Restaurant.pe.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { rpRegistrarDelivery } from "@/lib/restaurantpe.server";

export type CheckoutInputItem = {
  productoId: string; // productos_master.id (uuid)
  cantidad: number;
  modificadores?: { grupoId: number; opcionId: number }[];
};

export type CheckoutInput = {
  sedeId: string;
  tipo: "delivery" | "pickup";
  pago: "efectivo" | "datafono" | "online";
  cliente: {
    nombre: string;
    telefono: string;
    direccion?: string | null;
    detalles?: string | null;
  };
  notas?: string | null;
  items: CheckoutInputItem[];
  userId?: string | null;
};

type ModOption = { id: number; nombre: string; precio: number };
type ModGroup = { id: number; nombre: string; opciones: ModOption[] };

type ProductoMasterRow = {
  id: string;
  rp_id: number;
  almacen_id: number | null;
  nombre: string;
  precio: number | string;
  modificadores: unknown;
};

type SedeRow = {
  id: string;
  nombre: string;
  rp_local_id: number | null;
};

type DetallePedido = {
  productoId: string;
  nombre: string;
  rp_id: number;
  almacen_id: number | null;
  cantidad: number;
  precio_unitario: number; // ya incluye modificadores
  subtotal: number;
  modificadores: { grupoId: number; opcionId: number; nombre: string; precio: number }[];
};

function toNum(v: unknown, fallback = 0): number {
  if (v == null || v === "") return fallback;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Resuelve sede + productos, recalcula precios server-side (no confía en el cliente)
 * y arma el detalle del pedido.
 */
async function resolveOrder(input: CheckoutInput): Promise<{
  sede: SedeRow;
  detalle: DetallePedido[];
  subtotal: number;
  total: number;
}> {
  // 1) Sede
  const { data: sede, error: sedeErr } = await supabaseAdmin
    .from("sedes")
    .select("id, nombre, rp_local_id")
    .eq("id", input.sedeId)
    .maybeSingle();
  if (sedeErr) throw new Error(sedeErr.message);
  if (!sede) throw new Error("Sede no encontrada");
  if (!sede.rp_local_id)
    throw new Error(`La sede "${sede.nombre}" no tiene rp_local_id asignado`);

  // 2) Productos master
  const productIds = Array.from(new Set(input.items.map((i) => i.productoId)));
  const { data: prods, error: prodErr } = await supabaseAdmin
    .from("productos_master")
    .select("id, rp_id, almacen_id, nombre, precio, modificadores")
    .in("id", productIds);
  if (prodErr) throw new Error(prodErr.message);
  const prodMap = new Map<string, ProductoMasterRow>(
    ((prods ?? []) as ProductoMasterRow[]).map((p) => [p.id, p]),
  );
  for (const id of productIds) {
    if (!prodMap.has(id)) throw new Error(`Producto ${id} no disponible`);
  }

  // 3) Overrides per-sede para precio
  const { data: overrides } = await supabaseAdmin
    .from("sede_producto_overrides")
    .select("producto_id, precio_override, disponible")
    .eq("sede_id", sede.id)
    .in("producto_id", productIds);
  const ovrMap = new Map<string, { precio_override: number | null; disponible: boolean }>(
    ((overrides ?? []) as { producto_id: string; precio_override: number | null; disponible: boolean }[]).map(
      (o) => [o.producto_id, { precio_override: o.precio_override, disponible: o.disponible }],
    ),
  );
  for (const id of productIds) {
    const o = ovrMap.get(id);
    if (o && !o.disponible) {
      const p = prodMap.get(id)!;
      throw new Error(`"${p.nombre}" no está disponible en esta sede`);
    }
  }

  // 4) Armar detalle con precios recalculados
  let subtotal = 0;
  const detalle: DetallePedido[] = input.items.map((it) => {
    const p = prodMap.get(it.productoId)!;
    const ovr = ovrMap.get(it.productoId);
    const precioBase = toNum(ovr?.precio_override ?? p.precio);

    const grupos = (Array.isArray(p.modificadores) ? p.modificadores : []) as ModGroup[];
    const mods: DetallePedido["modificadores"] = [];
    let extra = 0;
    for (const m of it.modificadores ?? []) {
      const grupo = grupos.find((g) => g.id === m.grupoId);
      const opcion = grupo?.opciones.find((o) => o.id === m.opcionId);
      if (!opcion) continue; // descarta silenciosamente modificadores inválidos
      mods.push({
        grupoId: m.grupoId,
        opcionId: m.opcionId,
        nombre: opcion.nombre,
        precio: toNum(opcion.precio),
      });
      extra += toNum(opcion.precio);
    }

    const precio_unitario = precioBase + extra;
    const sub = precio_unitario * it.cantidad;
    subtotal += sub;
    return {
      productoId: p.id,
      nombre: p.nombre,
      rp_id: p.rp_id,
      almacen_id: p.almacen_id,
      cantidad: it.cantidad,
      precio_unitario,
      subtotal: sub,
      modificadores: mods,
    };
  });

  return { sede, detalle, subtotal, total: subtotal };
}

/**
 * Envía el pedido a Restaurant.pe y persiste la copia local en public.orders.
 * Devuelve el id de pedido devuelto por el POS (o el id local si Restaurant.pe
 * responde sin id pero el envío fue exitoso).
 */
export async function submitOrder(input: CheckoutInput): Promise<{
  orderId: string;
  localId: string;
  rpPedidoId: string | null;
  subtotal: number;
  total: number;
}> {
  const { sede, detalle, subtotal, total } = await resolveOrder(input);

  // Payload Restaurant.pe — basado en patrones de la API v2.
  // Si el endpoint rechaza por nombres de campos, queda en rp_sync_log para
  // iterar el shape.
  const payload = {
    local_id: sede.rp_local_id,
    tipo_entrega: input.tipo === "delivery" ? 1 : 2,
    forma_pago: input.pago,
    observaciones: input.notas ?? "",
    cliente: {
      nombres: input.cliente.nombre,
      telefono: input.cliente.telefono,
      direccion: input.cliente.direccion ?? "",
      referencia: input.cliente.detalles ?? "",
    },
    monto_total: total,
    detalle: detalle.map((d) => ({
      producto_id: d.rp_id,
      almacen_id: d.almacen_id,
      cantidad: d.cantidad,
      precio_unitario: d.precio_unitario,
      comentario: "",
      modificadores: d.modificadores.map((m) => ({
        grupo_id: m.grupoId,
        modificador_id: m.opcionId,
        precio: m.precio,
      })),
    })),
  };

  // 1) Insertar registro local como "enviado" (sin rp_pedido_id todavía).
  const itemsSnapshot = detalle.map((d) => ({
    productoId: d.productoId,
    nombre: d.nombre,
    cantidad: d.cantidad,
    precio: d.precio_unitario,
    modificadores: d.modificadores,
  }));
  const { data: orderRow, error: insErr } = await supabaseAdmin
    .from("orders")
    .insert({
      user_id: input.userId ?? null,
      sede_id: sede.id,
      rp_payload: payload as never,
      status: "enviado",
      tipo: input.tipo,
      pago: input.pago,
      cliente: input.cliente as never,
      items: itemsSnapshot as never,
      subtotal,
      total,
      notas: input.notas ?? null,
    } as never)
    .select("id")
    .single();
  if (insErr) throw new Error(`No se pudo guardar el pedido: ${insErr.message}`);
  const localId = (orderRow as { id: string }).id;

  // 2) Llamar a Restaurant.pe.
  let rpResponse: unknown = null;
  let rpPedidoId: string | null = null;
  try {
    rpResponse = await rpRegistrarDelivery(payload);
    // Extraer pedido_id de cualquier forma típica que devuelva la API.
    const r = (rpResponse ?? {}) as Record<string, unknown>;
    const candidates = [
      r.pedido_id,
      r.id,
      r.comanda,
      r.numero,
      r.numero_pedido,
      (r.data as Record<string, unknown> | undefined)?.pedido_id,
      (r.data as Record<string, unknown> | undefined)?.id,
    ];
    for (const c of candidates) {
      if (c != null && String(c).trim() !== "") {
        rpPedidoId = String(c);
        break;
      }
    }

    await supabaseAdmin
      .from("orders")
      .update({
        rp_pedido_id: rpPedidoId,
        rp_response: rpResponse as never,
        status: "enviado",
      } as never)
      .eq("id", localId);

    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "order",
      sede_id: sede.id,
      payload: { request: payload, response: rpResponse, order_id: localId } as never,
      ok: true,
      mensaje: `Pedido enviado a Restaurant.pe (rp_pedido_id=${rpPedidoId ?? "n/d"})`,
    } as never);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabaseAdmin
      .from("orders")
      .update({
        status: "error",
        rp_response: { error: msg } as never,
      } as never)
      .eq("id", localId);
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "order",
      sede_id: sede.id,
      payload: { request: payload, order_id: localId, error: msg } as never,
      ok: false,
      mensaje: `Fallo al enviar pedido a Restaurant.pe: ${msg}`,
    } as never);
    throw new Error(
      "No pudimos enviar tu pedido al sistema de la sede. Intenta de nuevo o contáctanos por WhatsApp.",
    );
  }

  return {
    orderId: rpPedidoId ?? localId,
    localId,
    rpPedidoId,
    subtotal,
    total,
  };
}
