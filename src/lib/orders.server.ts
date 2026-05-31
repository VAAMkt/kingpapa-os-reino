// SERVER-ONLY: arma el payload del checkout y lo manda a Restaurant.pe.
//
// Mapeo de métodos de pago (confirmado en producción contra el POS):
//   delivery_tipopago: 1 = Efectivo (contra entrega)
//                       2 = Datafono / tarjeta presencial (tarjeta_id=1)
//                       5 = Pago online / web (sin pasarela integrada aún)
// TODO(pasarela): cuando se integre la pasarela online (PSE, Mercado Pago, etc.)
//   añadir al payload.delivery: delivery_montopagado (= total) y transaccion_id
//   con el id devuelto por la pasarela, para que el arqueo del POS cuadre.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { rpGetCatalogo, rpGetPedidoListByDelivery, rpRegistrarDelivery } from "@/lib/restaurantpe.server";
import { extractComandaNumber } from "@/lib/restaurantpe-normalize";
import type { RpMenuData, RpProducto } from "@/types/restaurantpe";

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
    lat?: number | null;
    lng?: number | null;
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
  pedido_productoid: number;
  almacen_id: number | null;
  cantidad: number;
  precio_unitario: number; // ya incluye modificadores
  subtotal: number;
  modificadores: { grupoId: number; opcionId: number; nombre: string; precio: number }[];
};

// FASE 3 — horarios + banderas operativas
export type Ventana = { abre: string; cierra: string };
export type HorariosMap = Partial<Record<"lun" | "mar" | "mie" | "jue" | "vie" | "sab" | "dom", Ventana[]>>;

const DIAS: Array<keyof HorariosMap> = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];

function nowInTz(tz: string): { dia: keyof HorariosMap; hhmm: string } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz || "America/Bogota",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const wd = (parts.find((p) => p.type === "weekday")?.value ?? "Sun").toLowerCase();
  const map: Record<string, keyof HorariosMap> = {
    sun: "dom", mon: "lun", tue: "mar", wed: "mie", thu: "jue", fri: "vie", sat: "sab",
  };
  const dia = map[wd] ?? DIAS[new Date().getDay()];
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return { dia, hhmm: `${hour}:${minute}` };
}

function dentroDeVentana(hhmm: string, v: Ventana): boolean {
  return hhmm >= v.abre && hhmm <= v.cierra;
}

function describeVentanas(vs: Ventana[]): string {
  if (!vs || vs.length === 0) return "cerrada hoy";
  return vs.map((v) => `${v.abre} a ${v.cierra}`).join(" y ");
}

function assertSedeOperativa(
  sede: {
    nombre: string;
    horarios: HorariosMap | null;
    tz: string | null;
    kill_switch: boolean | null;
    rp_local_estado: number | null;
    rp_acepta_delivery: number | null;
  },
  tipo: "delivery" | "pickup",
): void {
  if (sede.kill_switch) {
    throw new Error(`"${sede.nombre}" está temporalmente cerrada hoy. Intenta más tarde o contáctanos por WhatsApp.`);
  }
  // Banderas del POS (si están cacheadas). null = aún no sincronizado, no bloqueamos.
  if (sede.rp_local_estado != null && sede.rp_local_estado !== 1) {
    throw new Error(`"${sede.nombre}" no está activa en el sistema central. Contáctanos por WhatsApp.`);
  }
  if (tipo === "delivery" && sede.rp_acepta_delivery != null && sede.rp_acepta_delivery !== 1) {
    throw new Error(`"${sede.nombre}" no acepta domicilios por ahora. Prueba la opción de recoger en sede.`);
  }
  // Horarios locales.
  const horarios = (sede.horarios ?? {}) as HorariosMap;
  const { dia, hhmm } = nowInTz(sede.tz ?? "America/Bogota");
  const ventanas = horarios[dia] ?? [];
  if (ventanas.length === 0 || !ventanas.some((v) => dentroDeVentana(hhmm, v))) {
    throw new Error(`Estamos fuera de horario en "${sede.nombre}" (hoy: ${describeVentanas(ventanas)}). Vuelve más tarde o escríbenos por WhatsApp.`);
  }
}

function toNum(v: unknown, fallback = 0): number {
  if (v == null || v === "") return fallback;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function resolvePedidoProductId(menu: RpMenuData, productogeneralId: number): number {
  const productos = Array.isArray(menu.data) ? menu.data : [];
  const raw = productos.find((p: RpProducto) => toNum(p.productogeneral_id ?? p.producto_id) === productogeneralId);
  if (!raw) return productogeneralId;
  const presentaciones = Array.isArray(raw.lista_presentacion)
    ? (raw.lista_presentacion as Record<string, unknown>[])
    : [];
  return toNum(raw.producto_id ?? presentaciones[0]?.producto_id ?? raw.productogeneral_id, productogeneralId);
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
  // 1) Sede + validación de horarios y banderas RP (FASE 3)
  const { data: sedeRaw, error: sedeErr } = await supabaseAdmin
    .from("sedes")
    .select(
      "id, nombre, rp_local_id, horarios, tz, kill_switch, rp_local_estado, rp_acepta_delivery",
    )
    .eq("id", input.sedeId)
    .maybeSingle();
  if (sedeErr) throw new Error(sedeErr.message);
  if (!sedeRaw) throw new Error("Sede no encontrada");
  const sede = sedeRaw as SedeRow & {
    horarios: HorariosMap | null;
    tz: string | null;
    kill_switch: boolean | null;
    rp_local_estado: number | null;
    rp_acepta_delivery: number | null;
  };
  if (!sede.rp_local_id)
    throw new Error(`La sede "${sede.nombre}" no tiene rp_local_id asignado`);

  assertSedeOperativa(sede, input.tipo);

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
  const catalogo = await rpGetCatalogo(sede.rp_local_id);
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
      pedido_productoid: resolvePedidoProductId(catalogo, p.rp_id),
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
    delivery: {
      local_id: sede.rp_local_id,
      delivery_pagocon: input.pago === "efectivo" ? total : 0,
      delivery_montodescuento: 0,
      delivery_tipopago: input.pago === "efectivo" ? 1 : input.pago === "datafono" ? 2 : 5,
      tarjeta_id: input.pago === "datafono" ? 1 : null,
      delivery_modalidad: input.tipo === "delivery" ? 1 : 2,
      delivery_direccionenvio: input.cliente.direccion ?? "",
      delivery_referencia: input.cliente.detalles ?? "",
      delivery_observacion: input.notas ?? "",
    },
    cliente: {
      cliente_nombres: input.cliente.nombre,
      cliente_apellidos: "",
      cliente_dniruc: "",
      cliente_direccion: input.cliente.direccion ?? "",
      cliente_telefono: input.cliente.telefono,
      cliente_email: "",
      // Notas del checkout → "Ver notas del cliente" en el POS v2.
      // delivery_observacion abajo se mantiene como respaldo (vista vieja).
      cliente_observacion: input.notas ?? "",
    },
    listaPedidos: detalle.map((d) => ({
      pedido_productoid: d.pedido_productoid,
      pedido_cantidad: d.cantidad,
      pedido_precio: d.precio_unitario.toFixed(2),
      pedido_observacion: "",
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
      rp_payload: payload as unknown as Json,
      status: "enviado",
      tipo: input.tipo,
      pago: input.pago,
      cliente: input.cliente as unknown as Json,
      items: itemsSnapshot as unknown as Json,
      subtotal,
      total,
      notas: input.notas ?? null,
    })
    .select("id")
    .single();
  if (insErr) throw new Error(`No se pudo guardar el pedido: ${insErr.message}`);
  const localId = (orderRow as { id: string }).id;

  // 2) Llamar a Restaurant.pe.
  let rpResponse: unknown = null;
  let rpPedidoId: string | null = null;
  let rpNumeroComanda: string | null = null;
  let rpCabecera: unknown = null;
  try {
    rpResponse = await rpRegistrarDelivery(payload);
    // FASE 1 — Restaurant.pe devuelve `data` como escalar (ej. 159235), no como objeto.
    if (typeof rpResponse === "number" || typeof rpResponse === "string") {
      const s = String(rpResponse).trim();
      if (s) rpPedidoId = s;
    } else {
      // Fallback por si en el futuro cambia el shape a objeto.
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
    }

    // El id que devuelve registrarDelivery es interno (delivery_id, ej. 159268).
    // El número corto visible en el POS (ej. #158719) se obtiene con un GET
    // adicional al endpoint getPedidoListByDelivery. Tolerante a fallos: si
    // no llega ahora, el polling en TrackerOperativo lo resolverá en ≤20s.
    if (rpPedidoId) {
      try {
        const r = await rpGetPedidoListByDelivery(rpPedidoId);
        rpCabecera = r?.raw ?? null;
        rpNumeroComanda = extractComandaNumber(r?.firstItem ?? null);
      } catch {
        // ignorar: no bloquea el pedido
      }
    }

    await supabaseAdmin
      .from("orders")
      .update({
        rp_pedido_id: rpPedidoId,
        rp_numero_comanda: rpNumeroComanda,
        rp_response: rpResponse as Json,
        status: "enviado",
      })
      .eq("id", localId);

    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "order",
      sede_id: sede.id,
      payload: {
        request: payload,
        response: rpResponse,
        cabecera: rpCabecera,
        order_id: localId,
      } as unknown as Json,
      ok: true,
      mensaje: `Pedido enviado a Restaurant.pe (rp_pedido_id=${rpPedidoId ?? "n/d"}, comanda=${rpNumeroComanda ?? "n/d"})`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabaseAdmin
      .from("orders")
      .update({
        status: "error",
        rp_response: { error: msg } as Json,
      })
      .eq("id", localId);
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "order",
      sede_id: sede.id,
      payload: { request: payload, order_id: localId, error: msg } as unknown as Json,
      ok: false,
      mensaje: `Fallo al enviar pedido a Restaurant.pe: ${msg}`,
    });
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
