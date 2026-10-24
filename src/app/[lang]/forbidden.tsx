import { StatusPage } from "@/components/site/status-page";
import { getDictionary } from "@/i18n/get-dictionary";

// Shown with HTTP 403 when requireRole() rejects a user.
export default async function Forbidden() {
  const [en, bn] = await Promise.all([
    getDictionary("en"),
    getDictionary("bn"),
  ]);
  const pick = (d: typeof en) => ({
    title: d.forbidden.title,
    body: d.forbidden.body,
    action: d.forbidden.home,
  });
  return (
    <StatusPage strings={{ en: pick(en), bn: pick(bn) }} href="/dashboard" />
  );
}
