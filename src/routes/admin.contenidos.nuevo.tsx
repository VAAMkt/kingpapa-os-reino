import { createFileRoute } from "@tanstack/react-router";
import { BrutalBadge } from "@/components/ui-kp/Brutal";
import { PostForm } from "@/components/admin/PostForm";

export const Route = createFileRoute("/admin/contenidos/nuevo")({
  component: NuevoPost,
});

function NuevoPost() {
  return (
    <div className="space-y-5">
      <header>
        <BrutalBadge tone="yellow">Nueva historia</BrutalBadge>
        <h1 className="font-display text-3xl md:text-4xl uppercase mt-2 leading-none">
          Crear historia
        </h1>
      </header>
      <PostForm />
    </div>
  );
}
