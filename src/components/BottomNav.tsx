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
      <div className="h-28" />
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 px-3 pointer-events-none"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-lg mx-auto pointer-events-auto">
          <div className="rw-nav">
            {ITEMS.map((it) => {
              const Icon = it.icon;
              const isActive = active(it.path);
              const badge = it.key === "inbox" ? inboxCount : 0;

              return (
                <Link
                  key={it.key}
                  href={it.path}
                  prefetch
                  className={isActive ? "is-active" : ""}
                  style={{ position: "relative" }}
                >
                  <div style={{ position: "relative" }}>
                    <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} />
                    {badge > 0 ? (
                      <span
                        style={{
                          position: "absolute",
                          top: -4,
                          left: "calc(50% + 6px)",
                          minWidth: 16,
                          height: 16,
                          padding: "0 4px",
                          borderRadius: "var(--radius-full)",
                          background: "var(--danger)",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 9,
                          lineHeight: "16px",
                          textAlign: "center",
                          boxShadow: "0 0 0 2px var(--surface-200)",
                        }}
                      >
                        {badge > 9 ? "9+" : badge}
                      </span>
                    ) : null}
                  </div>
                  <span>{it.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
