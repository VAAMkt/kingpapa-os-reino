// SEO structured-data helpers. Plain-text FAQ mirrors src/components/kp/FaqKing.tsx.

export const SITE_URL = "https://kingpapa.co";

export const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "¿Hacen domicilios?",
    a: "Sí. Pedí directo a nuestra línea nacional 317 245 5336 (WhatsApp) o desde la web y evitá comisiones de apps.",
  },
  {
    q: "¿Puedo recoger en punto?",
    a: "Podés llegar al punto por el pedido. Regalanos nombre, teléfono, pedido y sede, y arrimate en unos 45 minutos. Si sale antes te llamamos.",
  },
  {
    q: "¿Manejan reservas?",
    a: "No manejamos reservas porque la afluencia es alta y el lugar no es tan grande, pero llegate que la vas a pasar bien.",
  },
  {
    q: "¿Tienen opciones vegetarianas?",
    a: "Sí. Podés pedirla sin proteína animal y sumarle queso, maíz, cebolla crispy o aguacate.",
  },
  {
    q: "¿Qué salsas manejan?",
    a: "Salsa de la casa, BBQ, Salsa KING con pepinillos, Picante y de Ajo.",
  },
  {
    q: "¿Cómo funciona el Reto KINGPAPA?",
    a: "Llegate a cualquier sede y pedí la del reto ($139.900). Tenés que terminar 4.1 kilos en menos de 30 minutos. ¡GANA HASTA 10 PALOS! Aplica sólo para mayores de edad.",
  },
  {
    q: "¿Tienen algo para cumpleaños?",
    a: "Sí: combo cumpleaños por $55.000 con show de chicharrón a la mesa, show de queso a la mesa, 1 corona, 1 vela volcán y 1 brownie.",
  },
  {
    q: "¿Y si no hay cobertura en mi zona?",
    a: "Si no llegamos a tu zona, nos podés encontrar en Rappi o DiDi, o esperarte y visitarnos en una de nuestras sedes.",
  },
  {
    q: "Estoy buscando trabajo, ¿a dónde mando la hoja de vida?",
    a: "Enviá la hoja de vida por WhatsApp al +57 315 027 2030.",
  },
  {
    q: "Soy proveedor y me gustaría trabajar con ustedes",
    a: "Escribile a nuestra líder de compras por WhatsApp al +57 316 431 7572.",
  },
  {
    q: "Necesito factura electrónica",
    a: "Escribinos a contabilidadmvk@gmail.com adjuntando el RUT y la foto de la factura.",
  },
  {
    q: "Soy influencer o creador de contenido",
    a: "Registrate en el formulario oficial: https://forms.gle/7j5cmvwGSZfbeJnd7",
  },
];

export function faqPageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "KINGPAPA",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    sameAs: [
      "https://www.instagram.com/kingpapaco",
      "https://www.tiktok.com/@kingpapaco",
      "https://www.facebook.com/kingpapaco",
    ],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "KINGPAPA",
    url: SITE_URL,
    inLanguage: "es-CO",
  };
}

type SedeForSchema = {
  id: string;
  nombre: string;
  slug?: string | null;
  ciudad: string;
  direccion: string;
  horario?: string | null;
  whatsapp?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export function sedesLocalBusinessJsonLd(sedes: SedeForSchema[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: sedes.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Restaurant",
        "@id": `${SITE_URL}/sedes#${s.slug ?? s.id}`,
        name: s.nombre,
        servesCuisine: ["Colombian", "Fast Food", "Salchipapa"],
        address: {
          "@type": "PostalAddress",
          streetAddress: s.direccion,
          addressLocality: s.ciudad,
          addressCountry: "CO",
        },
        ...(s.horario ? { openingHours: s.horario } : {}),
        ...(s.whatsapp ? { telephone: `+${s.whatsapp}` } : {}),
        ...(s.lat != null && s.lng != null
          ? { geo: { "@type": "GeoCoordinates", latitude: s.lat, longitude: s.lng } }
          : {}),
        url: `${SITE_URL}/sedes`,
      },
    })),
  };
}
