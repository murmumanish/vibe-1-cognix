import type { Metadata } from "next";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "XYZ Internal Mobility Desk",
  description: "Internal passenger transit desk and Toto dispatch for XYZ Company",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const plainUser = user
    ? {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      }
    : null;

  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen bg-slate-50">
        <Navbar user={plainUser as any} />
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
        <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
          XYZ Company &bull; Internal Mobility Desk (Toto Fleet) &bull; Concurrency Protected Monolith
        </footer>
      </body>
    </html>
  );
}
