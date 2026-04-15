"use client";

import { useRouter, usePathname } from "next/navigation";
import { Home, Users, FileText, Bell, User } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee } from "@/lib/auth";

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [inboxCount, setInboxCount] = useState(0);

  useEffect(() => {
    const emp = getStoredEmployee();
    if (!emp) return;
    const lastSeen = localStorage.getItem("inbox_last_seen") || "2020-01-01";
    supabase
      .from("leaves")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", emp.id)
      .in("status", ["approved", "rejected"])
      .gt("reviewed_at", lastSeen)
      .then(({ count }) => setInboxCount(count || 0));
  }, [pathname]);

  const items = [
    { key: "home", label: "Beranda", icon: Home, path: "/home" },
    { key: "pegawai", label: "Pegawai", icon: Users, path: "/pegawai" },
    { key: "pengajuan", label: "Pengajuan", icon: FileText, path: "/pengajuan" },
    {
      key: "inbox",
      label: "Inbox",
      icon: Bell,
      path: "/inbox",
      badge: inboxCount,
    },
    { key: "akun", label: "Akun", icon: User, path: "/profile" },
  ];

  const active = (path: string) => pathname === path || pathname?.startsWith(path + "/");

  return (
    <>
      {/* Spacer so content doesn't get covered */}
      <div className="h-16" />

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-bottom">
        <div className="max-w-lg mx-auto grid grid-cols-5 items-center">
          {items.map((it) => {
            const Icon = it.icon;
            const isActive = active(it.path);

            return (
              <button
                key={it.key}
                onClick={() => router.push(it.path)}
                className={`flex flex-col items-center justify-center py-3 relative transition ${
                  isActive ? "text-primary" : "text-gray-400"
                }`}
              >
                <div className="relative">
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  {it.badge && it.badge > 0 ? (
                    <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-bold px-1 rounded-full min-w-[14px] h-[14px] flex items-center justify-center">
                      {it.badge > 9 ? "9+" : it.badge}
                    </span>
                  ) : null}
                </div>
                <span
                  className={`text-[10px] mt-1 ${isActive ? "font-semibold" : "font-medium"}`}
                >
                  {it.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
