// DTOs crudos devueltos por Restaurant.pe API v2.
// Documentación: swagger v2 — base URL http://api.restaurant.pe/restaurant/public/v2/rest
// Toda respuesta viene envuelta como { tipo: "1"|number, data: ..., mensajes: string[] }.

export type RpEnvelope<T> = {
  tipo: string | number;
  data: T;
  mensajes?: string[];
};

export type RpLocal = {
  local_id: string | number;
  local_descripcion: string;
  local_aceptadelivery: string | number;
  local_aceptarecojo: string | number;
  local_direccion?: string;
  local_telefono?: string;
  local_latitud?: string | number;
  local_longitud?: string | number;
  almacen_id?: string | number;
  [k: string]: unknown;
};

export type RpDominioData = {
  locales: RpLocal[];
  [k: string]: unknown;
};

export type RpCategoria = {
  categoria_id: string | number;
  categoria_descripcion: string;
  categoria_orden?: string | number;
  [k: string]: unknown;
};

export type RpModificadorOpcion = {
  modificador_id: string | number;
  modificador_descripcion: string;
  modificador_precio?: string | number;
  [k: string]: unknown;
};

export type RpModificadorGrupo = {
  grupo_id: string | number;
  grupo_descripcion: string;
  grupo_min?: string | number;
  grupo_max?: string | number;
  opciones: RpModificadorOpcion[];
  [k: string]: unknown;
};

export type RpProducto = {
  // Campos legacy (v2 antiguo) — opcionales por compatibilidad.
  producto_id?: string | number;
  producto_descripcion?: string;
  producto_descripcion_larga?: string;
  producto_precio?: string | number;
  producto_imagen?: string;
  producto_agotado?: string | number;
  modificadores?: RpModificadorGrupo[];

  // Campos OAS3 (obtenerCartaPorLocal).
  productogeneral_id?: string | number;
  productogeneral_descripcion?: string;
  productogeneral_preciofijo?: string | number;
  lista_presentacion?: unknown[];
  listaModificadores?: RpModificadorGrupo[];
  lista_productobase?: unknown[];
  lista_productoadicional?: unknown[];

  categoria_id?: string | number;
  almacen_id?: string | number;
  [k: string]: unknown;
};

// Catálogo OAS3: el envelope externo trae { tipo, data }, donde `data` es este objeto.
// Productos viven en `data` (array) y categorías en `listaCategorias`.
export type RpMenuData = {
  tipo?: string | number;
  data?: RpProducto[];
  listaCategorias?: RpCategoria[];
  totalregistros?: number;
  [k: string]: unknown;
};

export type RpStockData = {
  total: string | number;
};
