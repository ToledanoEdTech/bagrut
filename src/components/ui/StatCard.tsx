import { LucideIcon } from "lucide-react";
import clsx from "clsx";

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "primary",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: "primary" | "success" | "warning" | "info";
}) {
  const colors = {
    primary: "bg-gradient-to-br from-primary-50 to-primary-100 text-primary-600",
    success: "bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600",
    warning: "bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600",
    info: "bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600",
  };

  return (
    <div className="card p-5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-1 text-4xl font-extrabold tracking-tight text-slate-900">
            {value}
          </p>
          {subtitle && <p className="mt-1 text-caption">{subtitle}</p>}
        </div>
        <div className={clsx("rounded-xl p-3.5", colors[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
