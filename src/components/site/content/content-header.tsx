export function ContentHeader({
  title,
  intro,
}: {
  title: string;
  intro?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
      {intro ? <p className="text-muted-foreground">{intro}</p> : null}
    </div>
  );
}
