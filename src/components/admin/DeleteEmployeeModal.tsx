"use client";

import { Employee } from "@/lib/types";
import { Trash2 } from "lucide-react";

interface Props {
  employee: Employee;
  onToggleActive: (emp: Employee) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function DeleteEmployeeModal({
  employee,
  onToggleActive,
  onDelete,
  onClose,
}: Props) {
  return (
    <div className="rw-overlay flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="rw-card w-full max-w-sm"
        style={{ boxShadow: "var(--shadow-modal)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div
            className="w-16 h-16 flex items-center justify-center mb-3"
            style={{ borderRadius: "var(--radius-full)", background: "var(--warning-tint)" }}
          >
            <span className="text-3xl">&#9888;&#65039;</span>
          </div>
          <h3 className="font-bold text-lg" style={{ color: "var(--ink)" }}>
            Kelola <span style={{ color: "var(--wine)" }}>{employee.name}</span>
          </h3>
          <p className="text-sm mt-2" style={{ color: "var(--ink-muted)" }}>
            {employee.is_active
              ? "Pilih tindakan untuk karyawan ini"
              : "Karyawan ini sedang nonaktif"}
          </p>
        </div>

        <div className="flex flex-col gap-2 mt-5">
          {/* Soft delete -- recommended */}
          {employee.is_active ? (
            <button
              type="button"
              onClick={() => onToggleActive(employee)}
              className="rw-btn rw-btn--warning rw-btn--block"
              style={{ paddingTop: "var(--space-3)", paddingBottom: "var(--space-3)", fontWeight: 700 }}
            >
              &#128274; Nonaktifkan Karyawan
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onToggleActive(employee)}
              className="rw-btn rw-btn--block"
              style={{
                paddingTop: "var(--space-3)",
                paddingBottom: "var(--space-3)",
                fontWeight: 700,
                background: "var(--success)",
                color: "var(--on-wine)",
              }}
            >
              &#10003; Aktifkan Kembali
            </button>
          )}

          {employee.is_active && (
            <p className="text-[11px] text-center -mt-1 mb-1" style={{ color: "var(--ink-muted)" }}>
              &#128161; Login terblokir, history absensi tetap aman
            </p>
          )}

          {/* Hard delete -- danger */}
          <button
            type="button"
            onClick={() => {
              if (confirm(`HAPUS PERMANEN ${employee.name}?\n\nSemua data absensi, cuti, reimburse akan hilang dan TIDAK BISA dikembalikan.\n\nYakin?`)) {
                onDelete(employee.id);
              }
            }}
            className="rw-btn rw-btn--outline flex items-center justify-center gap-2"
            style={{
              borderColor: "var(--danger-tint)",
              color: "var(--danger)",
            }}
          >
            <Trash2 size={15} /> Hapus Permanen (tidak bisa dibatalkan)
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rw-btn rw-btn--ghost rw-btn--block"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
