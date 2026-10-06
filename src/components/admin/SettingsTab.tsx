"use client";

import type { FormEvent } from "react";
import type { DayKey } from "@/lib/types";
import { DAY_ORDER, DAY_LABELS } from "@/lib/workHours";
import { QrCode, FileText as FileTextIcon } from "lucide-react";

interface SettingsForm {
  office_lat: string;
  office_lng: string;
  radius_meters: string;
  work_start: string;
  work_end: string;
}

interface Props {
  settingsForm: SettingsForm;
  setSettingsForm: (f: SettingsForm) => void;
  workDays: DayKey[];
  setWorkDays: (d: DayKey[] | ((prev: DayKey[]) => DayKey[])) => void;
  qrRequired: boolean;
  setQrRequired: (v: boolean) => void;
  onSave: (e: FormEvent) => void;
  settingsMsg: string;
  month: string;
}

export default function SettingsTab({
  settingsForm, setSettingsForm, workDays, setWorkDays,
  qrRequired, setQrRequired, onSave, settingsMsg, month,
}: Props) {
  return (
    <>
      <form onSubmit={onSave} className="rw-card space-y-4 max-w-lg">
        <h3 className="rw-heading" style={{ color: "var(--ink)" }}>Pengaturan Absensi</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="rw-micro block mb-1">Latitude Kantor</label>
            <input
              type="text"
              value={settingsForm.office_lat}
              onChange={(e) => setSettingsForm({ ...settingsForm, office_lat: e.target.value })}
              className="rw-input w-full"
            />
          </div>
          <div>
            <label className="rw-micro block mb-1">Longitude Kantor</label>
            <input
              type="text"
              value={settingsForm.office_lng}
              onChange={(e) => setSettingsForm({ ...settingsForm, office_lng: e.target.value })}
              className="rw-input w-full"
            />
          </div>
        </div>

        <div>
          <label className="rw-micro block mb-1">Radius (meter)</label>
          <input
            type="number"
            value={settingsForm.radius_meters}
            onChange={(e) => setSettingsForm({ ...settingsForm, radius_meters: e.target.value })}
            className="rw-input w-full"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="rw-micro block mb-1">Jam Masuk</label>
            <input
              type="time"
              value={settingsForm.work_start}
              onChange={(e) => setSettingsForm({ ...settingsForm, work_start: e.target.value })}
              className="rw-input w-full"
            />
          </div>
          <div>
            <label className="rw-micro block mb-1">Jam Pulang</label>
            <input
              type="time"
              value={settingsForm.work_end}
              onChange={(e) => setSettingsForm({ ...settingsForm, work_end: e.target.value })}
              className="rw-input w-full"
            />
          </div>
        </div>

        <div>
          <label className="rw-micro block mb-2">Hari Kerja Default</label>
          <p className="text-[11px] mb-2" style={{ color: "var(--ink-muted)" }}>
            Hari yang tidak dicentang = hari libur (karyawan tidak perlu absen)
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {DAY_ORDER.map((day) => {
              const active = workDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setWorkDays((prev: DayKey[]) =>
                      active ? prev.filter((d: DayKey) => d !== day) : [...prev, day]
                    );
                  }}
                  className="py-2 text-xs font-medium transition"
                  style={{
                    borderRadius: "var(--radius-md)",
                    background: active ? "var(--wine)" : "var(--surface-300)",
                    color: active ? "var(--on-wine)" : "var(--ink-muted)",
                    boxShadow: active ? "var(--shadow-sm)" : "none",
                  }}
                >
                  {DAY_LABELS[day].slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="flex items-center justify-between p-3"
          style={{
            background: "var(--wine-tint)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--line)",
          }}
        >
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
              <QrCode size={14} /> Wajib Scan QR Code
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-muted)" }}>
              Karyawan harus scan QR di kantor sebelum bisa clock-in
            </p>
            <p className="text-[10px] mt-1" style={{ color: "var(--wine)" }}>
              Tampilkan QR di <strong>Menu QR Code</strong> (pojok kanan atas)
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={qrRequired}
              onChange={(e) => setQrRequired(e.target.checked)}
              className="sr-only peer"
            />
            <div
              className="w-11 h-6 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
              style={{ background: qrRequired ? "var(--wine)" : "var(--line-strong)" }}
            ></div>
          </label>
        </div>

        <button type="submit" className="rw-btn rw-btn--primary">
          Simpan Pengaturan
        </button>
        {settingsMsg && (
          <p className="text-sm" style={{ color: "var(--success)" }}>{settingsMsg}</p>
        )}
      </form>

      <div className="rw-card mt-4 max-w-lg">
        <h3 className="rw-heading mb-2 flex items-center gap-2" style={{ color: "var(--ink)" }}>
          <FileTextIcon size={16} /> Google Sheets Live Sync
        </h3>
        <p className="text-xs mb-3" style={{ color: "var(--ink-muted)" }}>
          Sinkronkan data absensi ke Google Sheets pakai formula{" "}
          <code
            className="px-1 text-[10px]"
            style={{ background: "var(--surface-300)", borderRadius: "var(--radius-sm)" }}
          >=IMPORTDATA()</code>.
          Data auto-update setiap 1 jam.
        </p>
        <div className="p-3 space-y-2" style={{ background: "var(--surface-300)", borderRadius: "var(--radius-md)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--ink-muted)" }}>Langkah:</p>
          <ol className="text-xs list-decimal list-inside space-y-1" style={{ color: "var(--ink-muted)" }}>
            <li>
              Set env{" "}
              <code
                className="px-1"
                style={{ background: "var(--surface-200)", borderRadius: "var(--radius-sm)" }}
              >CSV_EXPORT_KEY</code>{" "}
              di Vercel (nilai bebas, jadikan password)
            </li>
            <li>Di Google Sheets, cell A1 ketik formula:</li>
          </ol>
          <div
            className="text-[10px] p-2 font-mono break-all"
            style={{
              background: "var(--wine-deep)",
              color: "var(--success)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            =IMPORTDATA(&quot;https://absensiredwine.vercel.app/api/attendance-csv?month={month}&amp;key=YOUR_SECRET&quot;)
          </div>
          <p className="text-[10px]" style={{ color: "var(--ink-muted)" }}>
            Ganti YOUR_SECRET dengan nilai env, dan {"{month}"} dengan format yyyy-MM (misal: 2026-04)
          </p>
        </div>
      </div>
    </>
  );
}
