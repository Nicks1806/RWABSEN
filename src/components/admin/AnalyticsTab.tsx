"use client";

import dynamic from "next/dynamic";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { AlertTriangle, Award, Timer, TrendingUp } from "lucide-react";
import type { Employee, Attendance } from "@/lib/types";

// Lazy-load recharts only when analytics tab is viewed (~400KB bundle)
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });

interface Props {
  employees: Employee[];
  records: Attendance[];
  getMonthlyHours: (empId: string) => number;
  month: string;
}

export default function AnalyticsTab({ employees, records, getMonthlyHours, month }: Props) {
  return (
    <div className="space-y-6">
      {records.length === 0 && (
        <div
          className="rw-card text-center"
          style={{ background: "var(--warning-tint)", borderColor: "var(--line)" }}
        >
          <TrendingUp size={32} className="mx-auto mb-2" style={{ color: "var(--warning)" }} />
          <p className="font-semibold" style={{ color: "var(--ink)" }}>Belum ada data absensi</p>
          <p className="text-xs mt-1" style={{ color: "var(--ink-muted)" }}>
            Grafik akan muncul setelah karyawan mulai absen. Pilih bulan lain di Dashboard jika perlu.
          </p>
        </div>
      )}
      {/* Ranking Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(() => {
          const empStats = employees
            .filter((e) => e.role === "employee")
            .map((emp) => {
              const empRecs = records.filter((r) => r.employee_id === emp.id);
              const lateCount = empRecs.filter((r) => r.status === "late").length;
              const presentCount = empRecs.filter((r) => r.clock_in).length;
              const hours = getMonthlyHours(emp.id);
              return { name: emp.name, lateCount, presentCount, hours };
            });

          const mostLate = [...empStats].sort((a, b) => b.lateCount - a.lateCount)[0];
          const mostPresent = [...empStats].sort((a, b) => b.presentCount - a.presentCount)[0];
          const longestHours = [...empStats].sort((a, b) => b.hours - a.hours)[0];

          return (
            <>
              <div
                className="rw-card"
                style={{ borderLeft: "4px solid var(--danger)" }}
              >
                <div className="flex items-center gap-2 mb-2" style={{ color: "var(--danger)" }}>
                  <AlertTriangle size={18} />
                  <p className="text-xs font-semibold">Paling Sering Terlambat</p>
                </div>
                <p className="text-lg font-bold" style={{ color: "var(--ink)" }}>{mostLate?.name || "-"}</p>
                <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                  {mostLate?.lateCount || 0}x terlambat bulan ini
                </p>
              </div>
              <div
                className="rw-card"
                style={{ borderLeft: "4px solid var(--success)" }}
              >
                <div className="flex items-center gap-2 mb-2" style={{ color: "var(--success)" }}>
                  <Award size={18} />
                  <p className="text-xs font-semibold">Paling Rajin</p>
                </div>
                <p className="text-lg font-bold" style={{ color: "var(--ink)" }}>{mostPresent?.name || "-"}</p>
                <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                  {mostPresent?.presentCount || 0} hari hadir
                </p>
              </div>
              <div
                className="rw-card"
                style={{ borderLeft: "4px solid var(--wine)" }}
              >
                <div className="flex items-center gap-2 mb-2" style={{ color: "var(--wine)" }}>
                  <Timer size={18} />
                  <p className="text-xs font-semibold">Paling Lama di Kantor</p>
                </div>
                <p className="text-lg font-bold" style={{ color: "var(--ink)" }}>{longestHours?.name || "-"}</p>
                <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                  {longestHours?.hours || 0} jam total
                </p>
              </div>
            </>
          );
        })()}
      </div>

      {/* Chart: Monthly Hours per Employee */}
      <div className="rw-card">
        <h3 className="rw-heading mb-4" style={{ color: "var(--ink)" }}>
          Total Jam Kerja per Karyawan
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={employees
              .filter((e) => e.role === "employee")
              .map((emp) => ({
                name: emp.name,
                jam: getMonthlyHours(emp.id),
              }))}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="jam" fill="#5e0f1e" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart: Hadir vs Terlambat */}
      <div className="rw-card">
        <h3 className="rw-heading mb-4" style={{ color: "var(--ink)" }}>
          Kehadiran vs Keterlambatan
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={employees
              .filter((e) => e.role === "employee")
              .map((emp) => {
                const empRecs = records.filter((r) => r.employee_id === emp.id);
                return {
                  name: emp.name,
                  Hadir: empRecs.filter((r) => r.clock_in).length,
                  Terlambat: empRecs.filter((r) => r.status === "late").length,
                };
              })}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Hadir" fill="#2e6b45" radius={[6, 6, 0, 0]} />
            <Bar dataKey="Terlambat" fill="#a8261d" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart: Line chart daily attendance trend */}
      <div className="rw-card">
        <h3 className="rw-heading mb-4" style={{ color: "var(--ink)" }}>
          Tren Kehadiran Harian
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={(() => {
              // Group by date
              const dateMap = new Map<string, { hadir: number; terlambat: number }>();
              records.forEach((r) => {
                const cur = dateMap.get(r.date) || { hadir: 0, terlambat: 0 };
                if (r.clock_in) cur.hadir += 1;
                if (r.status === "late") cur.terlambat += 1;
                dateMap.set(r.date, cur);
              });
              return Array.from(dateMap.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, v]) => ({
                  date: format(new Date(date), "dd/MM"),
                  Hadir: v.hadir,
                  Terlambat: v.terlambat,
                }));
            })()}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Hadir" stroke="#2e6b45" strokeWidth={2} />
            <Line type="monotone" dataKey="Terlambat" stroke="#a8261d" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Ranking Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Late Ranking */}
        <div className="rw-card">
          <h3 className="rw-heading mb-3 flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <AlertTriangle size={16} style={{ color: "var(--danger)" }} /> Ranking Keterlambatan
          </h3>
          <div className="space-y-2">
            {employees
              .filter((e) => e.role === "employee")
              .map((emp) => ({
                name: emp.name,
                lateCount: records.filter((r) => r.employee_id === emp.id && r.status === "late").length,
              }))
              .sort((a, b) => b.lateCount - a.lateCount)
              .map((s, i) => (
                <div key={s.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="w-5 text-xs" style={{ color: "var(--ink-muted)" }}>#{i + 1}</span>
                    <span style={{ color: "var(--ink)" }}>{s.name}</span>
                  </span>
                  <span className="font-semibold" style={{ color: s.lateCount > 0 ? "var(--danger)" : "var(--ink-muted)" }}>
                    {s.lateCount}x
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Hours Ranking */}
        <div className="rw-card">
          <h3 className="rw-heading mb-3 flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Timer size={16} style={{ color: "var(--wine)" }} /> Ranking Jam Kerja
          </h3>
          <div className="space-y-2">
            {employees
              .filter((e) => e.role === "employee")
              .map((emp) => ({ name: emp.name, hours: getMonthlyHours(emp.id) }))
              .sort((a, b) => b.hours - a.hours)
              .map((s, i) => (
                <div key={s.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="w-5 text-xs" style={{ color: "var(--ink-muted)" }}>#{i + 1}</span>
                    <span style={{ color: "var(--ink)" }}>{s.name}</span>
                  </span>
                  <span className="font-semibold" style={{ color: "var(--wine)" }}>{s.hours} jam</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-center" style={{ color: "var(--ink-muted)" }}>
        Data bulan {format(new Date(month + "-01"), "MMMM yyyy", { locale: idLocale })}
      </p>
    </div>
  );
}
