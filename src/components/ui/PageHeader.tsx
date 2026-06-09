import clsx from "clsx";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  variant?: "default" | "gradient";
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  children,
  variant = "default",
  className,
}: PageHeaderProps) {
  if (variant === "gradient") {
    return (
      <header
        className={clsx(
          "relative -mx-4 -mt-4 overflow-hidden bg-primary-700 px-6 py-9 text-white shadow-glow lg:-mx-8 lg:-mt-8 lg:rounded-b-[2rem] lg:px-9",
          className
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-l from-primary-700 via-brand-700 to-primary-800" />
        <div className="absolute inset-0 bg-mesh-hero opacity-60" />
        <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 max-w-2xl text-base text-primary-100/90">{subtitle}</p>
            )}
          </div>
          {children}
        </div>
      </header>
    );
  }

  return (
    <header
      className={clsx(
        "-mx-4 -mt-4 mb-2 border-b border-slate-200/70 bg-white/70 px-6 py-6 backdrop-blur-sm lg:-mx-8 lg:-mt-8 lg:px-8",
        className
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1 text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-base text-slate-500">{subtitle}</p>}
        </div>
        {children}
      </div>
    </header>
  );
}
