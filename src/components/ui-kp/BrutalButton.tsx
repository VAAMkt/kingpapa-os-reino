import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "fire" | "ghost" | "neon" | "dark";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-kp-yellow text-kp-ink",
  fire: "bg-kp-red text-kp-cheese",
  ghost: "bg-kp-cheese text-kp-ink",
  neon: "bg-kp-purple text-kp-cheese",
  dark: "bg-kp-ink text-kp-cheese",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-2 text-xs",
  md: "px-5 py-3 text-sm",
  lg: "px-6 py-4 text-base",
};

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChildHref?: string;
  block?: boolean;
}

export const BrutalButton = React.forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = "primary", size = "md", block, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "font-display tracking-wide uppercase border-2 border-kp-ink shadow-brutal-sm",
        "transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        "hover:-translate-y-[1px]",
        "inline-flex items-center justify-center gap-2",
        variants[variant],
        sizes[size],
        block && "w-full",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
BrutalButton.displayName = "BrutalButton";

export function BrutalLink({
  href,
  external,
  children,
  className,
  variant = "primary",
  size = "md",
  block,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
  className?: string;
  variant?: Variant;
  size?: Size;
  block?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={cn(
        "font-display tracking-wide uppercase border-2 border-kp-ink shadow-brutal-sm",
        "transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        "hover:-translate-y-[1px]",
        "inline-flex items-center justify-center gap-2",
        variants[variant],
        sizes[size],
        block && "w-full",
        className,
      )}
    >
      {children}
    </a>
  );
}
