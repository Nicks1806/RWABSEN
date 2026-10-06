"use client";

import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { FileText as FileTextIcon, CheckCircle, X, FileCheck, FileX } from "lucide-react";
import Avatar from "@/components/Avatar";
import type { Leave, Reimbursement } from "@/lib/types";

export type LeaveFilter = "all" | "pending" | "approved" | "rejected";
export type LeavesSubTab = "izin" | "reimburse";

type LeaveWithEmp = Leave & { employees?: { name: string } };
type ReimbWithEmp = Reimbursement & { employees?: { name: string } };

interface Props {
  leaves: LeaveWithEmp[];
  reimbs: ReimbWithEmp[];
  leavesSubTab: LeavesSubTab;
  setLeavesSubTab: (t: LeavesSubTab) => void;
  leaveFilter: LeaveFilter;
  setLeaveFilter: (f: LeaveFilter) => void;
  selectedLeaveIds: Set<string>;
  setSelectedLeaveIds: (s: Set<string>) => void;
  selectedReimbIds: Set<string>;
  setSelectedReimbIds: (s: Set<string>) => void;
  onBulkReviewLeaves: (ids: string[], status: "approved" | "rejected") => void;
  onBulkReviewReimbs: (ids: string[], status: "approved" | "rejected") => void;
  onReviewLeave: (id: string, status: "approved" | "rejected", notes?: string) => void;
  onReviewReimb: (id: string, status: "approved" | "rejected", notes?: string) => void;
  globalSearch: string;
}

export default function LeavesTab({
  leaves, reimbs, leavesSubTab, setLeavesSubTab, leaveFilter, setLeaveFilter,
  selectedLeaveIds, setSelectedLeaveIds, selectedReimbIds, setSelectedReimbIds,
  onBulkReviewLeaves, onBulkReviewReimbs, onReviewLeave, onReviewReimb, globalSearch,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Sub-tab: Izin vs Reimburse */}
      <div className="bg-white rounded-2xl shadow-sm p-1 grid grid-cols-2 gap-1">
        <button
          onClick={() => {
            setLeavesSubTab("izin");
            setLeaveFilter("all");
          }}
          className={`py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-1.5 ${
            leavesSubTab === "izin" ? "bg-primary text-white shadow-sm" : "text-gray-500"
          }`}
        >
          <FileTextIcon size={16} /> Izin/Cuti ({leaves.filter((l) => l.status === "pending").length})
        </button>
        <button
          onClick={() => {
            setLeavesSubTab("reimburse");
            setLeaveFilter("all");
          }}
          className={`py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-1.5 ${
            leavesSubTab === "reimburse" ? "bg-primary text-white shadow-sm" : "text-gray-500"
          }`}
        >
          💰 Reimburse ({reimbs.filter((r) => r.status === "pending").length})
        </button>
      </div>

      {leavesSubTab === "izin" ? (
      <>
      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto">
        {[
          { key: "all" as const, label: "Semua", count: leaves.length },
          { key: "pending" as const, label: "Menunggu", count: leaves.filter((l) => l.status === "pending").length },
          { key: "approved" as const, label: "Disetujui", count: leaves.filter((l) => l.status === "approved").length },
          { key: "rejected" as const, label: "Ditolak", count: leaves.filter((l) => l.status === "rejected").length },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setLeaveFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              leaveFilter === f.key
                ? "bg-primary text-white"
                : "bg-white text-gray-600 hover:bg-gray-50 border"
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Bulk action bar for pending leaves */}
      {leaveFilter === "pending" && leaves.filter((l) => l.status === "pending").length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-2 flex items-center gap-2 flex-wrap animate-fade-in">
          <button
            onClick={() => {
              const pendingIds = leaves.filter((l) => l.status === "pending").map((l) => l.id);
              setSelectedLeaveIds(new Set(pendingIds.length === selectedLeaveIds.size ? [] : pendingIds));
            }}
            className="text-xs font-semibold text-primary hover:underline px-2 py-1"
          >
            {selectedLeaveIds.size === leaves.filter((l) => l.status === "pending").length ? "Batal pilih semua" : "Pilih semua"}
          </button>
          {selectedLeaveIds.size > 0 && (
            <>
              <span className="text-xs text-gray-500">{selectedLeaveIds.size} dipilih</span>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => onBulkReviewLeaves(Array.from(selectedLeaveIds), "approved")}
                  className="px-3 py-1.5 bg-gradient-to-br from-emerald-500 to-green-500 text-white rounded-lg text-xs font-bold hover:shadow-md transition inline-flex items-center gap-1"
                >
                  <CheckCircle size={13} /> Setujui semua
                </button>
                <button
                  onClick={() => onBulkReviewLeaves(Array.from(selectedLeaveIds), "rejected")}
                  className="px-3 py-1.5 bg-gradient-to-br from-rose-500 to-red-500 text-white rounded-lg text-xs font-bold hover:shadow-md transition inline-flex items-center gap-1"
                >
                  <X size={13} /> Tolak semua
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Leave List */}
      <div className="space-y-3">
        {leaves
          .filter((l) => leaveFilter === "all" || l.status === leaveFilter)
          .filter((l) => {
            const search = globalSearch.trim().toLowerCase();
            if (!search) return true;
            return l.employees?.name?.toLowerCase().includes(search) || false;
          })
          .map((leave) => {
            const emp = leave.employees;
            const typeColor = {
              cuti: "bg-blue-50 text-blue-700",
              sakit: "bg-orange-50 text-orange-700",
              izin: "bg-purple-50 text-purple-700",
            }[leave.leave_type];
            const statusColor = {
              pending: "bg-yellow-50 text-yellow-700",
              approved: "bg-green-50 text-green-700",
              rejected: "bg-red-50 text-red-700",
            }[leave.status];
            const statusLabel = {
              pending: "Menunggu",
              approved: "Disetujui",
              rejected: "Ditolak",
            }[leave.status];

            return (
              <div key={leave.id} className={`bg-white rounded-2xl p-4 shadow-sm transition-all animate-stagger ${selectedLeaveIds.has(leave.id) ? "ring-2 ring-primary ring-offset-1" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {leave.status === "pending" && (
                      <input
                        type="checkbox"
                        checked={selectedLeaveIds.has(leave.id)}
                        onChange={(e) => {
                          const next = new Set(selectedLeaveIds);
                          if (e.target.checked) next.add(leave.id); else next.delete(leave.id);
                          setSelectedLeaveIds(next);
                        }}
                        className="mt-1 w-4 h-4 accent-primary cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Pilih untuk bulk action"
                      />
                    )}
                    <Avatar name={emp?.name || "?"} size="md" />
                    <div className="min-w-0">
                      <p className="font-semibold">{emp?.name || "-"}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${typeColor}`}>
                          {leave.leave_type}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1.5">
                        {format(new Date(leave.start_date), "dd MMM yyyy", { locale: idLocale })}
                        {leave.start_date !== leave.end_date &&
                          ` - ${format(new Date(leave.end_date), "dd MMM yyyy", { locale: idLocale })}`}
                      </p>
                      <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{leave.reason}</p>
                      {leave.attachment_url && (
                        <a
                          href={leave.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline mt-1 inline-flex items-center gap-1"
                        >
                          <FileTextIcon size={12} /> Lihat lampiran
                        </a>
                      )}
                      {leave.admin_notes && (
                        <p className="text-xs text-gray-500 mt-2 italic">
                          Catatan admin: {leave.admin_notes}
                        </p>
                      )}
                    </div>
                  </div>
                  {leave.status === "pending" && (
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={() => onReviewLeave(leave.id, "approved")}
                        className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-600 hover:text-white transition inline-flex items-center gap-1 font-medium"
                      >
                        <FileCheck size={14} /> Setujui
                      </button>
                      <button
                        onClick={() => {
                          const notes = prompt("Alasan penolakan (opsional):") || "";
                          onReviewLeave(leave.id, "rejected", notes);
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-600 hover:text-white transition inline-flex items-center gap-1 font-medium"
                      >
                        <FileX size={14} /> Tolak
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        {leaves.filter((l) => leaveFilter === "all" || l.status === leaveFilter).length ===
          0 && (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
            Belum ada pengajuan izin
          </div>
        )}
      </div>
      </>
      ) : (
        /* REIMBURSE SECTION */
        <>
          <div className="flex gap-2 overflow-x-auto">
            {[
              { key: "all" as const, label: "Semua", count: reimbs.length },
              { key: "pending" as const, label: "Menunggu", count: reimbs.filter((r) => r.status === "pending").length },
              { key: "approved" as const, label: "Disetujui", count: reimbs.filter((r) => r.status === "approved").length },
              { key: "rejected" as const, label: "Ditolak", count: reimbs.filter((r) => r.status === "rejected").length },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setLeaveFilter(f.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  leaveFilter === f.key
                    ? "bg-primary text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50 border"
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          {/* Bulk action bar for pending reimbursements */}
          {leaveFilter === "pending" && reimbs.filter((r) => r.status === "pending").length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-2 flex items-center gap-2 flex-wrap animate-fade-in">
              <button
                onClick={() => {
                  const pendingIds = reimbs.filter((r) => r.status === "pending").map((r) => r.id);
                  setSelectedReimbIds(new Set(pendingIds.length === selectedReimbIds.size ? [] : pendingIds));
                }}
                className="text-xs font-semibold text-primary hover:underline px-2 py-1"
              >
                {selectedReimbIds.size === reimbs.filter((r) => r.status === "pending").length ? "Batal pilih semua" : "Pilih semua"}
              </button>
              {selectedReimbIds.size > 0 && (
                <>
                  <span className="text-xs text-gray-500">{selectedReimbIds.size} dipilih</span>
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={() => onBulkReviewReimbs(Array.from(selectedReimbIds), "approved")}
                      className="px-3 py-1.5 bg-gradient-to-br from-emerald-500 to-green-500 text-white rounded-lg text-xs font-bold hover:shadow-md transition inline-flex items-center gap-1"
                    >
                      <CheckCircle size={13} /> Setujui semua
                    </button>
                    <button
                      onClick={() => onBulkReviewReimbs(Array.from(selectedReimbIds), "rejected")}
                      className="px-3 py-1.5 bg-gradient-to-br from-rose-500 to-red-500 text-white rounded-lg text-xs font-bold hover:shadow-md transition inline-flex items-center gap-1"
                    >
                      <X size={13} /> Tolak semua
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="space-y-3">
            {reimbs
              .filter((r) => leaveFilter === "all" || r.status === leaveFilter)
              .filter((r) => {
                const search = globalSearch.trim().toLowerCase();
                if (!search) return true;
                return r.employees?.name?.toLowerCase().includes(search) || false;
              })
              .map((reimb) => {
                const emp = reimb.employees;
                const statusColor = {
                  pending: "bg-yellow-50 text-yellow-700",
                  approved: "bg-green-50 text-green-700",
                  rejected: "bg-red-50 text-red-700",
                }[reimb.status];
                const catEmoji = {
                  umum: "📦",
                  transport: "🚗",
                  makanan: "🍱",
                  medis: "💊",
                  lainnya: "📋",
                }[reimb.category] || "📋";

                return (
                  <div key={reimb.id} className={`bg-white rounded-2xl p-4 shadow-sm transition-all animate-stagger ${selectedReimbIds.has(reimb.id) ? "ring-2 ring-primary ring-offset-1" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {reimb.status === "pending" && (
                          <input
                            type="checkbox"
                            checked={selectedReimbIds.has(reimb.id)}
                            onChange={(e) => {
                              const next = new Set(selectedReimbIds);
                              if (e.target.checked) next.add(reimb.id); else next.delete(reimb.id);
                              setSelectedReimbIds(next);
                            }}
                            className="mt-1 w-4 h-4 accent-primary cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Pilih untuk bulk action"
                          />
                        )}
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl shrink-0">
                          {catEmoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{emp?.name || "-"}</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700 capitalize">
                              {reimb.category}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                              {reimb.status === "pending" ? "Menunggu" : reimb.status === "approved" ? "Disetujui" : "Ditolak"}
                            </span>
                          </div>
                          <p className="text-lg font-bold text-primary mt-2">
                            Rp {Number(reimb.amount).toLocaleString("id-ID")}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {format(new Date(reimb.transaction_date), "dd MMM yyyy", { locale: idLocale })}
                          </p>
                          {reimb.description && (
                            <p className="text-sm text-gray-700 mt-2">{reimb.description}</p>
                          )}
                          {reimb.bank_account && (
                            <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                              <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">
                                Rekening Transfer
                              </p>
                              <p className="text-sm text-blue-900 font-mono font-semibold">
                                {reimb.bank_account}
                              </p>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(reimb.bank_account || "");
                                }}
                                className="text-[10px] text-blue-600 hover:underline mt-0.5"
                              >
                                Salin
                              </button>
                            </div>
                          )}
                          {reimb.attachment_url && (
                            <a
                              href={reimb.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline mt-1 inline-flex items-center gap-1"
                            >
                              <FileTextIcon size={12} /> Lihat bukti
                            </a>
                          )}
                          {reimb.admin_notes && (
                            <p className="text-xs text-gray-500 mt-2 italic">
                              Catatan admin: {reimb.admin_notes}
                            </p>
                          )}
                        </div>
                      </div>
                      {reimb.status === "pending" && (
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button
                            onClick={() => onReviewReimb(reimb.id, "approved")}
                            className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-600 hover:text-white transition inline-flex items-center gap-1 font-medium"
                          >
                            <FileCheck size={14} /> Setujui
                          </button>
                          <button
                            onClick={() => {
                              const notes = prompt("Alasan penolakan (opsional):") || "";
                              onReviewReimb(reimb.id, "rejected", notes);
                            }}
                            className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-600 hover:text-white transition inline-flex items-center gap-1 font-medium"
                          >
                            <FileX size={14} /> Tolak
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            {reimbs.filter((r) => leaveFilter === "all" || r.status === leaveFilter).length === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
                Belum ada pengajuan reimburse
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
