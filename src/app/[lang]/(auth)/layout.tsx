// Login and password pages read the session and query string: always render per request.
export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
