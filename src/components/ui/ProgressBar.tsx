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
  const fills = {
    primary: "bg-gradient-to-l from-primary-500 to-primary-600",
    success: "bg-gradient-to-l from-emerald-500 to-emerald-600",
    warning: "bg-gradient-to-l from-amber-500 to-amber-600",
  };

  return (
    <div
      className={clsx(
        "h-2.5 w-full overflow-hidden rounded-full bg-slate-100",
        className
      )}
    >
      <div
        className={clsx(
          "h-full rounded-full transition-all duration-700 ease-out",
          fills[color]
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
