import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Option = { value: string; label: string };
type Props = {
  action: string;
  q?: string;
  showSearch?: boolean;
  categories?: Option[];
  category?: string;
  /** Query parameter of the filter (default "category"). */
  filterName?: string;
  labels: {
    search: string;
    searchLabel: string;
    category: string;
    allCategories: string;
  };
};

/** Search box and category filter as a plain GET form (works without JavaScript). */
export function ListToolbar({
  action,
  q = "",
  showSearch = true,
  categories,
  category = "",
  filterName = "category",
  labels,
}: Props) {
  return (
    <form
      role="search"
      action={action}
      className="flex flex-wrap items-end gap-3"
    >
      {showSearch ? (
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor="q">{labels.searchLabel}</Label>
          <Input id="q" name="q" type="search" defaultValue={q} />
        </div>
      ) : null}
      {categories ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={filterName}>{labels.category}</Label>
          <select
            id={filterName}
            name={filterName}
            defaultValue={category}
            className="bg-background h-10 rounded-md border px-3 text-sm"
          >
            <option value="">{labels.allCategories}</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <Button type="submit" variant="outline">
        <Search aria-hidden="true" />
        {labels.search}
      </Button>
    </form>
  );
}
