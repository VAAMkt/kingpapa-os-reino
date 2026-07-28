import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { BrutalCard, BrutalInput, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";

function GoogleButton({ label }: { label: string }) {
  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/mi-reino",
    });
    if (result.error) {
      toast.error("No se pudo iniciar sesión con Google");
      return;
    }
    if (result.redirected) return;
    window.location.href = "/mi-reino";
  };

  return (
    <BrutalButton type="button" variant="ghost" block onClick={handleGoogle}>
      <span className="inline-flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path
            fill="#FFC107"
            d="M43.6 20.5H42V20H24v8h11.3C33.7 32.1 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.4 1 7.4 2.8l5.7-5.7C33.6 6.7 29.1 5 24 5 13.5 5 5 13.5 5 24s8.5 19 19 19 19-8.5 19-19c0-1.2-.1-2.3-.4-3.5z"
          />
          <path
            fill="#FF3D00"
            d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c2.8 0 5.4 1 7.4 2.8l5.7-5.7C33.6 6.7 29.1 5 24 5 16.3 5 9.7 9.3 6.3 14.7z"
          />
          <path
            fill="#4CAF50"
            d="M24 43c5 0 9.6-1.9 13-5l-6-5c-2 1.4-4.4 2.2-7 2.2-5.3 0-9.7-2.9-11.3-7l-6.6 5.1C9.5 38.7 16.2 43 24 43z"
          />
          <path
            fill="#1976D2"
            d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.5l6 5C40.9 35 43 30 43 24c0-1.2-.1-2.3-.4-3.5z"
          />
        </svg>
        {label}
      </span>
    </BrutalButton>
  );
}

export function LoginForm({ redirectTo = "/mi-reino" }: { redirectTo?: string }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Bienvenido al Reino");
    navigate({ to: redirectTo });
  };

  return (
    <BrutalCard tone="cheese" className="p-6">
      <BrutalBadge tone="yellow">Entrar al Reino</BrutalBadge>
      <h1 className="font-display text-4xl uppercase mt-3 leading-none">Iniciar sesión</h1>
      <p className="text-sm mt-2">Coróna te de vuelta, súbdito.</p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <BrutalInput
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <BrutalInput
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <BrutalButton type="submit" block disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </BrutalButton>
      </form>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-kp-ink/30" />
        <span className="text-xs font-display uppercase">o</span>
        <div className="flex-1 h-px bg-kp-ink/30" />
      </div>

      <GoogleButton label="Entrar con Google" />

      <p className="text-sm mt-4">
        ¿Aún no eres súbdito?{" "}
        <Link to="/registro" className="font-display uppercase underline">
          Crear cuenta
        </Link>
      </p>
    </BrutalCard>
  );
}

export function SignupForm() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/mi-reino`,
        data: { display_name: displayName },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("¡Eres oficialmente súbdito del Reino!");
    navigate({ to: "/mi-reino" });
  };

  return (
    <BrutalCard tone="cheese" className="p-6">
      <BrutalBadge tone="red">Coronarme</BrutalBadge>
      <h1 className="font-display text-4xl uppercase mt-3 leading-none">Crear cuenta</h1>
      <p className="text-sm mt-2">Súbete al Reino y come más por menos.</p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <BrutalInput
          type="text"
          placeholder="¿Cómo te decimos?"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          maxLength={60}
        />
        <BrutalInput
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <BrutalInput
          type="password"
          placeholder="Contraseña (mín. 6 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <BrutalButton type="submit" block disabled={loading}>
          {loading ? "Coronándote..." : "Coronarme"}
        </BrutalButton>
      </form>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-kp-ink/30" />
        <span className="text-xs font-display uppercase">o</span>
        <div className="flex-1 h-px bg-kp-ink/30" />
      </div>

      <GoogleButton label="Crear cuenta con Google" />

      <p className="text-sm mt-4">
        ¿Ya eres del Reino?{" "}
        <Link to="/login" className="font-display uppercase underline">
          Iniciar sesión
        </Link>
      </p>
    </BrutalCard>
  );
}

export function ResetPasswordForm() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Contraseña actualizada");
    navigate({ to: "/mi-reino" });
  };

  return (
    <BrutalCard tone="cheese" className="p-6">
      <BrutalBadge tone="purple">Recuperar Reino</BrutalBadge>
      <h1 className="font-display text-3xl uppercase mt-3 leading-none">Nueva contraseña</h1>
      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <BrutalInput
          type="password"
          placeholder="Nueva contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <BrutalButton type="submit" block disabled={loading}>
          {loading ? "Guardando..." : "Actualizar contraseña"}
        </BrutalButton>
      </form>
    </BrutalCard>
  );
}
