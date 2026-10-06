"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee } from "@/lib/auth";
import { Employee, Leave } from "@/lib/types";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Bell, CheckCircle, XCircle, FileText } from "lucide-react";
import BottomNav from "@/components/BottomNav";

type InboxItem = {
  id: string;
  title: string;
  body: string;
  time: string;
  type: "approved" | "rejected";
  meta?: string;
};

export default function InboxPage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [items, setItems] = useState<InboxItem[]>([]);

  const fetchInbox = useCallback(async (empId: string) => {
    const { data } = await supabase
      .from("leaves")
      .select("*")
      .eq("employee_id", empId)
      .in("status", ["approved", "rejected"])
      .not("reviewed_at", "is", null)
      .order("reviewed_at", { ascending: false })
      .limit(50);

    const inboxItems: InboxItem[] = (data || []).map((l: Leave) => {
      const typeName = l.leave_type === "cuti" ? "Cuti" : l.leave_type === "sakit" ? "Sakit" : "Izin";
      return {
        id: l.id,
        type: l.status as "approved" | "rejected",
        title:
          l.status === "approved"
            ? `Pengajuan ${typeName} Disetujui`
            : `Pengajuan ${typeName} Ditolak`,
        body:
          l.status === "approved"
            ? `Pengajuan ${typeName.toLowerCase()} Anda telah disetujui admin.`
            : `Pengajuan ${typeName.toLowerCase()} Anda ditolak.${l.admin_notes ? " " + l.admin_notes : ""}`,
        time: l.reviewed_at || l.created_at,
        meta: `${format(new Date(l.start_date), "dd MMM", { locale: idLocale })}${
          l.start_date !== l.end_date ? " - " + format(new Date(l.end_date), "dd MMM yyyy", { locale: idLocale }) : ""
        }`,
      };
    });

    setItems(inboxItems);

    localStorage.setItem("inbox_last_seen", new Date().toISOString());
  }, []);

  useEffect(() => {
    const emp = getStoredEmployee();
    if (!emp || emp.role === "admin") {
      router.push("/");
      return;
    }
    setEmployee(emp);
    fetchInbox(emp.id);
  }, [router, fetchInbox]);

  if (!employee) return null;

  return (
    <div className="min-h-screen animate-fade-in" style={{ background: "var(--surface-100)" }}>
      <header
        className="sticky top-0 z-30 px-4 pt-4 pb-3"
        style={{ background: "var(--surface-100)", borderBottom: "1px solid var(--line)" }}
      >
        <div className="max-w-lg mx-auto">
          <p className="rw-micro" style={{ marginBottom: 4 }}>Notifikasi</p>
          <h1 className="rw-heading" style={{ color: "var(--ink)" }}>Inbox</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {items.length === 0 ? (
          <div className="rw-card" style={{ padding: "var(--space-8)", textAlign: "center", marginTop: "var(--space-4)" }}>
            <Bell size={32} style={{ color: "var(--ink-muted)", margin: "0 auto 8px", opacity: 0.4 }} />
            <p style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>Belum ada notifikasi</p>
            <p style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4 }}>
              Notifikasi akan muncul saat pengajuan disetujui/ditolak
            </p>
          </div>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              onClick={() => router.push("/pengajuan")}
              className="rw-card"
              style={{
                width: "100%",
                display: "flex",
                gap: "var(--space-3)",
                textAlign: "left",
                cursor: "pointer",
                transition: "box-shadow 0.15s ease",
                padding: "var(--space-4)",
                border: "1px solid var(--line)",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  background: item.type === "approved" ? "var(--success-tint)" : "var(--danger-tint)",
                  color: item.type === "approved" ? "var(--success)" : "var(--danger)",
                }}
              >
                {item.type === "approved" ? <CheckCircle size={20} /> : <XCircle size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between" style={{ gap: "var(--space-2)" }}>
                  <p style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{item.title}</p>
                  <span style={{ fontSize: 10, color: "var(--ink-muted)", whiteSpace: "nowrap" }}>
                    {format(new Date(item.time), "dd/MM HH:mm")}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {item.body}
                </p>
                {item.meta && (
                  <p style={{ fontSize: 10, color: "var(--ink-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                    <FileText size={10} /> {item.meta}
                  </p>
                )}
              </div>
            </button>
          ))
        )}
      </main>

      <BottomNav />
    </div>
  );
}
