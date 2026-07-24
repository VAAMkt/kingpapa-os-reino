import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import { useEffect } from "react";
import appCss from "../styles.css?url";
import { TopAppBar, Footer } from "@/components/kp/Layout";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { LocationGate } from "@/components/kp/LocationGate";
import { CartDrawer } from "@/components/kp/CartDrawer";
import { CartPill } from "@/components/kp/CartPill";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-kp-yellow px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-8xl text-kp-ink">404</h1>
        <h2 className="font-display text-3xl uppercase mt-2">El Reino no encontró esa página</h2>
        <p className="mt-2 text-sm">Quizás te equivocaste de cuadra, papi.</p>
        <Link
          to="/"
          className="inline-block mt-5 px-6 py-3 bg-kp-ink text-kp-yellow font-display uppercase border-2 border-kp-ink shadow-brutal-sm"
        >
          Volver al Reino
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-kp-yellow px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl uppercase">Se nos quemó la papa</h1>
        <p className="mt-2 text-sm">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="inline-block mt-5 px-6 py-3 bg-kp-ink text-kp-yellow font-display uppercase border-2 border-kp-ink shadow-brutal-sm"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "KINGPAPA — Los REYES de esta pendeja’" },
      { name: "description", content: "KINGPAPA es la salchipapería de la casa: salchipapas gigantes, combos callejeros y puro saoco para pedir online o vivir el show del Reino en mesa." },
      { name: "author", content: "KINGPAPA" },
      { property: "og:title", content: "KINGPAPA — Los REYES de esta pendeja’" },
      { property: "og:description", content: "KINGPAPA es la salchipapería de la casa: salchipapas gigantes, combos callejeros y puro saoco para pedir online o vivir el show del Reino en mesa." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "KINGPAPA" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "KINGPAPA — Los REYES de esta pendeja’" },
      { name: "twitter:description", content: "KINGPAPA es la salchipapería de la casa: salchipapas gigantes, combos callejeros y puro saoco para pedir online o vivir el show del Reino en mesa." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/iBBZRJcqehepneIwBEhmDj2h9IA2/social-images/social-1779084040439-KINGPAPA_-_LOS_REYES_DE_ESTA_PENDEJA.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/iBBZRJcqehepneIwBEhmDj2h9IA2/social-images/social-1779084040439-KINGPAPA_-_LOS_REYES_DE_ESTA_PENDEJA.webp" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        // PARCHE: Cocogoose Condensed está pendiente de licencia comercial (ver Manual v2 §06 · alerta legal).
        // Big Shoulders Display 800 es el fallback más cercano en el eje geométrico condensado.
        // Al comprar la licencia Zetafonts, autohospedar WOFF2 y retirar este link.
        href: "https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@300;800&family=Montserrat:wght@300;400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-zona="negra">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Solo re-invalidamos en transiciones reales de identidad. TOKEN_REFRESHED
      // e INITIAL_SESSION disparan al recuperar foco de pestaña y causarían
      // refetch masivo (rompe el estado del admin al volver a la tab).
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col">
        <TopAppBar />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
        <Toaster />
        <LocationGate />
        <CartDrawer />
        <CartPill />
      </div>
    </QueryClientProvider>
  );
}
