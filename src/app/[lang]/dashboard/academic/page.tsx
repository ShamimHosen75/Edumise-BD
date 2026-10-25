import { redirect } from "next/navigation";

export default async function AcademicHome({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  redirect(`/${lang}/dashboard/academic/sessions`);
}
