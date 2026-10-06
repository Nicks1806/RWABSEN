"use client";

import { FormEvent } from "react";
import { Employee, Settings, DayKey, Schedule } from "@/lib/types";
import { X, Clock3 } from "lucide-react";
import { DAY_ORDER, DAY_LABELS } from "@/lib/workHours";

interface Props {
  employee: Employee;
  editStart: string;
  setEditStart: (v: string) => void;
  editEnd: string;
  setEditEnd: (v: string) => void;
  editHoursMsg: string;
  useCustomSchedule: boolean;
  setUseCustomSchedule: (v: boolean) => void;
  editSchedule: Schedule;
  updateDaySchedule: (day: DayKey, field: "start" | "end" | "off", value: string | boolean) => void;
  setEditSchedule: (s: Schedule) => void;
  settings: Settings | null;
  onSave: (e: FormEvent) => void;
  onClose: () => void;
}

export default function EditWorkHoursModal({
  employee,
  editStart,
  setEditStart,
  editEnd,
  setEditEnd,
  editHoursMsg,
  useCustomSchedule,
  setUseCustomSchedule,
  editSchedule,
  updateDaySchedule,
  setEditSchedule,
  settings,
  onSave,
  onClose,
}: Props) {
  return (
    <div className="rw-overlay flex items-start md:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="rw-card w-full max-w-md my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="rw-heading flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Clock3 size={18} /> Jam Kerja - {employee.name}
          </h3>
          <button onClick={onClose} className="ico-circ" style={{ color: "var(--ink-muted)" }}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={onSave} className="space-y-4">
          {/* Toggle custom schedule */}
          <div
            className="flex items-center justify-between p-3"
            style={{ background: "var(--surface-300)", borderRadius: "var(--radius-md)" }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>Jadwal Per Hari</p>
              <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                Atur jam masuk berbeda setiap hari & hari libur
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useCustomSchedule}
                onChange={(e) => setUseCustomSchedule(e.target.checked)}
                className="sr-only peer"
              />
              <div
                className="w-11 h-6 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                style={{ background: useCustomSchedule ? "var(--wine)" : "var(--line-strong)" }}
              ></div>
            </label>
          </div>

          {!useCustomSchedule ? (
            <>
              <p
                className="text-xs p-2"
                style={{ background: "var(--warning-tint)", color: "var(--warning)", borderRadius: "var(--radius-md)" }}
              >
                Jam kerja tunggal berlaku semua hari. Default:{" "}
                <strong>
                  {settings?.work_start} - {settings?.work_end}
                </strong>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--ink-muted)" }}>Jam Masuk</label>
                  <input
                    type="time"
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                    className="rw-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--ink-muted)" }}>Jam Pulang</label>
                  <input
                    type="time"
                    value={editEnd}
                    onChange={(e) => setEditEnd(e.target.value)}
                    className="rw-input w-full"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                Centang libur untuk hari tidak masuk. Kosong = pakai default.
              </p>
              {DAY_ORDER.map((day) => {
                const ds = editSchedule[day] || {};
                return (
                  <div key={day} className="grid grid-cols-[70px_1fr_1fr_auto] gap-2 items-center text-sm">
                    <span className="font-medium" style={{ color: "var(--ink)" }}>{DAY_LABELS[day]}</span>
                    <input
                      type="time"
                      value={ds.start || ""}
                      disabled={ds.off}
                      onChange={(e) => updateDaySchedule(day, "start", e.target.value)}
                      className="rw-input text-xs"
                      style={{ padding: "4px 8px" }}
                    />
                    <input
                      type="time"
                      value={ds.end || ""}
                      disabled={ds.off}
                      onChange={(e) => updateDaySchedule(day, "end", e.target.value)}
                      className="rw-input text-xs"
                      style={{ padding: "4px 8px" }}
                    />
                    <label className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: "var(--ink-muted)" }}>
                      <input
                        type="checkbox"
                        checked={!!ds.off}
                        onChange={(e) => updateDaySchedule(day, "off", e.target.checked)}
                        style={{ accentColor: "var(--danger)" }}
                      />
                      Libur
                    </label>
                  </div>
                );
              })}
            </div>
          )}

          {editHoursMsg && (
            <p className="text-sm" style={{ color: editHoursMsg.includes("Gagal") ? "var(--danger)" : "var(--success)" }}>
              {editHoursMsg}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setEditStart("");
                setEditEnd("");
                setEditSchedule({});
                setUseCustomSchedule(false);
              }}
              className="rw-btn rw-btn--outline flex-1"
              title="Pakai default"
            >
              Reset Default
            </button>
            <button type="submit" className="rw-btn rw-btn--primary flex-1">
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
