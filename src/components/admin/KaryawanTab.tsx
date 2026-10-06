"use client";

import type { FormEvent } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  UserPlus,
  Plus,
  CheckCircle,
  Users,
  Eye,
  EyeOff,
  Shield,
  UserCircle2,
  Download,
  Loader2,
  Key,
  Clock3,
  Bell,
  Trash2,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import { getEffectiveWorkHours } from "@/lib/workHours";
import { POSITIONS, getPositionColor } from "@/lib/positions";
import type { Employee, Settings } from "@/lib/types";

interface Props {
  employees: Employee[];
  settings: Settings | null;
  effHoursMap: Map<string, ReturnType<typeof getEffectiveWorkHours>>;
  month: string;
  showPins: boolean;
  setShowPins: (v: boolean) => void;
  newEmployee: { name: string; pin: string; position: string };
  setNewEmployee: (v: { name: string; pin: string; position: string }) => void;
  empMsg: string;
  onAddEmployee: (e: FormEvent) => void;
  reportLoadingId: string | null;
  onExportEmployeeReport: (emp: Employee) => void;
  onOpenEmployee: (id: string) => void;
  onOpenResetPin: (emp: Employee) => void;
  onOpenEditProfile: (emp: Employee) => void;
  onOpenEditHours: (emp: Employee) => void;
  onTestNotif: (id: string, name: string) => void;
  onDeleteEmployee: (emp: Employee) => void;
}

export default function KaryawanTab({
  employees, settings, effHoursMap, month, showPins, setShowPins,
  newEmployee, setNewEmployee, empMsg, onAddEmployee,
  reportLoadingId, onExportEmployeeReport, onOpenEmployee,
  onOpenResetPin, onOpenEditProfile, onOpenEditHours, onTestNotif, onDeleteEmployee,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Add Employee */}
      <form onSubmit={onAddEmployee} className="rw-card">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "var(--wine-tint)" }}
          >
            <UserPlus size={18} style={{ color: "var(--wine)" }} />
          </div>
          <div>
            <h3 className="rw-heading" style={{ color: "var(--ink)" }}>Tambah Karyawan Baru</h3>
            <p className="text-xs" style={{ color: "var(--ink-muted)" }}>Karyawan bisa langsung login dengan nama & PIN</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3">
          <input
            type="text"
            placeholder="Nama karyawan"
            value={newEmployee.name}
            onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
            className="rw-input"
            required
          />
          <input
            type="text"
            placeholder="PIN (min 4 digit)"
            value={newEmployee.pin}
            onChange={(e) => setNewEmployee({ ...newEmployee, pin: e.target.value })}
            className="rw-input font-mono"
            required
          />
          <select
            value={newEmployee.position}
            onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}
            className="rw-input"
          >
            <option value="">Posisi (opsional)</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button type="submit" className="rw-btn rw-btn--primary inline-flex items-center gap-1.5 justify-center">
            <Plus size={16} /> Tambah
          </button>
        </div>
        {empMsg && (
          <p className="text-sm mt-2 flex items-center gap-1" style={{ color: "var(--success)" }}>
            <CheckCircle size={14} /> {empMsg}
          </p>
        )}
      </form>

      {/* Employee List */}
      <div className="rw-card overflow-hidden" style={{ padding: 0 }}>
        <div
          className="p-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--line)", background: "var(--surface-300)" }}
        >
          <div className="flex items-center gap-2">
            <Users size={18} style={{ color: "var(--ink-muted)" }} />
            <h3 className="rw-heading" style={{ color: "var(--ink)" }}>Daftar Karyawan</h3>
            <span
              className="text-xs px-2 py-0.5"
              style={{
                background: "var(--surface-200)",
                color: "var(--ink-muted)",
                borderRadius: "var(--radius-full)",
                border: "1px solid var(--line)",
              }}
            >
              {employees.length}
            </span>
          </div>
          <button
            onClick={() => setShowPins(!showPins)}
            className="rw-btn rw-btn--outline rw-btn--sm flex items-center gap-1.5"
          >
            {showPins ? <EyeOff size={14} /> : <Eye size={14} />}
            {showPins ? "Sembunyikan PIN" : "Tampilkan PIN"}
          </button>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "var(--surface-300)" }}>
              <tr>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--ink-muted)" }}>Nama</th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "var(--ink-muted)" }}>PIN</th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "var(--ink-muted)" }}>Jam Kerja</th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "var(--ink-muted)" }}>Role</th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "var(--ink-muted)" }}>Status</th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "var(--ink-muted)" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const hasSchedule = !!emp.schedule && Object.keys(emp.schedule).length > 0;
                const hasCustomHours = !!emp.work_start && !!emp.work_end;
                const isDefault = !hasSchedule && !hasCustomHours;
                const eff = effHoursMap.get(emp.id) || getEffectiveWorkHours(emp, settings);
                return (
                <tr
                  key={emp.id}
                  className="transition"
                  style={{ borderBottom: "1px solid var(--line)" }}
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onOpenEmployee(emp.id)}
                      className="flex items-center gap-3 hover:opacity-80 text-left w-full"
                    >
                      <Avatar name={emp.name} photoUrl={emp.photo_url} size="md" />
                      <div>
                        <p className="font-semibold" style={{ color: "var(--ink)" }}>{emp.name}</p>
                        <p className="text-[10px] capitalize" style={{ color: "var(--ink-muted)" }}>{emp.role}</p>
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-sm tracking-wider" style={{ color: "var(--ink-muted)" }}>
                    {showPins ? emp.pin : "••••••"}
                  </td>
                  <td className="px-4 py-3 text-center text-xs">
                    {emp.role === "admin" ? (
                      <span style={{ color: "var(--line-strong)" }}>-</span>
                    ) : eff.off ? (
                      <span className="rw-badge--wine inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium">
                        Libur Hari Ini
                      </span>
                    ) : (
                      <>
                        <span style={{ color: isDefault ? "var(--ink)" : "var(--wine)", fontWeight: isDefault ? 400 : 600 }}>
                          {eff.start.slice(0, 5)} - {eff.end.slice(0, 5)}
                        </span>
                        {isDefault && (
                          <span className="block text-[10px]" style={{ color: "var(--ink-muted)" }}>(default)</span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {emp.role === "admin" ? (
                      <span className="rw-badge--wine inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold">
                        <Shield size={11} /> Admin
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium ${getPositionColor(emp.position)}`}>
                        <UserCircle2 size={11} /> {emp.position || "Karyawan"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 font-medium"
                      style={{
                        borderRadius: "var(--radius-full)",
                        background: emp.is_active ? "var(--success-tint)" : "var(--danger-tint)",
                        color: emp.is_active ? "var(--success)" : "var(--danger)",
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5"
                        style={{
                          borderRadius: "var(--radius-full)",
                          background: emp.is_active ? "var(--success)" : "var(--danger)",
                        }}
                      ></span>
                      {emp.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => onExportEmployeeReport(emp)}
                        disabled={reportLoadingId === emp.id}
                        className="ico-circ transition disabled:opacity-50"
                        style={{ background: "var(--success-tint)", color: "var(--success)" }}
                        title={`Download laporan bulanan ${format(new Date(month + "-01"), "MMMM yyyy", { locale: idLocale })}`}
                      >
                        {reportLoadingId === emp.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      </button>
                      <button
                        onClick={() => onOpenResetPin(emp)}
                        className="ico-circ transition"
                        style={{ background: "var(--wine-tint)", color: "var(--wine)" }}
                        title="Reset PIN"
                      >
                        <Key size={14} />
                      </button>
                      {emp.role !== "admin" && (
                        <>
                          <button
                            onClick={() => onOpenEditProfile(emp)}
                            className="ico-circ transition"
                            style={{ background: "var(--surface-300)", color: "var(--ink-muted)" }}
                            title="Profile"
                          >
                            <UserCircle2 size={14} />
                          </button>
                          <button
                            onClick={() => onOpenEditHours(emp)}
                            className="ico-circ transition"
                            style={{ background: "var(--wine-tint)", color: "var(--wine)" }}
                            title="Atur Jam Kerja"
                          >
                            <Clock3 size={14} />
                          </button>
                          <button
                            onClick={() => onTestNotif(emp.id, emp.name)}
                            className="ico-circ transition"
                            style={{ background: "var(--warning-tint)", color: "var(--warning)" }}
                            title="Test Notifikasi"
                          >
                            <Bell size={14} />
                          </button>
                          <button
                            onClick={() => onDeleteEmployee(emp)}
                            className="ico-circ transition"
                            style={{ background: "var(--danger-tint)", color: "var(--danger)" }}
                            title="Hapus Karyawan"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden">
          {employees.map((emp) => {
            const hasSchedule = !!emp.schedule && Object.keys(emp.schedule).length > 0;
            const hasCustomHours = !!emp.work_start && !!emp.work_end;
            const isDefault = !hasSchedule && !hasCustomHours;
            const eff = effHoursMap.get(emp.id) || getEffectiveWorkHours(emp, settings);
            return (
              <div key={emp.id} className="p-4" style={{ borderBottom: "1px solid var(--line)" }}>
                <div className="flex items-center justify-between mb-2 gap-2">
                  <button
                    onClick={() => onOpenEmployee(emp.id)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <Avatar name={emp.name} photoUrl={emp.photo_url} size="md" />
                    <div className="min-w-0">
                      <p className="font-semibold" style={{ color: "var(--ink)" }}>{emp.name}</p>
                      <p className="text-xs capitalize" style={{ color: "var(--ink-muted)" }}>
                        {emp.role} {"•"} PIN: {showPins ? emp.pin : "••••••"}
                      </p>
                      {emp.role !== "admin" && (
                        <p className="text-xs mt-0.5">
                          {eff.off ? (
                            <span className="italic" style={{ color: "var(--ink-muted)" }}>Libur Hari Ini</span>
                          ) : (
                            <>
                              Jam:{" "}
                              <span style={{ color: isDefault ? "var(--ink-muted)" : "var(--wine)", fontWeight: isDefault ? 400 : 500 }}>
                                {eff.start.slice(0, 5)} - {eff.end.slice(0, 5)}
                              </span>
                              {isDefault && <span style={{ color: "var(--ink-muted)" }}> (default)</span>}
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  </button>
                  <span
                    className="text-xs px-2 py-1"
                    style={{
                      borderRadius: "var(--radius-full)",
                      background: emp.is_active ? "var(--success-tint)" : "var(--danger-tint)",
                      color: emp.is_active ? "var(--success)" : "var(--danger)",
                    }}
                  >
                    {emp.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={() => onExportEmployeeReport(emp)}
                    disabled={reportLoadingId === emp.id}
                    className="rw-btn rw-btn--sm text-xs flex items-center justify-center gap-1 disabled:opacity-50 col-span-2"
                    style={{ background: "var(--success-tint)", color: "var(--success)" }}
                  >
                    {reportLoadingId === emp.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                    Download Laporan {format(new Date(month + "-01"), "MMM yyyy", { locale: idLocale })}
                  </button>
                  <button
                    onClick={() => onOpenResetPin(emp)}
                    className="rw-btn rw-btn--sm text-xs flex items-center justify-center gap-1"
                    style={{ background: "var(--wine-tint)", color: "var(--wine)" }}
                  >
                    <Key size={12} /> PIN
                  </button>
                  {emp.role !== "admin" && (
                    <>
                      <button
                        onClick={() => onOpenEditHours(emp)}
                        className="rw-btn rw-btn--sm text-xs flex items-center justify-center gap-1"
                        style={{ background: "var(--wine-tint)", color: "var(--wine)" }}
                      >
                        <Clock3 size={12} /> Jam
                      </button>
                      <button
                        onClick={() => onDeleteEmployee(emp)}
                        className="rw-btn rw-btn--sm col-span-2 text-xs flex items-center justify-center gap-1"
                        style={{ background: "var(--danger-tint)", color: "var(--danger)" }}
                      >
                        <Trash2 size={12} /> Hapus
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
