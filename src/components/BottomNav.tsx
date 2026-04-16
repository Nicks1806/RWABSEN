"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Users, FileText, Bell, User } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee } from "@/lib/auth";

const ITEMS = [
  { key: "home", label: "Beranda", icon: Home, path: "/home" },
  { key: "karyawan", label: "Karyawan", icon: Users, path: "/pegawai" },
  { key: "pengajuan", label: "Pengajuan", icon: FileText, path: "/pengajuan" },
  { key: "inbox", label: "Inbox", icon: Bell, path: "/inbox" },
  { key: "akun", label: "Akun", icon: User, path: "/profile" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [inboxCount, setInboxCount] = useState(0);
  const lastFetchRef = useRef(0);

  // Prefetch every nav target so tab switches feel instant
  useEffect(() => {
    ITEMS.forEach((it) => {
      try {
        router.prefetch(it.path);
      } catch {
        /* noop */
      }
    });
  }, [router]);

  useEffect(() => {
    const emp = getStoredEmployee();
    if (!emp) return;
    const now = Date.now();
    if (now - lastFetchRef.current < 60_000) return;
    lastFetchRef.current = now;

    const lastSeen = localStorage.getItem("inbox_last_seen") || "2020-01-01";
    supabase
      .from("leaves")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", emp.id)
      .in("status", ["approved", "rejected"])
      .gt("reviewed_at", lastSeen)
      .then(({ count }) => setInboxCount(count || 0));
  }, [pathname]);

  const active = (path: string) => pathname === path || pathname?.startsWith(path + "/");

  return (
    <>
      <div className="h-20" />
      <nav className="fixed bottom-0 left-0 right-0 z-40">
        <div className="bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-lg mx-auto grid grid-cols-5 items-center pb-6">
          {ITEMS.map((it) => {
            const Icon = it.icon;
            const isActive = active(it.path);
            const badge = it.key === "inbox" ? inboxCount : 0;

            return (
              <Link
                key={it.key}
                href={it.path}
                prefetch
                className={`flex flex-col items-center justify-center py-3 relative transition active:scale-95 ${
                  isActive ? "text-primary" : "text-gray-400"
                }`}
              >
                <div className="relative">
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  {badge > 0 ? (
                    <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-bold px-1 rounded-full min-w-[14px] h-[14px] flex items-center justify-center">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  ) : null}
                </div>
                <span className={`text-[10px] mt-1 ${isActive ? "font-semibold" : "font-medium"}`}>
                  {it.label}
                </span>
              </Link>
            );
          })}
        </div>
        </div>
      </nav>
    </>
  );
}
