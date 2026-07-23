import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import { deletePost, getPostById, listAllPosts, updatePost } from "@/lib/posts";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/contenidos/")({
  component: ContenidosList,
});

function ContenidosList() {
  const queryClient = useQueryClient();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["posts", "all"],
    queryFn: listAllPosts,
    staleTime: 30_000,
  });

  const togglePublish = useMutation({
    mutationFn: ({ id, publicado }: { id: string; publicado: boolean }) =>
      updatePost(id, { publicado }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePost(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Historia eliminada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const prefetchPost = (id: string) =>
    queryClient.prefetchQuery({
      queryKey: ["posts", "byId", id],
      queryFn: () => getPostById(id),
      staleTime: 30_000,
    });

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <BrutalBadge tone="yellow">Contenidos</BrutalBadge>
          <h1 className="font-display text-3xl md:text-4xl uppercase mt-2 leading-none">
            Historias del Reino
          </h1>
          <p className="text-sm text-kp-ink/70 mt-1">{posts.length} historias en la base.</p>
        </div>
        <Link to="/admin/contenidos/nuevo">
          <BrutalButton variant="primary">+ Nueva historia</BrutalButton>
        </Link>
      </header>

      <BrutalCard tone="cheese" className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 font-display uppercase text-sm">Cargando…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-kp-ink text-kp-yellow">
                <tr>
                  <th className="text-left p-3 font-display uppercase text-xs">Título</th>
                  <th className="text-left p-3 font-display uppercase text-xs">Categoría</th>
                  <th className="text-left p-3 font-display uppercase text-xs">Fecha</th>
                  <th className="text-left p-3 font-display uppercase text-xs">Estado</th>
                  <th className="text-right p-3 font-display uppercase text-xs">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className="border-t-2 border-kp-ink/10">
                    <td className="p-3">
                      <div className="font-display uppercase text-sm">{p.titulo}</div>
                      <div className="text-xs text-kp-ink/60 font-mono">{p.slug}</div>
                    </td>
                    <td className="p-3 text-xs">{p.categoria}</td>
                    <td className="p-3 text-xs font-mono">{p.fecha}</td>
                    <td className="p-3">
                      {p.publicado ? (
                        <BrutalBadge tone="lime">publicado</BrutalBadge>
                      ) : (
                        <BrutalBadge tone="black">borrador</BrutalBadge>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-2 whitespace-nowrap">
                      <Link
                        to="/historias/$slug"
                        params={{ slug: p.slug }}
                        target="_blank"
                        className="underline text-xs"
                      >
                        Ver
                      </Link>
                      <Link
                        to="/admin/contenidos/$id"
                        params={{ id: p.id }}
                        onMouseEnter={() => prefetchPost(p.id)}
                        className="underline text-xs"
                      >
                        Editar
                      </Link>
                      <button
                        onClick={() => togglePublish.mutate({ id: p.id, publicado: !p.publicado })}
                        className="underline text-xs"
                      >
                        {p.publicado ? "Despublicar" : "Publicar"}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar "${p.titulo}"?`)) remove.mutate(p.id);
                        }}
                        className="underline text-xs text-kp-red"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {posts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-sm">
                      Sin historias todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </BrutalCard>
    </div>
  );
}
