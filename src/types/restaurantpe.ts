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
  producto_id: string | number;
  producto_descripcion: string;
  producto_descripcion_larga?: string;
  producto_precio: string | number;
  producto_imagen?: string;
  producto_agotado?: string | number;
  categoria_id?: string | number;
  modificadores?: RpModificadorGrupo[];
  almacen_id?: string | number;
  [k: string]: unknown;
};

export type RpMenuData = {
  categorias?: RpCategoria[];
  productos?: RpProducto[];
  [k: string]: unknown;
};

export type RpStockData = {
  total: string | number;
};
