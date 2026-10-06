"use client";

import type { FormEvent } from "react";
import type { DayKey } from "@/lib/types";
import { DAY_ORDER, DAY_LABELS } from "@/lib/workHours";
import { QrCode, FileText as FileTextIcon, MapPin, Clock, Calendar, Shield } from "lucide-react";

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left column — Settings form */}
      <form onSubmit={onSave} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {/* Location card */}
        <div className="rw-card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <div
              style={{
                width: 32, height: 32,
                borderRadius: "var(--radius-md)",
                background: "var(--wine-tint)",
                color: "var(--wine)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <MapPin size={16} />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Lokasi Kantor</h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="rw-micro block mb-1">Latitude</label>
              <input
                type="text"
                value={settingsForm.office_lat}
                onChange={(e) => setSettingsForm({ ...settingsForm, office_lat: e.target.value })}
                className="rw-input w-full"
              />
            </div>
            <div>
              <label className="rw-micro block mb-1">Longitude</label>
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
            <p style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 4 }}>
              Jarak maksimal dari titik kantor untuk bisa clock-in
            </p>
          </div>
        </div>

        {/* Work hours card */}
        <div className="rw-card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <div
              style={{
                width: 32, height: 32,
                borderRadius: "var(--radius-md)",
                background: "var(--wine-tint)",
                color: "var(--wine)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Clock size={16} />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Jam Kerja</h3>
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
        </div>

        {/* Work days card */}
        <div className="rw-card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <div
              style={{
                width: 32, height: 32,
                borderRadius: "var(--radius-md)",
                background: "var(--wine-tint)",
                color: "var(--wine)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Calendar size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Hari Kerja Default</h3>
              <p style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 2 }}>
                Hari tidak dicentang = libur (tidak perlu absen)
              </p>
            </div>
          </div>
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
                  className="py-2.5 text-xs font-semibold transition"
                  style={{
                    borderRadius: "var(--radius-md)",
                    background: active ? "var(--wine)" : "var(--surface-300)",
                    color: active ? "var(--on-wine)" : "var(--ink-muted)",
                    boxShadow: active ? "var(--shadow-sm)" : "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {DAY_LABELS[day].slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Save button */}
        <button type="submit" className="rw-btn rw-btn--primary rw-btn--block" style={{ padding: "12px 24px" }}>
          Simpan Pengaturan
        </button>
        {settingsMsg && (
          <p style={{ fontSize: 14, color: "var(--success)", textAlign: "center" }}>{settingsMsg}</p>
        )}
      </form>

      {/* Right column — QR + Google Sheets */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {/* QR Code card */}
        <div className="rw-card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <div
              style={{
                width: 32, height: 32,
                borderRadius: "var(--radius-md)",
                background: "var(--wine-tint)",
                color: "var(--wine)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Shield size={16} />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Verifikasi QR</h3>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "var(--space-3)",
              background: "var(--wine-tint)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--line)",
            }}
          >
            <div>
              <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
                <QrCode size={14} /> Wajib Scan QR Code
              </p>
              <p style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4 }}>
                Karyawan harus scan QR di kantor sebelum bisa clock-in
              </p>
              <p style={{ fontSize: 10, color: "var(--wine)", marginTop: 4 }}>
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
        </div>

        {/* Google Sheets card */}
        <div className="rw-card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <div
              style={{
                width: 32, height: 32,
                borderRadius: "var(--radius-md)",
                background: "var(--success-tint)",
                color: "var(--success)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <FileTextIcon size={16} />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Google Sheets Live Sync</h3>
          </div>

          <p style={{ fontSize: 13, color: "var(--ink-muted)" }}>
            Sinkronkan data absensi ke Google Sheets pakai formula{" "}
            <code
              style={{
                fontSize: 11,
                padding: "2px 6px",
                background: "var(--surface-300)",
                borderRadius: "var(--radius-sm)",
              }}
            >=IMPORTDATA()</code>.
            Data auto-update setiap 1 jam.
          </p>

          <div style={{ padding: "var(--space-3)", background: "var(--surface-300)", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)" }}>Langkah:</p>
            <ol className="list-decimal list-inside" style={{ fontSize: 12, color: "var(--ink-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
              <li>
                Set env{" "}
                <code
                  style={{
                    fontSize: 11,
                    padding: "1px 4px",
                    background: "var(--surface-200)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >CSV_EXPORT_KEY</code>{" "}
                di Vercel (nilai bebas, jadikan password)
              </li>
              <li>Di Google Sheets, cell A1 ketik formula:</li>
            </ol>
            <div
              style={{
                fontSize: 11,
                padding: "8px 12px",
                fontFamily: "monospace",
                wordBreak: "break-all",
                background: "var(--wine-deep)",
                color: "#a8e6b0",
                borderRadius: "var(--radius-sm)",
              }}
            >
              =IMPORTDATA(&quot;https://absensiredwine.vercel.app/api/attendance-csv?month={month}&amp;key=YOUR_SECRET&quot;)
            </div>
            <p style={{ fontSize: 11, color: "var(--ink-muted)" }}>
              Ganti YOUR_SECRET dengan nilai env, dan {"{month}"} dengan format yyyy-MM (misal: 2026-04)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
