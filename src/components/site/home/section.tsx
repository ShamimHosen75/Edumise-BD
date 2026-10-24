import { cn } from "@/lib/utils";

/** A titled home page section. */
export function Section({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn("flex flex-col gap-4", className)}
      data-section={id}
    >
      <h2
        id={`${id}-title`}
        className="flex items-center gap-2 text-xl font-semibold"
      >
        <span
          aria-hidden="true"
          className="bg-primary h-6 w-1.5 rounded-full"
        />
        {title}
      </h2>
      {children}
    </section>
  );
}
