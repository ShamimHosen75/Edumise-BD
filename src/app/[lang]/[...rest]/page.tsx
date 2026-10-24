import { notFound } from "next/navigation";

// Any unknown path under /en or /bn shows the translated not-found page.
export default function CatchAll() {
  notFound();
}
