"use client";

import { usePathname } from "next/navigation";
import {
  AdminConsoleShell,
  type AdminSection,
} from "@/components/AdminConsoleShell";

export default function AdminDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const activeSection: AdminSection = pathname.startsWith(
    "/dashboard/owner-applications"
  )
    ? "owner-applications"
    : pathname.startsWith("/dashboard/profile")
      ? "profile"
      : "listings";
  const title = pathname.startsWith("/dashboard/owner-applications/")
    ? "Application Details"
    : pathname.startsWith("/dashboard/owner-applications")
      ? "Initial Request Review"
      : pathname.startsWith("/dashboard/listings/")
        ? "Property Details"
        : pathname.startsWith("/dashboard/profile")
          ? "Administrator Profile"
          : "Property Review";

  return (
    <AdminConsoleShell activeSection={activeSection} title={title}>
      {children}
    </AdminConsoleShell>
  );
}
