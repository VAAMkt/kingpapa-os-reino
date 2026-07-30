export type CheckoutPaymentMethod = "efectivo" | "datafono" | "online";

export type RestaurantPePaymentFields = {
  delivery_tipopago: 1 | 2 | 5;
  tarjeta_id: number | null;
  delivery_pagocon: number;
};

/**
 * Códigos oficiales de Restaurant.pe (Swagger APIV2 v2):
 * 1 = efectivo, 2 = tarjeta, 5 = pago en línea.
 *
 * `delivery_pagocon` representa el efectivo entregado por el cliente y por eso
 * solo lleva el total para efectivo. `tarjeta_id` solo aplica al tipo tarjeta;
 * el ID 1 fue confirmado con pedidos reales de KINGPAPA en el POS.
 */
export function restaurantPePaymentFields(
  method: CheckoutPaymentMethod,
  total: number,
): RestaurantPePaymentFields {
  switch (method) {
    case "efectivo":
      return {
        delivery_tipopago: 1,
        tarjeta_id: null,
        delivery_pagocon: total,
      };
    case "datafono":
      return {
        delivery_tipopago: 2,
        tarjeta_id: 1,
        delivery_pagocon: 0,
      };
    case "online":
      return {
        delivery_tipopago: 5,
        tarjeta_id: null,
        delivery_pagocon: 0,
      };
    default: {
      const exhaustive: never = method;
      throw new Error(`Método de pago no soportado: ${String(exhaustive)}`);
    }
  }
}
