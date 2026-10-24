import { StatusPage } from "@/components/site/status-page";
import { getDictionary } from "@/i18n/get-dictionary";

export default async function NotFound() {
  const [en, bn] = await Promise.all([
    getDictionary("en"),
    getDictionary("bn"),
  ]);
  const pick = (d: typeof en) => ({
    title: d.notFound.title,
    body: d.notFound.body,
    action: d.notFound.home,
  });
  return <StatusPage strings={{ en: pick(en), bn: pick(bn) }} href="" />;
}
