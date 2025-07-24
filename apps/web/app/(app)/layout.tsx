import { SessionProvider } from "@/components/providers/session";
import { auth } from "@call/auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import React from "react";

const AppLayout = async ({ children }: { children: React.ReactNode }) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return <SessionProvider value={session}>{children}</SessionProvider>;
};

export default AppLayout;
