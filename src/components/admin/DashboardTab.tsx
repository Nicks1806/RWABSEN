"use client";

import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  Bell,
  Users,
  CheckCircle,
  AlertTriangle,
  Clock,
  Clock3,
  Award,
  Search,
  FileText as FileTextIcon,
  Download,
  Filter,
  Image as ImageIcon,
  MapPin,
  Trash2,
} from "lucide-react";
import AdminStatCard from "@/components/admin/AdminStatCard";
import type { Employee, Attendance } from "@/lib/types";

const statusBadge: Record<string, { text: string; bg: string; color: string }> = {
  present: { text: "Hadir", bg: "var(--success-tint)", color: "var(--success)" },
  late: { text: "Terlambat", bg: "var(--danger-tint)", color: "var(--danger)" },
  early_leave: { text: "Pulang Awal", bg: "var(--warning-tint)", color: "var(--warning)" },
  absent: { text: "Tidak Hadir", bg: "var(--surface-300)", color: "var(--ink-muted)" },
};

interface RankEntry {
  emp: Employee;
  present: number;
  late: number;
}

interface Props {
  lateClockIn: Employee[];
  missingClockOut: Employee[];
  totalEmployees: number;
  presentToday: number;
  lateToday: number;
  reminderMsg: string;
  reminderSending: boolean;
  onSendClockOutReminder: () => void;
  topRajin: RankEntry[];
  topTelat: RankEntry[];
  month: string;
  setMonth: (m: string) => void;
  globalSearch: string;
  setGlobalSearch: (s: string) => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  employees: Employee[];
  empStatsMap: Map<string, { present: number; late: number }>;
  getMonthlyHours: (empId: string) => number;
  filterEmployee: string;
  setFilterEmployee: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  filteredRecords: Attendance[];
  recordsEmpty: boolean;
  setPhotoModal: (url: string) => void;
  onDeleteAttendance: (id: string) => void;
}

export default function DashboardTab({
  lateClockIn, missingClockOut, totalEmployees, presentToday, lateToday,
  reminderMsg, reminderSending, onSendClockOutReminder, topRajin, topTelat,
  month, setMonth, globalSearch, setGlobalSearch, onExportPDF, onExportExcel,
  employees, empStatsMap, getMonthlyHours,
  filterEmployee, setFilterEmployee, filterStatus, setFilterStatus,
  filteredRecords, recordsEmpty, setPhotoModal, onDeleteAttendance,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Late Clock-In Notification */}
      {lateClockIn.length > 0 && (
        <div
          className="p-4"
          style={{
            background: "var(--danger-tint)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <div className="flex items-center gap-2 mb-2" style={{ color: "var(--danger)" }}>
            <Bell size={18} />
            <h3 className="font-semibold">
              Belum Clock In ({lateClockIn.length})
            </h3>
          </div>
          <p className="text-xs mb-2" style={{ color: "var(--danger)" }}>
            Karyawan yang belum absen hari ini setelah jam kerja dimulai
          </p>
          <div className="flex flex-wrap gap-2">
            {lateClockIn.map((emp) => (
              <span
                key={emp.id}
                className="text-xs px-3 py-1"
                style={{
                  background: "var(--surface-200)",
                  color: "var(--danger)",
                  borderRadius: "var(--radius-full)",
                  border: "1px solid var(--danger)",
                }}
              >
                {emp.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <AdminStatCard
          icon={<Users size={18} />}
          label="Total Karyawan"
          value={totalEmployees}
        />
        <AdminStatCard
          icon={<CheckCircle size={18} />}
          label="Hadir Hari Ini"
          value={presentToday}
          liveBadge={`${totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0}%`}
        />
        <AdminStatCard
          icon={<AlertTriangle size={18} />}
          label="Terlambat"
          value={lateToday}
        />
        <AdminStatCard
          icon={<Clock size={18} />}
          label="Belum Hadir"
          value={totalEmployees - presentToday}
        />
      </div>

      {/* Clock-Out Reminder Banner */}
      {missingClockOut.length > 0 && (
        <div
          className="p-4 flex items-center justify-between gap-3 flex-wrap"
          style={{
            background: "var(--warning-tint)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <div
              className="w-11 h-11 flex items-center justify-center shadow-sm shrink-0"
              style={{ borderRadius: "var(--radius-md)", background: "var(--warning)", color: "var(--on-wine)" }}
            >
              <Clock3 size={20} />
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: "var(--ink)" }}>{missingClockOut.length} karyawan belum clock-out</p>
              <p className="text-xs" style={{ color: "var(--ink-muted)" }}>{missingClockOut.slice(0, 3).map((e) => e.name).join(", ")}{missingClockOut.length > 3 ? ` +${missingClockOut.length - 3} lainnya` : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {reminderMsg && (
              <span className="rw-badge--success text-xs font-semibold px-2.5 py-1">{reminderMsg}</span>
            )}
            <button
              onClick={onSendClockOutReminder}
              disabled={reminderSending}
              className="rw-btn rw-btn--warning rw-btn--sm inline-flex items-center gap-1.5 font-bold disabled:opacity-60"
            >
              <Bell size={14} />
              {reminderSending ? "Mengirim..." : "Kirim Reminder"}
            </button>
          </div>
        </div>
      )}

      {/* Top Performer Ranking */}
      {(topRajin.length > 0 || topTelat.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 animate-fade-in">
          {/* Top Rajin */}
          <div className="rw-card overflow-hidden" style={{ padding: 0 }}>
            <div
              className="px-4 py-3 flex items-center gap-2"
              style={{ borderBottom: "1px solid var(--line)", background: "var(--success-tint)" }}
            >
              <div
                className="w-7 h-7 flex items-center justify-center"
                style={{ borderRadius: "var(--radius-sm)", background: "var(--success)", color: "var(--on-wine)" }}
              >
                <Award size={14} />
              </div>
              <h3 className="font-bold text-sm" style={{ color: "var(--ink)" }}>Top Rajin Bulan Ini</h3>
            </div>
            <ul>
              {topRajin.map((r, idx) => (
                <li
                  key={r.emp.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{ borderBottom: "1px solid var(--line)" }}
                >
                  <span
                    className="w-7 h-7 flex items-center justify-center text-xs font-bold"
                    style={{
                      borderRadius: "var(--radius-full)",
                      background: idx === 0 ? "var(--gold)" : idx === 1 ? "var(--line-strong)" : "var(--sand)",
                      color: "var(--on-wine)",
                    }}
                  >
                    {idx + 1}
                  </span>
                  <p className="flex-1 text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>{r.emp.name}</p>
                  <span className="rw-badge--success text-xs font-bold px-2 py-0.5 tabular-nums">{r.present} hari</span>
                </li>
              ))}
              {topRajin.length === 0 && (
                <li className="px-4 py-6 text-center text-xs" style={{ color: "var(--ink-muted)" }}>Belum ada data</li>
              )}
            </ul>
          </div>

          {/* Top Telat */}
          <div className="rw-card overflow-hidden" style={{ padding: 0 }}>
            <div
              className="px-4 py-3 flex items-center gap-2"
              style={{ borderBottom: "1px solid var(--line)", background: "var(--danger-tint)" }}
            >
              <div
                className="w-7 h-7 flex items-center justify-center"
                style={{ borderRadius: "var(--radius-sm)", background: "var(--danger)", color: "var(--on-wine)" }}
              >
                <AlertTriangle size={14} />
              </div>
              <h3 className="font-bold text-sm" style={{ color: "var(--ink)" }}>Paling Sering Terlambat</h3>
            </div>
            <ul>
              {topTelat.map((r, idx) => (
                <li
                  key={r.emp.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{ borderBottom: "1px solid var(--line)" }}
                >
                  <span
                    className="w-7 h-7 flex items-center justify-center text-xs font-bold"
                    style={{ borderRadius: "var(--radius-full)", background: "var(--danger-tint)", color: "var(--danger)" }}
                  >
                    {idx + 1}
                  </span>
                  <p className="flex-1 text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>{r.emp.name}</p>
                  <span className="rw-badge--danger text-xs font-bold px-2 py-0.5 tabular-nums">{r.late}x</span>
                </li>
              ))}
              {topTelat.length === 0 && (
                <li className="px-4 py-6 text-center text-xs" style={{ color: "var(--ink-muted)" }}>Tidak ada yang terlambat</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Month Selector + Export + Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:justify-between">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rw-input text-sm"
        />
        <div className="flex-1 relative md:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-muted)" }} />
          <input
            type="text"
            placeholder="Cari nama karyawan..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="rw-input w-full text-sm"
            style={{ paddingLeft: "36px" }}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={onExportPDF}
            className="rw-btn rw-btn--primary flex-1 md:flex-none flex items-center gap-1.5"
          >
            <FileTextIcon size={16} /> PDF
          </button>
          <button
            onClick={onExportExcel}
            className="rw-btn flex-1 md:flex-none flex items-center gap-1.5"
            style={{ background: "var(--success)", color: "var(--on-wine)" }}
          >
            <Download size={16} /> Excel
          </button>
        </div>
      </div>

      {/* Monthly Hours Summary */}
      <div className="rw-card overflow-hidden" style={{ padding: 0 }}>
        <div className="p-4" style={{ borderBottom: "1px solid var(--line)" }}>
          <h3 className="rw-heading" style={{ color: "var(--ink)" }}>
            Jam Kerja Bulan {format(new Date(month + "-01"), "MMMM yyyy", { locale: idLocale })}
          </h3>
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "var(--surface-300)" }}>
              <tr>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--ink-muted)" }}>Nama</th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "var(--ink-muted)" }}>Hadir</th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "var(--ink-muted)" }}>Terlambat</th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "var(--ink-muted)" }}>Total Jam</th>
              </tr>
            </thead>
            <tbody>
              {employees
                .filter((e) => e.role === "employee")
                .map((emp) => {
                  const stats = empStatsMap.get(emp.id) || { present: 0, late: 0 };
                  return (
                    <tr key={emp.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--ink)" }}>{emp.name}</td>
                      <td className="px-4 py-3 text-center" style={{ color: "var(--ink)" }}>{stats.present}</td>
                      <td className="px-4 py-3 text-center" style={{ color: "var(--danger)" }}>{stats.late}</td>
                      <td className="px-4 py-3 text-center font-semibold" style={{ color: "var(--wine)" }}>
                        {getMonthlyHours(emp.id)} jam
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {/* Mobile Cards for Monthly Hours */}
        <div className="md:hidden">
          {employees
            .filter((e) => e.role === "employee")
            .map((emp) => {
              const stats = empStatsMap.get(emp.id) || { present: 0, late: 0 };
              return (
                <div key={emp.id} className="p-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--line)" }}>
                  <div>
                    <p className="font-semibold" style={{ color: "var(--ink)" }}>{emp.name}</p>
                    <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                      Hadir: {stats.present} {"•"}{" "}
                      <span style={{ color: "var(--danger)" }}>Terlambat: {stats.late}</span>
                    </p>
                  </div>
                  <p className="font-bold" style={{ color: "var(--wine)" }}>
                    {getMonthlyHours(emp.id)} jam
                  </p>
                </div>
              );
            })}
        </div>
      </div>

      {/* Attendance Table */}
      <div className="rw-card overflow-hidden" style={{ padding: 0 }}>
        <div
          className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <h3 className="rw-heading flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Filter size={16} /> Detail Absensi
          </h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="rw-input text-sm"
              style={{ padding: "6px 12px" }}
            >
              <option value="all">Semua Karyawan</option>
              {employees
                .filter((e) => e.role === "employee")
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rw-input text-sm"
              style={{ padding: "6px 12px" }}
            >
              <option value="all">Semua Status</option>
              <option value="present">Hadir</option>
              <option value="late">Terlambat</option>
              <option value="early_leave">Pulang Awal</option>
            </select>
          </div>
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "var(--surface-300)" }}>
              <tr>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--ink-muted)" }}>Tanggal</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--ink-muted)" }}>Nama</th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "var(--ink-muted)" }}>Masuk</th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "var(--ink-muted)" }}>Keluar</th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "var(--ink-muted)" }}>Status</th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "var(--ink-muted)" }}>Foto</th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "var(--ink-muted)" }}>Lokasi</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--ink-muted)" }}>Ket</th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "var(--ink-muted)" }}>Hapus</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r) => {
                const badge = statusBadge[r.status];
                return (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {format(new Date(r.date), "dd/MM")}
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--ink)" }}>
                    {(r as Attendance & { employees?: { name: string } }).employees?.name || "-"}
                  </td>
                  <td className="px-4 py-3 text-center" style={{ color: "var(--success)" }}>
                    {r.clock_in ? format(new Date(r.clock_in), "HH:mm") : "-"}
                  </td>
                  <td className="px-4 py-3 text-center" style={{ color: "var(--warning)" }}>
                    {r.clock_out ? format(new Date(r.clock_out), "HH:mm") : "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="text-xs px-2 py-1 font-medium"
                      style={{
                        borderRadius: "var(--radius-full)",
                        background: badge?.bg || "",
                        color: badge?.color || "",
                      }}
                    >
                      {badge?.text || r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="inline-flex items-center gap-1">
                      {r.clock_in_photo && (
                        <button
                          onClick={() => setPhotoModal(r.clock_in_photo!)}
                          className="inline-flex items-center gap-0.5 text-[10px] px-2 py-1"
                          style={{ background: "var(--success-tint)", color: "var(--success)", borderRadius: "var(--radius-sm)" }}
                          title="Foto Clock In"
                        >
                          <ImageIcon size={12} /> In
                        </button>
                      )}
                      {r.clock_out_photo && (
                        <button
                          onClick={() => setPhotoModal(r.clock_out_photo!)}
                          className="inline-flex items-center gap-0.5 text-[10px] px-2 py-1"
                          style={{ background: "var(--warning-tint)", color: "var(--warning)", borderRadius: "var(--radius-sm)" }}
                          title="Foto Clock Out"
                        >
                          <ImageIcon size={12} /> Out
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.clock_in_lat && (
                      <a
                        href={`https://www.google.com/maps?q=${r.clock_in_lat},${r.clock_in_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--wine)" }}
                        title="Lihat lokasi"
                      >
                        <MapPin size={16} className="inline" />
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[150px] truncate" style={{ color: "var(--ink-muted)" }}>
                    {r.notes || "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => onDeleteAttendance(r.id)}
                      className="transition"
                      style={{ color: "var(--danger)" }}
                      title="Hapus"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
        {/* Mobile Cards for Detail Absensi */}
        <div className="md:hidden">
          {filteredRecords.map((r) => {
            const rec = r as Attendance & { employees?: { name: string } };
            const badge = statusBadge[r.status];
            return (
              <div key={r.id} className="p-4 space-y-2" style={{ borderBottom: "1px solid var(--line)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold" style={{ color: "var(--ink)" }}>{rec.employees?.name || "-"}</p>
                    <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                      {format(new Date(r.date), "EEE, dd MMM", { locale: idLocale })}
                    </p>
                  </div>
                  <span
                    className="text-xs px-2 py-1 font-medium"
                    style={{
                      borderRadius: "var(--radius-full)",
                      background: badge?.bg || "",
                      color: badge?.color || "",
                    }}
                  >
                    {badge?.text || r.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div
                    className="px-2 py-1"
                    style={{ background: "var(--success-tint)", color: "var(--success)", borderRadius: "var(--radius-sm)" }}
                  >
                    Masuk: {r.clock_in ? format(new Date(r.clock_in), "HH:mm") : "-"}
                  </div>
                  <div
                    className="px-2 py-1"
                    style={{ background: "var(--warning-tint)", color: "var(--warning)", borderRadius: "var(--radius-sm)" }}
                  >
                    Keluar: {r.clock_out ? format(new Date(r.clock_out), "HH:mm") : "-"}
                  </div>
                </div>
                {r.notes && (
                  <p className="text-xs" style={{ color: "var(--ink-muted)" }}>Ket: {r.notes}</p>
                )}
                <div className="flex items-center gap-3 text-xs pt-1">
                  {r.clock_in_photo && (
                    <button
                      onClick={() => setPhotoModal(r.clock_in_photo!)}
                      className="flex items-center gap-1"
                      style={{ color: "var(--wine)" }}
                    >
                      <ImageIcon size={14} /> Foto
                    </button>
                  )}
                  {r.clock_in_lat && (
                    <a
                      href={`https://www.google.com/maps?q=${r.clock_in_lat},${r.clock_in_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1"
                      style={{ color: "var(--wine)" }}
                    >
                      <MapPin size={14} /> Lokasi
                    </a>
                  )}
                  <button
                    onClick={() => onDeleteAttendance(r.id)}
                    className="flex items-center gap-1 ml-auto"
                    style={{ color: "var(--danger)" }}
                  >
                    <Trash2 size={14} /> Hapus
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredRecords.length === 0 && (
          <div className="text-center py-8" style={{ color: "var(--ink-muted)" }}>
            {recordsEmpty ? "Belum ada data" : "Tidak ada data sesuai filter"}
          </div>
        )}
      </div>
    </div>
  );
}
