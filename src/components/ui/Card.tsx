import clsx from "clsx";
import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  variant?: "default" | "interactive" | "flat";
  className?: string;
};

export function Card({ children, variant = "default", className }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-slate-200/70 bg-white transition-all duration-300 ease-out",
        variant === "default" && "shadow-card hover:shadow-card-hover hover:-translate-y-0.5",
        variant === "interactive" &&
          "cursor-pointer shadow-card hover:-translate-y-1 hover:border-primary-200 hover:shadow-card-hover",
        variant === "flat" && "shadow-none hover:shadow-none hover:translate-y-0",
        className
      )}
    >
      {children}
    </div>
  );
}
