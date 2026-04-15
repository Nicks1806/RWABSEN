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

    // Mark as seen
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white sticky top-0 z-10 border-b">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="font-bold text-lg">Inbox</h1>
          <p className="text-xs text-gray-500">Notifikasi dari admin</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-2">
        {items.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center mt-4">
            <Bell size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="font-semibold text-gray-700 text-sm">Belum ada notifikasi</p>
            <p className="text-xs text-gray-400 mt-1">
              Notifikasi akan muncul saat pengajuan disetujui/ditolak
            </p>
          </div>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              onClick={() => router.push("/pengajuan")}
              className="w-full bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition flex gap-3 text-left"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  item.type === "approved"
                    ? "bg-green-50 text-green-600"
                    : "bg-red-50 text-red-600"
                }`}
              >
                {item.type === "approved" ? <CheckCircle size={20} /> : <XCircle size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm text-gray-800">{item.title}</p>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">
                    {format(new Date(item.time), "dd/MM HH:mm")}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{item.body}</p>
                {item.meta && (
                  <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
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
