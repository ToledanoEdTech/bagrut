import clsx from "clsx";

type BreadcrumbItem = {
  label: string;
  active?: boolean;
  onClick?: () => void;
};

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-2 text-base">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span className="text-slate-300">/</span>}
          {item.onClick && !item.active ? (
            <button
              type="button"
              onClick={item.onClick}
              className="text-primary-600 transition hover:text-primary-700"
            >
              {item.label}
            </button>
          ) : (
            <span
              className={clsx(
                item.active ? "font-semibold text-slate-900" : "text-slate-500"
              )}
            >
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
