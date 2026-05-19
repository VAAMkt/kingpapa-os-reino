// Carrito persistente en localStorage. SSR-safe.
import { useSyncExternalStore } from "react";

export type CartModifier = {
  grupoId: number;
  opcionId: number;
  nombre: string;
  precio: number;
};

export type CartItem = {
  key: string; // productoId + hash modificadores
  productoId: string;
  nombre: string;
  precio: number; // precio unitario YA con modificadores aplicados
  cantidad: number;
  imagen?: string | null;
  modificadores?: CartModifier[];
};

export type OrderType = "delivery" | "pickup";

type CartState = {
  items: CartItem[];
  orderType: OrderType | null;
};

const STORAGE_KEY = "kp.cart.v2";
const LEGACY_KEY = "kp.cart";
const OPEN_EVENT = "kp:cart-open";

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

let cache: CartState | null = null;
const EMPTY_STATE: CartState = { items: [], orderType: null };

function read(): CartState {
  if (typeof window === "undefined") return EMPTY_STATE;
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CartState>;
      cache = {
        items: Array.isArray(parsed.items) ? parsed.items : [],
        orderType: parsed.orderType ?? null,
      };
    } else {
      // Migración suave del store antiguo.
      const legacy = window.localStorage.getItem(LEGACY_KEY);
      const legacyItems = legacy ? (JSON.parse(legacy) as CartItem[]) : [];
      cache = { items: Array.isArray(legacyItems) ? legacyItems : [], orderType: null };
    }
  } catch {
    cache = { items: [], orderType: null };
  }
  return cache;
}

function write(next: CartState) {
  if (typeof window === "undefined") return;
  cache = next;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  emit();
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function modKey(mods: CartModifier[] | undefined): string {
  if (!mods || mods.length === 0) return "";
  return (
    "::" +
    mods
      .map((m) => `${m.grupoId}-${m.opcionId}`)
      .sort()
      .join("|")
  );
}

export function useCart() {
  const state = useSyncExternalStore(subscribe, read, () => EMPTY_STATE);
  const count = state.items.reduce((acc, i) => acc + i.cantidad, 0);
  const subtotal = state.items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
  return { items: state.items, count, subtotal, orderType: state.orderType };
}

export function addItem(
  input: Omit<CartItem, "key" | "cantidad"> & { cantidad?: number; silent?: boolean },
) {
  const key = input.productoId + modKey(input.modificadores);
  const state = read();
  const items = [...state.items];
  const idx = items.findIndex((i) => i.key === key);
  if (idx >= 0) {
    items[idx] = { ...items[idx], cantidad: items[idx].cantidad + (input.cantidad ?? 1) };
  } else {
    items.push({
      key,
      productoId: input.productoId,
      nombre: input.nombre,
      precio: input.precio,
      imagen: input.imagen ?? null,
      modificadores: input.modificadores,
      cantidad: input.cantidad ?? 1,
    });
  }
  write({ ...state, items });
  if (!input.silent) openCart();
}

export function incItem(key: string) {
  const state = read();
  write({
    ...state,
    items: state.items.map((i) => (i.key === key ? { ...i, cantidad: i.cantidad + 1 } : i)),
  });
}

export function decItem(key: string) {
  const state = read();
  write({
    ...state,
    items: state.items
      .map((i) => (i.key === key ? { ...i, cantidad: i.cantidad - 1 } : i))
      .filter((i) => i.cantidad > 0),
  });
}

export function removeItem(key: string) {
  const state = read();
  write({ ...state, items: state.items.filter((i) => i.key !== key) });
}

export function clearCart() {
  const state = read();
  write({ ...state, items: [] });
}

export function setOrderType(t: OrderType) {
  const state = read();
  write({ ...state, orderType: t });
}

export function openCart() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

export function onOpenCart(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(OPEN_EVENT, cb);
  return () => window.removeEventListener(OPEN_EVENT, cb);
}
