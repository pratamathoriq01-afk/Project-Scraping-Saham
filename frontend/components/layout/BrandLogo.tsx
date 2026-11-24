import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  size?: "sm" | "md";
}

/**
 * Canonical EquiLens v2 wordmark:
 * Crisp Plus Jakarta Sans bold wordmark + single raised 8px emerald dot on the right.
 */
export function BrandLogo({ className, size = "md" }: BrandLogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap select-none",
        className
      )}
    >
      <span
        className={cn(
          "font-display font-bold tracking-tight text-ink leading-none",
          size === "sm" ? "text-lg" : "text-xl"
        )}
      >
        EquiLens
      </span>
      <span
        aria-hidden="true"
        className="mb-1 inline-block h-2 w-2 rounded-full bg-[#10B981] dark:bg-[#34D399]"
      />
    </span>
  );
}
