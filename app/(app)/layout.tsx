import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { ToastProvider } from "@/components/Toast";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50">
        <Sidebar />
        <div className="lg:pl-64">
          <Topbar user={user} />
          <main className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
