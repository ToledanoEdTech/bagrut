import Image from "next/image";
import clsx from "clsx";

const LOGO_1 = {
  src: "/logos/logo-1.png",
  alt: "Toledano EdTech",
  width: 1397,
  height: 768,
};

const LOGO_2 = {
  src: "/logos/logo-2.png",
  alt: "ישיבה תיכונית צביה אלישיב",
  width: 1920,
  height: 1080,
};

export function SiteLogos({
  size = "header",
  className,
}: {
  size?: "hero" | "header";
  className?: string;
}) {
  const isHero = size === "hero";

  return (
    <div
      className={clsx(
        "flex items-center",
        isHero ? "flex-col gap-5" : "gap-2",
        className
      )}
    >
      <Image
        src={LOGO_1.src}
        alt={LOGO_1.alt}
        width={LOGO_1.width}
        height={LOGO_1.height}
        className={clsx(isHero ? "h-32 w-auto" : "h-8 w-auto")}
        priority={isHero}
      />
      <Image
        src={LOGO_2.src}
        alt={LOGO_2.alt}
        width={LOGO_2.width}
        height={LOGO_2.height}
        className={clsx(
          isHero ? "h-28 w-auto rounded-xl bg-white p-2" : "h-8 w-auto"
        )}
        priority={isHero}
      />
    </div>
  );
}
