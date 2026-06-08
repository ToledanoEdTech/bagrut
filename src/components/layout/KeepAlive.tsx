"use client";

import { usePathname } from "next/navigation";
import { useRef } from "react";

const MAX_CACHED = 12;

export function KeepAlive({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const cacheRef = useRef<Map<string, React.ReactNode>>(new Map());
  const orderRef = useRef<string[]>([]);

  cacheRef.current.set(pathname, children);

  if (!orderRef.current.includes(pathname)) {
    orderRef.current.push(pathname);
  } else {
    orderRef.current = orderRef.current.filter((p) => p !== pathname);
    orderRef.current.push(pathname);
  }

  while (orderRef.current.length > MAX_CACHED) {
    const oldest = orderRef.current.shift();
    if (oldest && oldest !== pathname) {
      cacheRef.current.delete(oldest);
    }
  }

  return (
    <>
      {Array.from(cacheRef.current.entries()).map(([path, node]) => (
        <div key={path} className={path === pathname ? undefined : "hidden"} aria-hidden={path !== pathname}>
          {node}
        </div>
      ))}
    </>
  );
}
