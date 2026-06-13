import clsx from "clsx";
import { Award } from "lucide-react";

type OutstandingBagrutBadgeProps = {
  className?: string;
  size?: "sm" | "md";
  /**
   * Use "onDark" when the badge sits on a dark/colored background (e.g. the
   * primary gradient hero), so it renders as a solid high-contrast pill.
   */
  variant?: "default" | "onDark";
};

export function OutstandingBagrutBadge({
  className,
  size = "md",
  variant = "default",
}: OutstandingBagrutBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full font-semibold ring-1 ring-inset",
        variant === "onDark"
          ? "border border-white/40 bg-white text-amber-700 ring-white/40 shadow-sm"
          : "border border-amber-200 bg-gradient-to-l from-amber-50 to-yellow-50 text-amber-800 ring-amber-100",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        className
      )}
    >
      <Award className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
      מועמד לבגרות מצטיינת
    </span>
  );
}
