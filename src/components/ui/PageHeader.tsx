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
          "-mx-8 -mt-8 border-b border-primary-700/20 bg-gradient-to-l from-primary-600 to-primary-700 px-8 py-8 text-white",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-display text-white">{title}</h1>
            {subtitle && <p className="mt-2 text-base text-primary-100">{subtitle}</p>}
          </div>
          {children}
        </div>
      </header>
    );
  }

  return (
    <header
      className={clsx(
        "-mx-8 -mt-8 border-b border-slate-200 bg-white px-8 py-6",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-base text-slate-500">{subtitle}</p>}
        </div>
        {children}
      </div>
    </header>
  );
}
