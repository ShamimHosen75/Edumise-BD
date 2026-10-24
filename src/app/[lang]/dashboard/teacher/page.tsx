import { RoleHome } from "@/components/dashboard/role-home";

type Props = { params: Promise<{ lang: string }> };

export default function Page({ params }: Props) {
  return <RoleHome params={params} role="teacher" />;
}
