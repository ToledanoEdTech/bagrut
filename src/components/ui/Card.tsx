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
        "rounded-2xl border border-slate-200/80 bg-white transition-all duration-200",
        variant === "default" && "shadow-sm hover:shadow-md hover:-translate-y-0.5",
        variant === "interactive" && "shadow-sm hover:shadow-lg hover:-translate-y-1 cursor-pointer",
        variant === "flat" && "shadow-none hover:shadow-none hover:translate-y-0",
        className
      )}
    >
      {children}
    </div>
  );
}
