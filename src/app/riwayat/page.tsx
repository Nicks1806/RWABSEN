"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee } from "@/lib/auth";
import { Employee, Attendance } from "@/lib/types";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { ArrowLeft, Clock, MapPin, FileText } from "lucide-react";
import BottomNav from "@/components/BottomNav";

export default function RiwayatPage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const emp = getStoredEmployee();
    if (!emp) {
      router.push("/");
      return;
    }
    setEmployee(emp);
  }, [router]);

  useEffect(() => {
    if (!employee) return;

    async function fetchRecords() {
      setLoading(true);
      const date = new Date(month + "-01");
      const start = format(startOfMonth(date), "yyyy-MM-dd");
      const end = format(endOfMonth(date), "yyyy-MM-dd");

      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", employee!.id)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false });

      const list = data || [];
      setRecords(list);

      let total = 0;
      for (const r of list) {
        if (r.clock_in && r.clock_out) {
          const diff =
            new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime();
          total += diff / (1000 * 60 * 60);
        }
      }
      setTotalHours(Math.round(total * 10) / 10);
      setLoading(false);
    }

    fetchRecords();
  }, [employee, month]);

  const statusLabel: Record<string, { text: string; bg: string; color: string }> = {
    present: { text: "Hadir", bg: "var(--success-tint)", color: "var(--success)" },
    late: { text: "Terlambat", bg: "var(--danger-tint)", color: "var(--danger)" },
    early_leave: { text: "Pulang Awal", bg: "var(--warning-tint)", color: "var(--warning)" },
    absent: { text: "Tidak Hadir", bg: "var(--surface-300)", color: "var(--ink-muted)" },
  };

  if (!employee) return null;

  return (
    <div className="min-h-screen animate-fade-in" style={{ background: "var(--surface-100)" }}>
      <header
        className="sticky top-0 z-30 px-4 py-3"
        style={{ background: "var(--surface-100)", borderBottom: "1px solid var(--line)" }}
      >
        <div className="max-w-lg mx-auto flex items-center" style={{ gap: "var(--space-3)" }}>
          <button
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) router.back();
              else router.push("/home");
            }}
            className="ico-circ"
            style={{
              width: 36,
              height: 36,
              background: "var(--surface-200)",
              border: "1px solid var(--line)",
              color: "var(--ink)",
              cursor: "pointer",
            }}
            aria-label="Kembali"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="rw-micro" style={{ marginBottom: 2 }}>Riwayat</p>
            <h1 className="rw-heading" style={{ color: "var(--ink)" }}>Absensi</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {/* Month Picker + Total */}
        <div className="rw-card flex items-center justify-between">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rw-input"
            style={{ width: "auto", minHeight: 40, padding: "6px 12px", fontSize: 14 }}
          />
          <div style={{ textAlign: "right" }}>
            <p className="rw-micro" style={{ marginBottom: 2 }}>Total Jam Kerja</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: "var(--wine)", fontVariantNumeric: "tabular-nums" }}>
              {totalHours} jam
            </p>
          </div>
        </div>

        {/* Records */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "var(--space-8)", color: "var(--ink-muted)" }}>
            Memuat...
          </div>
        ) : records.length === 0 ? (
          <div className="rw-card" style={{ textAlign: "center", padding: "var(--space-8)" }}>
            <Clock size={32} style={{ color: "var(--ink-muted)", margin: "0 auto 8px", opacity: 0.4 }} />
            <p style={{ fontSize: 14, color: "var(--ink-muted)" }}>
              Belum ada data absensi bulan ini
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {records.map((r) => {
              const st = statusLabel[r.status] || statusLabel.absent;
              return (
                <div key={r.id} className="rw-card">
                  <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-2)" }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>
                      {format(new Date(r.date), "EEEE, dd MMM", { locale: idLocale })}
                    </p>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: "var(--radius-full)",
                        background: st.bg,
                        color: st.color,
                      }}
                    >
                      {st.text}
                    </span>
                  </div>

                  <div className="grid grid-cols-2" style={{ gap: "var(--space-3)" }}>
                    <div className="flex items-center" style={{ gap: 6, fontSize: 14, color: "var(--success)" }}>
                      <Clock size={14} />
                      <span>Masuk: {r.clock_in ? format(new Date(r.clock_in), "HH:mm") : "-"}</span>
                    </div>
                    <div className="flex items-center" style={{ gap: 6, fontSize: 14, color: "var(--warning)" }}>
                      <Clock size={14} />
                      <span>Keluar: {r.clock_out ? format(new Date(r.clock_out), "HH:mm") : "-"}</span>
                    </div>
                  </div>

                  {r.clock_in_lat && (
                    <div className="flex items-center" style={{ gap: 6, fontSize: 12, color: "var(--ink-muted)", marginTop: "var(--space-2)" }}>
                      <MapPin size={12} />
                      <span>
                        {r.clock_in_lat.toFixed(4)}, {r.clock_in_lng?.toFixed(4)}
                      </span>
                    </div>
                  )}

                  {r.notes && (
                    <div className="flex items-start" style={{ gap: 6, fontSize: 12, color: "var(--ink-muted)", marginTop: "var(--space-2)" }}>
                      <FileText size={12} style={{ marginTop: 2, flexShrink: 0 }} />
                      <span>{r.notes}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
