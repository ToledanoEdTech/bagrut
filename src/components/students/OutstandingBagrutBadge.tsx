import clsx from "clsx";
import { Award } from "lucide-react";

type OutstandingBagrutBadgeProps = {
  className?: string;
  size?: "sm" | "md";
};

export function OutstandingBagrutBadge({
  className,
  size = "md",
}: OutstandingBagrutBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border border-amber-200 bg-gradient-to-l from-amber-50 to-yellow-50 font-semibold text-amber-800 ring-1 ring-inset ring-amber-100",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        className
      )}
    >
      <Award className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
      מועמד לבגרות מצטיינת
    </span>
  );
}
