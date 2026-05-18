// Carrito persistente en localStorage. SSR-safe.
import { useSyncExternalStore } from "react";

export type CartItem = {
  key: string; // productoId + hash modificadores
  productoId: string;
  nombre: string;
  precio: number;
  cantidad: number;
  imagen?: string | null;
};

const STORAGE_KEY = "kp.cart";
const OPEN_EVENT = "kp:cart-open";

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

let cache: CartItem[] | null = null;

function read(): CartItem[] {
  if (typeof window === "undefined") return EMPTY;
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(items: CartItem[]) {
  if (typeof window === "undefined") return;
  cache = items;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  emit();
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const EMPTY: CartItem[] = [];

export function useCart() {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);
  const count = items.reduce((acc, i) => acc + i.cantidad, 0);
  const subtotal = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
  return { items, count, subtotal };
}


export function addItem(input: Omit<CartItem, "key" | "cantidad"> & { cantidad?: number }) {
  const key = input.productoId;
  const items = read();
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
      cantidad: input.cantidad ?? 1,
    });
  }
  write(items);
  openCart();
}

export function incItem(key: string) {
  const items = read().map((i) => (i.key === key ? { ...i, cantidad: i.cantidad + 1 } : i));
  write(items);
}

export function decItem(key: string) {
  const items = read()
    .map((i) => (i.key === key ? { ...i, cantidad: i.cantidad - 1 } : i))
    .filter((i) => i.cantidad > 0);
  write(items);
}

export function removeItem(key: string) {
  write(read().filter((i) => i.key !== key));
}

export function clearCart() {
  write([]);
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
