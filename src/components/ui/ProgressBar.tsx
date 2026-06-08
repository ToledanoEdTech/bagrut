import clsx from "clsx";

export function ProgressBar({
  value,
  className,
  color = "primary",
}: {
  value: number;
  className?: string;
  color?: "primary" | "success" | "warning";
}) {
  const colors = {
    primary: "bg-primary-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
  };

  return (
    <div className={clsx("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div
        className={clsx("h-full rounded-full transition-all duration-500", colors[color])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
