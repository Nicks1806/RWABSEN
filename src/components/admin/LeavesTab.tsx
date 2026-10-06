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
      <div className="rw-card p-1 grid grid-cols-2 gap-1" style={{ padding: "var(--space-1)" }}>
        <button
          onClick={() => {
            setLeavesSubTab("izin");
            setLeaveFilter("all");
          }}
          className="py-2.5 text-sm font-semibold transition flex items-center justify-center gap-1.5"
          style={{
            borderRadius: "var(--radius-md)",
            background: leavesSubTab === "izin" ? "var(--wine)" : "transparent",
            color: leavesSubTab === "izin" ? "var(--on-wine)" : "var(--ink-muted)",
            boxShadow: leavesSubTab === "izin" ? "var(--shadow-sm)" : "none",
          }}
        >
          <FileTextIcon size={16} /> Izin/Cuti ({leaves.filter((l) => l.status === "pending").length})
        </button>
        <button
          onClick={() => {
            setLeavesSubTab("reimburse");
            setLeaveFilter("all");
          }}
          className="py-2.5 text-sm font-semibold transition flex items-center justify-center gap-1.5"
          style={{
            borderRadius: "var(--radius-md)",
            background: leavesSubTab === "reimburse" ? "var(--wine)" : "transparent",
            color: leavesSubTab === "reimburse" ? "var(--on-wine)" : "var(--ink-muted)",
            boxShadow: leavesSubTab === "reimburse" ? "var(--shadow-sm)" : "none",
          }}
        >
          Reimburse ({reimbs.filter((r) => r.status === "pending").length})
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
            className="px-4 py-2 text-sm font-medium whitespace-nowrap transition"
            style={{
              borderRadius: "var(--radius-md)",
              background: leaveFilter === f.key ? "var(--wine)" : "var(--surface-200)",
              color: leaveFilter === f.key ? "var(--on-wine)" : "var(--ink-muted)",
              border: leaveFilter === f.key ? "none" : "1px solid var(--line)",
            }}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Bulk action bar for pending leaves */}
      {leaveFilter === "pending" && leaves.filter((l) => l.status === "pending").length > 0 && (
        <div
          className="rw-card p-2 flex items-center gap-2 flex-wrap animate-fade-in"
          style={{ padding: "var(--space-2)" }}
        >
          <button
            onClick={() => {
              const pendingIds = leaves.filter((l) => l.status === "pending").map((l) => l.id);
              setSelectedLeaveIds(new Set(pendingIds.length === selectedLeaveIds.size ? [] : pendingIds));
            }}
            className="text-xs font-semibold px-2 py-1"
            style={{ color: "var(--wine)" }}
          >
            {selectedLeaveIds.size === leaves.filter((l) => l.status === "pending").length ? "Batal pilih semua" : "Pilih semua"}
          </button>
          {selectedLeaveIds.size > 0 && (
            <>
              <span className="text-xs" style={{ color: "var(--ink-muted)" }}>{selectedLeaveIds.size} dipilih</span>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => onBulkReviewLeaves(Array.from(selectedLeaveIds), "approved")}
                  className="rw-btn rw-btn--sm inline-flex items-center gap-1"
                  style={{ background: "var(--success)", color: "var(--on-wine)", fontWeight: 700 }}
                >
                  <CheckCircle size={13} /> Setujui semua
                </button>
                <button
                  onClick={() => onBulkReviewLeaves(Array.from(selectedLeaveIds), "rejected")}
                  className="rw-btn rw-btn--sm rw-btn--danger inline-flex items-center gap-1"
                  style={{ fontWeight: 700 }}
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
            const typeStyle: Record<string, { bg: string; color: string }> = {
              cuti: { bg: "var(--wine-tint)", color: "var(--wine)" },
              sakit: { bg: "var(--warning-tint)", color: "var(--warning)" },
              izin: { bg: "var(--surface-300)", color: "var(--ink-muted)" },
            };
            const statusStyle: Record<string, { bg: string; color: string }> = {
              pending: { bg: "var(--warning-tint)", color: "var(--warning)" },
              approved: { bg: "var(--success-tint)", color: "var(--success)" },
              rejected: { bg: "var(--danger-tint)", color: "var(--danger)" },
            };
            const statusLabel: Record<string, string> = {
              pending: "Menunggu",
              approved: "Disetujui",
              rejected: "Ditolak",
            };
            const ts = typeStyle[leave.leave_type] || typeStyle.izin;
            const ss = statusStyle[leave.status] || statusStyle.pending;

            return (
              <div
                key={leave.id}
                className="rw-card transition-all animate-stagger"
                style={{
                  outline: selectedLeaveIds.has(leave.id) ? "2px solid var(--wine)" : "none",
                  outlineOffset: "1px",
                }}
              >
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
                        className="mt-1 w-4 h-4 cursor-pointer"
                        style={{ accentColor: "var(--wine)" }}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Pilih untuk bulk action"
                      />
                    )}
                    <Avatar name={emp?.name || "?"} size="md" />
                    <div className="min-w-0">
                      <p className="font-semibold" style={{ color: "var(--ink)" }}>{emp?.name || "-"}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span
                          className="text-[10px] px-2 py-0.5 font-medium capitalize"
                          style={{ borderRadius: "var(--radius-full)", background: ts.bg, color: ts.color }}
                        >
                          {leave.leave_type}
                        </span>
                        <span
                          className="text-[10px] px-2 py-0.5 font-medium"
                          style={{ borderRadius: "var(--radius-full)", background: ss.bg, color: ss.color }}
                        >
                          {statusLabel[leave.status]}
                        </span>
                      </div>
                      <p className="text-xs mt-1.5" style={{ color: "var(--ink-muted)" }}>
                        {format(new Date(leave.start_date), "dd MMM yyyy", { locale: idLocale })}
                        {leave.start_date !== leave.end_date &&
                          ` - ${format(new Date(leave.end_date), "dd MMM yyyy", { locale: idLocale })}`}
                      </p>
                      <p className="text-sm mt-2 whitespace-pre-wrap" style={{ color: "var(--ink)" }}>{leave.reason}</p>
                      {leave.attachment_url && (
                        <a
                          href={leave.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs mt-1 inline-flex items-center gap-1"
                          style={{ color: "var(--wine)" }}
                        >
                          <FileTextIcon size={12} /> Lihat lampiran
                        </a>
                      )}
                      {leave.admin_notes && (
                        <p className="text-xs mt-2 italic" style={{ color: "var(--ink-muted)" }}>
                          Catatan admin: {leave.admin_notes}
                        </p>
                      )}
                    </div>
                  </div>
                  {leave.status === "pending" && (
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={() => onReviewLeave(leave.id, "approved")}
                        className="rw-btn rw-btn--sm inline-flex items-center gap-1 font-medium"
                        style={{ background: "var(--success-tint)", color: "var(--success)" }}
                      >
                        <FileCheck size={14} /> Setujui
                      </button>
                      <button
                        onClick={() => {
                          const notes = prompt("Alasan penolakan (opsional):") || "";
                          onReviewLeave(leave.id, "rejected", notes);
                        }}
                        className="rw-btn rw-btn--sm inline-flex items-center gap-1 font-medium"
                        style={{ background: "var(--danger-tint)", color: "var(--danger)" }}
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
          <div className="rw-card p-8 text-center" style={{ color: "var(--ink-muted)" }}>
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
                className="px-4 py-2 text-sm font-medium whitespace-nowrap transition"
                style={{
                  borderRadius: "var(--radius-md)",
                  background: leaveFilter === f.key ? "var(--wine)" : "var(--surface-200)",
                  color: leaveFilter === f.key ? "var(--on-wine)" : "var(--ink-muted)",
                  border: leaveFilter === f.key ? "none" : "1px solid var(--line)",
                }}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          {/* Bulk action bar for pending reimbursements */}
          {leaveFilter === "pending" && reimbs.filter((r) => r.status === "pending").length > 0 && (
            <div
              className="rw-card p-2 flex items-center gap-2 flex-wrap animate-fade-in"
              style={{ padding: "var(--space-2)" }}
            >
              <button
                onClick={() => {
                  const pendingIds = reimbs.filter((r) => r.status === "pending").map((r) => r.id);
                  setSelectedReimbIds(new Set(pendingIds.length === selectedReimbIds.size ? [] : pendingIds));
                }}
                className="text-xs font-semibold px-2 py-1"
                style={{ color: "var(--wine)" }}
              >
                {selectedReimbIds.size === reimbs.filter((r) => r.status === "pending").length ? "Batal pilih semua" : "Pilih semua"}
              </button>
              {selectedReimbIds.size > 0 && (
                <>
                  <span className="text-xs" style={{ color: "var(--ink-muted)" }}>{selectedReimbIds.size} dipilih</span>
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={() => onBulkReviewReimbs(Array.from(selectedReimbIds), "approved")}
                      className="rw-btn rw-btn--sm inline-flex items-center gap-1"
                      style={{ background: "var(--success)", color: "var(--on-wine)", fontWeight: 700 }}
                    >
                      <CheckCircle size={13} /> Setujui semua
                    </button>
                    <button
                      onClick={() => onBulkReviewReimbs(Array.from(selectedReimbIds), "rejected")}
                      className="rw-btn rw-btn--sm rw-btn--danger inline-flex items-center gap-1"
                      style={{ fontWeight: 700 }}
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
                const statusStyle: Record<string, { bg: string; color: string }> = {
                  pending: { bg: "var(--warning-tint)", color: "var(--warning)" },
                  approved: { bg: "var(--success-tint)", color: "var(--success)" },
                  rejected: { bg: "var(--danger-tint)", color: "var(--danger)" },
                };
                const ss = statusStyle[reimb.status] || statusStyle.pending;
                const catEmoji: Record<string, string> = {
                  umum: "📦",
                  transport: "🚗",
                  makanan: "🍱",
                  medis: "💊",
                  lainnya: "📋",
                };

                return (
                  <div
                    key={reimb.id}
                    className="rw-card transition-all animate-stagger"
                    style={{
                      outline: selectedReimbIds.has(reimb.id) ? "2px solid var(--wine)" : "none",
                      outlineOffset: "1px",
                    }}
                  >
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
                            className="mt-1 w-4 h-4 cursor-pointer"
                            style={{ accentColor: "var(--wine)" }}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Pilih untuk bulk action"
                          />
                        )}
                        <div
                          className="w-10 h-10 flex items-center justify-center text-xl shrink-0"
                          style={{ borderRadius: "var(--radius-md)", background: "var(--wine-tint)" }}
                        >
                          {catEmoji[reimb.category] || "📋"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold" style={{ color: "var(--ink)" }}>{emp?.name || "-"}</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span
                              className="rw-badge--neutral text-[10px] px-2 py-0.5 font-medium capitalize"
                            >
                              {reimb.category}
                            </span>
                            <span
                              className="text-[10px] px-2 py-0.5 font-medium"
                              style={{ borderRadius: "var(--radius-full)", background: ss.bg, color: ss.color }}
                            >
                              {reimb.status === "pending" ? "Menunggu" : reimb.status === "approved" ? "Disetujui" : "Ditolak"}
                            </span>
                          </div>
                          <p className="text-lg font-bold mt-2" style={{ color: "var(--wine)" }}>
                            Rp {Number(reimb.amount).toLocaleString("id-ID")}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: "var(--ink-muted)" }}>
                            {format(new Date(reimb.transaction_date), "dd MMM yyyy", { locale: idLocale })}
                          </p>
                          {reimb.description && (
                            <p className="text-sm mt-2" style={{ color: "var(--ink)" }}>{reimb.description}</p>
                          )}
                          {reimb.bank_account && (
                            <div
                              className="mt-2 px-3 py-2"
                              style={{
                                background: "var(--wine-tint)",
                                border: "1px solid var(--line)",
                                borderRadius: "var(--radius-md)",
                              }}
                            >
                              <p className="rw-micro" style={{ color: "var(--wine)" }}>
                                Rekening Transfer
                              </p>
                              <p className="text-sm font-mono font-semibold" style={{ color: "var(--ink)" }}>
                                {reimb.bank_account}
                              </p>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(reimb.bank_account || "");
                                }}
                                className="text-[10px] mt-0.5"
                                style={{ color: "var(--wine)" }}
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
                              className="text-xs mt-1 inline-flex items-center gap-1"
                              style={{ color: "var(--wine)" }}
                            >
                              <FileTextIcon size={12} /> Lihat bukti
                            </a>
                          )}
                          {reimb.admin_notes && (
                            <p className="text-xs mt-2 italic" style={{ color: "var(--ink-muted)" }}>
                              Catatan admin: {reimb.admin_notes}
                            </p>
                          )}
                        </div>
                      </div>
                      {reimb.status === "pending" && (
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button
                            onClick={() => onReviewReimb(reimb.id, "approved")}
                            className="rw-btn rw-btn--sm inline-flex items-center gap-1 font-medium"
                            style={{ background: "var(--success-tint)", color: "var(--success)" }}
                          >
                            <FileCheck size={14} /> Setujui
                          </button>
                          <button
                            onClick={() => {
                              const notes = prompt("Alasan penolakan (opsional):") || "";
                              onReviewReimb(reimb.id, "rejected", notes);
                            }}
                            className="rw-btn rw-btn--sm inline-flex items-center gap-1 font-medium"
                            style={{ background: "var(--danger-tint)", color: "var(--danger)" }}
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
              <div className="rw-card p-8 text-center" style={{ color: "var(--ink-muted)" }}>
                Belum ada pengajuan reimburse
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
