import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrutalButton, BrutalLink } from "@/components/ui-kp/BrutalButton";

export function UserMenu() {
  const { user, isAuthenticated, isAdmin, signOut, loading } = useAuth();

  if (loading) return null;

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <BrutalLink href="/login" variant="ghost" size="sm" className="hidden md:inline-flex">
          Entrar
        </BrutalLink>
        <BrutalLink href="/registro" variant="primary" size="sm">
          Coronarme
        </BrutalLink>
      </div>
    );
  }

  const initial = (user?.user_metadata?.display_name || user?.email || "K")
    .toString()
    .charAt(0)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <BrutalButton variant="dark" size="sm" aria-label="Mi cuenta">
          <span className="w-5 h-5 rounded-full bg-kp-yellow text-kp-ink font-display flex items-center justify-center text-xs">
            {initial}
          </span>
          <span className="hidden md:inline">Mi Reino</span>
        </BrutalButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-2 border-kp-ink shadow-brutal-sm bg-kp-cheese">
        <DropdownMenuLabel className="font-display uppercase text-xs">
          {user?.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/mi-reino" className="font-display uppercase text-sm">
            Mi Reino
          </Link>
        </DropdownMenuItem>
        {isAdmin() && (
          <DropdownMenuItem asChild>
            <Link to="/admin" className="font-display uppercase text-sm">
              Panel Admin
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="font-display uppercase text-sm text-kp-red">
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
