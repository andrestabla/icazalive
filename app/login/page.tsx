import { redirect } from "next/navigation";
import { getCurrentUser, safeReturnPath } from "@/lib/auth";
import LoginForm from "./login-form";

export const metadata = {
  title: "Iniciar sesión — Icaza Live",
};
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const { next } = await searchParams;
  return (
    <LoginForm
      returnTo={safeReturnPath(next)}
      showLocalCredentials={process.env.NODE_ENV !== "production"}
    />
  );
}
