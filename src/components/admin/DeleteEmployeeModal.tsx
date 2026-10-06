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
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-3">
            <span className="text-3xl">&#9888;&#65039;</span>
          </div>
          <h3 className="font-bold text-gray-900 text-lg">Kelola <span className="text-primary">{employee.name}</span></h3>
          <p className="text-sm text-gray-600 mt-2">
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
              className="py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold shadow-sm active:scale-95 transition flex items-center justify-center gap-2"
            >
              &#128274; Nonaktifkan Karyawan
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onToggleActive(employee)}
              className="py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-sm active:scale-95 transition flex items-center justify-center gap-2"
            >
              &#10003; Aktifkan Kembali
            </button>
          )}

          {employee.is_active && (
            <p className="text-[11px] text-gray-500 text-center -mt-1 mb-1">
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
            className="py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition flex items-center justify-center gap-2"
          >
            <Trash2 size={15} /> Hapus Permanen (tidak bisa dibatalkan)
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-2.5 text-gray-500 rounded-xl text-sm font-medium hover:bg-gray-50"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
