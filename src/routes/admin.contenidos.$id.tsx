import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BrutalBadge } from "@/components/ui-kp/Brutal";
import { PostForm } from "@/components/admin/PostForm";
import { getPostById } from "@/lib/posts";

export const Route = createFileRoute("/admin/contenidos/$id")({
  head: () => ({
    meta: [
      { title: "Editar contenido — Admin KINGPAPA" },
      { name: "description", content: "Edición privada de contenido de KINGPAPA." },
      { property: "og:title", content: "Editar contenido — Admin KINGPAPA" },
      { property: "og:description", content: "Edición privada de contenido de KINGPAPA." },
      { name: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: EditarPost,
});

function EditarPost() {
  const { id } = Route.useParams();
  const { data: post, isLoading } = useQuery({
    queryKey: ["posts", "byId", id],
    queryFn: () => getPostById(id),
  });

  return (
    <div className="space-y-5">
      <header>
        <BrutalBadge tone="yellow">Editar</BrutalBadge>
        <h1 className="font-display text-3xl md:text-4xl uppercase mt-2 leading-none">
          {post?.titulo ?? "Cargando…"}
        </h1>
      </header>
      {isLoading ? (
        <p className="font-display uppercase text-sm">Cargando…</p>
      ) : !post ? (
        <p className="text-sm">No encontrada.</p>
      ) : (
        <PostForm initial={post} />
      )}
    </div>
  );
}
