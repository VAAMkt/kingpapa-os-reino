import * as React from "react";
import { cn } from "@/lib/utils";

export function BrutalCard({
  className,
  children,
  tone = "cheese",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  tone?: "cheese" | "yellow" | "black" | "purple" | "red";
}) {
  const tones = {
    cheese: "bg-kp-cheese text-kp-ink",
    yellow: "bg-kp-yellow text-kp-ink",
    black: "bg-kp-ink text-kp-cheese",
    purple: "bg-kp-purple text-kp-cheese",
    red: "bg-kp-red text-kp-cheese",
  };
  return (
    <div className={cn("border-2 border-kp-ink shadow-brutal", tones[tone], className)} {...props}>
      {children}
    </div>
  );
}

export function BrutalBadge({
  children,
  tone = "red",
  className,
}: {
  children: React.ReactNode;
  tone?: "red" | "yellow" | "lime" | "purple" | "black";
  className?: string;
}) {
  const tones = {
    red: "bg-kp-red text-kp-cheese",
    yellow: "bg-kp-yellow text-kp-ink",
    lime: "bg-kp-lime text-kp-ink",
    purple: "bg-kp-purple text-kp-cheese",
    black: "bg-kp-ink text-kp-cheese",
  };
  return (
    <span
      className={cn(
        "inline-block font-display uppercase tracking-wide text-xs px-2 py-1 border-2 border-kp-ink shadow-brutal-sm",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function BrutalChip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "whitespace-nowrap font-display uppercase tracking-wide text-sm px-3 py-2 border-2 border-kp-ink transition-all",
        active
          ? "bg-kp-ink text-kp-cheese shadow-none translate-x-[2px] translate-y-[2px]"
          : "bg-kp-cheese text-kp-ink shadow-brutal-sm hover:-translate-y-[1px]",
      )}
    >
      {children}
    </button>
  );
}

export function BrutalInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full px-4 py-3 bg-kp-cheese border-2 border-kp-ink shadow-brutal-sm",
        "font-body text-kp-ink placeholder:text-kp-ink/50",
        "focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-none",
        className,
      )}
      {...props}
    />
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 md:mb-10", className)}>
      {eyebrow && (
        <span className="inline-block bg-kp-ink text-kp-yellow font-display uppercase tracking-widest text-xs px-3 py-1 mb-3">
          {eyebrow}
        </span>
      )}
      <h2 className="font-display text-4xl md:text-6xl uppercase text-kp-ink leading-none">
        {title}
      </h2>
      {description && (
        <p className="mt-3 text-base md:text-lg text-kp-ink/80 max-w-2xl">{description}</p>
      )}
    </div>
  );
}
