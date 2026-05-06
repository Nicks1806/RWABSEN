import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Attendance, Employee, Settings, Leave, Reimbursement } from "./types";
import { getEffectiveWorkHours } from "./workHours";

function minutesBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}j ${m}m`;
}

export function exportMonthlyPDF(params: {
  month: string; // "yyyy-MM"
  employees: Employee[];
  records: (Attendance & { employees?: { name: string } })[];
  settings: Settings | null;
}) {
  const { month, employees, records, settings } = params;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const monthLabel = format(new Date(month + "-01"), "MMMM yyyy", { locale: idLocale });

  // Header
  pdf.setFontSize(20);
  pdf.setTextColor(139, 26, 26);
  pdf.setFont("helvetica", "bold");
  pdf.text("RedWine Shoes & Bags", 105, 18, { align: "center" });

  pdf.setFontSize(11);
  pdf.setTextColor(100);
  pdf.setFont("helvetica", "normal");
  pdf.text("Laporan Absensi Karyawan", 105, 25, { align: "center" });

  pdf.setFontSize(13);
  pdf.setTextColor(0);
  pdf.setFont("helvetica", "bold");
  pdf.text(monthLabel, 105, 33, { align: "center" });

  // Horizontal line
  pdf.setDrawColor(139, 26, 26);
  pdf.setLineWidth(0.5);
  pdf.line(14, 37, 196, 37);

  // Summary per employee
  const summary = employees
    .filter((e) => e.role === "employee")
    .map((emp) => {
      const empRecs = records.filter((r) => r.employee_id === emp.id);
      const presentDays = empRecs.filter((r) => r.clock_in).length;
      const lateDays = empRecs.filter((r) => r.status === "late").length;
      const earlyLeaveDays = empRecs.filter((r) => r.status === "early_leave").length;
      let totalMins = 0;
      for (const r of empRecs) {
        if (r.clock_in && r.clock_out) {
          totalMins += minutesBetween(r.clock_in, r.clock_out);
        }
      }
      return {
        name: emp.name,
        position: emp.position || "-",
        presentDays,
        lateDays,
        earlyLeaveDays,
        totalHours: formatDuration(totalMins),
      };
    });

  autoTable(pdf, {
    startY: 42,
    head: [["Nama", "Posisi", "Hadir", "Terlambat", "Pulang Awal", "Total Jam"]],
    body: summary.map((s) => [
      s.name,
      s.position,
      String(s.presentDays),
      String(s.lateDays),
      String(s.earlyLeaveDays),
      s.totalHours,
    ]),
    headStyles: { fillColor: [139, 26, 26], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3 },
    alternateRowStyles: { fillColor: [252, 245, 245] },
  });

  // Detail per employee
  let y = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 60;

  for (const emp of employees.filter((e) => e.role === "employee")) {
    const empRecs = records
      .filter((r) => r.employee_id === emp.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (empRecs.length === 0) continue;

    y += 10;
    if (y > 260) {
      pdf.addPage();
      y = 20;
    }

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(139, 26, 26);
    pdf.text(emp.name, 14, y);
    const eff = getEffectiveWorkHours(emp, settings);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(100);
    pdf.setFontSize(9);
    pdf.text(
      `Jam Kerja: ${eff.start.slice(0, 5)} - ${eff.end.slice(0, 5)}${emp.position ? ` | ${emp.position}` : ""}`,
      14,
      y + 5
    );

    autoTable(pdf, {
      startY: y + 8,
      head: [["Tanggal", "Masuk", "Keluar", "Status", "Durasi", "Keterangan"]],
      body: empRecs.map((r) => {
        const durMin =
          r.clock_in && r.clock_out ? minutesBetween(r.clock_in, r.clock_out) : 0;
        const statusLabel =
          r.status === "present"
            ? "Hadir"
            : r.status === "late"
            ? "Terlambat"
            : r.status === "early_leave"
            ? "Pulang Awal"
            : "Tidak Hadir";
        return [
          format(new Date(r.date), "dd/MM/yyyy"),
          r.clock_in ? format(new Date(r.clock_in), "HH:mm") : "-",
          r.clock_out ? format(new Date(r.clock_out), "HH:mm") : "-",
          statusLabel,
          durMin > 0 ? formatDuration(durMin) : "-",
          r.notes || "-",
        ];
      }),
      headStyles: { fillColor: [80, 80, 80], textColor: 255, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 5: { cellWidth: 50 } },
    });
    y = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y + 20;
  }

  // Footer
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text(
      `Dibuat pada ${format(new Date(), "dd MMM yyyy HH:mm", { locale: idLocale })} | Halaman ${i}/${pageCount}`,
      105,
      290,
      { align: "center" }
    );
  }

  pdf.save(`Laporan_Absensi_RedWine_${month}.pdf`);
}

// ============================================================================
// Per-Employee Monthly Report
// Comprehensive: attendance log + leaves + reimbursements + summary
// ============================================================================
export function exportEmployeeMonthlyReport(params: {
  month: string; // "yyyy-MM"
  employee: Employee;
  records: Attendance[];
  leaves: Leave[];
  reimbursements: Reimbursement[];
  settings: Settings | null;
}) {
  const { month, employee, records, leaves, reimbursements, settings } = params;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const monthLabel = format(new Date(month + "-01"), "MMMM yyyy", { locale: idLocale });
  const PRIMARY: [number, number, number] = [139, 26, 26];
  const GOLD: [number, number, number] = [212, 175, 55];

  // === COVER HEADER ===
  pdf.setFillColor(...PRIMARY);
  pdf.rect(0, 0, 210, 38, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(11);
  pdf.text("RedWine Shoes & Bags", 14, 12);
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text("Laporan Bulanan Karyawan", 14, 22);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Periode: ${monthLabel}`, 14, 30);

  // Gold divider line
  pdf.setDrawColor(...GOLD);
  pdf.setLineWidth(0.6);
  pdf.line(14, 35, 196, 35);

  // === EMPLOYEE INFO BLOCK ===
  pdf.setTextColor(60, 60, 60);
  pdf.setFontSize(9);
  pdf.text("KARYAWAN", 14, 46);
  pdf.setFontSize(15);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...PRIMARY);
  pdf.text(employee.name, 14, 54);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(80, 80, 80);
  if (employee.position) pdf.text(employee.position, 14, 60);

  // Right-side employee details
  let yRight = 46;
  const rightX = 130;
  pdf.setFontSize(8);
  pdf.setTextColor(120, 120, 120);
  if (employee.email) { pdf.text(`Email: ${employee.email}`, rightX, yRight); yRight += 4; }
  if (employee.phone) { pdf.text(`HP: ${employee.phone}`, rightX, yRight); yRight += 4; }
  if (employee.bank_account) { pdf.text(`Rekening: ${employee.bank_account}`, rightX, yRight); yRight += 4; }
  if (settings) {
    const eff = getEffectiveWorkHours(employee, settings);
    if (eff.start && eff.end) { pdf.text(`Jam kerja: ${eff.start} - ${eff.end}`, rightX, yRight); }
  }

  // === SUMMARY STATS (4 boxes) ===
  let presentCount = 0;
  let lateCount = 0;
  let earlyLeaveCount = 0;
  let totalMins = 0;
  for (const r of records) {
    if (r.clock_in) presentCount++;
    if (r.status === "late") lateCount++;
    if (r.status === "early_leave") earlyLeaveCount++;
    if (r.clock_in && r.clock_out) {
      totalMins += minutesBetween(r.clock_in, r.clock_out);
    }
  }
  const totalHours = Math.round((totalMins / 60) * 10) / 10;

  const stats = [
    { label: "HADIR", value: `${presentCount} hari`, color: [22, 163, 74] as [number, number, number] },
    { label: "TERLAMBAT", value: `${lateCount}x`, color: [220, 38, 38] as [number, number, number] },
    { label: "PULANG AWAL", value: `${earlyLeaveCount}x`, color: [217, 119, 6] as [number, number, number] },
    { label: "TOTAL JAM", value: formatDuration(totalMins), color: [37, 99, 235] as [number, number, number] },
  ];
  let statY = 78;
  const statW = 44;
  const statGap = 2;
  stats.forEach((s, i) => {
    const x = 14 + i * (statW + statGap);
    pdf.setFillColor(248, 248, 248);
    pdf.roundedRect(x, statY, statW, 22, 2, 2, "F");
    pdf.setDrawColor(...s.color);
    pdf.setLineWidth(0.8);
    pdf.line(x, statY, x + statW, statY); // top accent
    pdf.setFontSize(7);
    pdf.setTextColor(110, 110, 110);
    pdf.text(s.label, x + 3, statY + 6);
    pdf.setFontSize(13);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...s.color);
    pdf.text(s.value, x + 3, statY + 16);
    pdf.setFont("helvetica", "normal");
  });
  pdf.setLineWidth(0.1);

  // === SECTION: ATTENDANCE LOG ===
  let cursorY = 110;
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...PRIMARY);
  pdf.text("Log Absensi Harian", 14, cursorY);
  cursorY += 4;

  const attData = records
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => {
      const dur = r.clock_in && r.clock_out ? formatDuration(minutesBetween(r.clock_in, r.clock_out)) : "-";
      const status = {
        present: "Hadir",
        late: "Terlambat",
        early_leave: "Pulang Awal",
        absent: "Absen",
      }[r.status] || r.status;
      return [
        format(new Date(r.date), "dd MMM (EEE)", { locale: idLocale }),
        r.clock_in ? format(new Date(r.clock_in), "HH:mm") : "-",
        r.clock_out ? format(new Date(r.clock_out), "HH:mm") : "-",
        dur,
        status,
        r.notes || "-",
      ];
    });

  if (attData.length > 0) {
    autoTable(pdf, {
      startY: cursorY,
      head: [["Tanggal", "Clock In", "Clock Out", "Durasi", "Status", "Catatan"]],
      body: attData,
      theme: "grid",
      headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 7.5, cellPadding: 1.8 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 18, halign: "center" },
        2: { cellWidth: 18, halign: "center" },
        3: { cellWidth: 20, halign: "center" },
        4: { cellWidth: 24, halign: "center" },
        5: { cellWidth: "auto" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 4) {
          const v = data.cell.raw as string;
          if (v === "Terlambat") data.cell.styles.textColor = [220, 38, 38];
          else if (v === "Pulang Awal") data.cell.styles.textColor = [217, 119, 6];
          else if (v === "Hadir") data.cell.styles.textColor = [22, 163, 74];
        }
      },
    });
    cursorY = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  } else {
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text("Belum ada data absensi.", 14, cursorY + 6);
    cursorY += 14;
  }

  // === SECTION: LEAVES ===
  if (cursorY > 240) { pdf.addPage(); cursorY = 18; }
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...PRIMARY);
  pdf.text("Riwayat Izin / Cuti / Sakit", 14, cursorY);
  cursorY += 4;

  if (leaves.length > 0) {
    autoTable(pdf, {
      startY: cursorY,
      head: [["Periode", "Jenis", "Status", "Alasan"]],
      body: leaves.map((l) => {
        const period = l.start_date === l.end_date
          ? format(new Date(l.start_date), "dd MMM yyyy", { locale: idLocale })
          : `${format(new Date(l.start_date), "dd MMM", { locale: idLocale })} - ${format(new Date(l.end_date), "dd MMM yyyy", { locale: idLocale })}`;
        const statusLabel = { pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak" }[l.status] || l.status;
        return [period, l.leave_type.toUpperCase(), statusLabel, l.reason];
      }),
      theme: "grid",
      headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 7.5, cellPadding: 1.8 },
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 22, halign: "center" },
        2: { cellWidth: 26, halign: "center" },
        3: { cellWidth: "auto" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          const v = data.cell.raw as string;
          if (v === "Disetujui") data.cell.styles.textColor = [22, 163, 74];
          else if (v === "Ditolak") data.cell.styles.textColor = [220, 38, 38];
          else if (v === "Menunggu") data.cell.styles.textColor = [217, 119, 6];
        }
      },
    });
    cursorY = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  } else {
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text("Tidak ada pengajuan izin/cuti pada periode ini.", 14, cursorY + 6);
    cursorY += 14;
  }

  // === SECTION: REIMBURSEMENTS ===
  if (cursorY > 240) { pdf.addPage(); cursorY = 18; }
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...PRIMARY);
  pdf.text("Riwayat Reimbursement", 14, cursorY);
  cursorY += 4;

  if (reimbursements.length > 0) {
    let totalApproved = 0;
    autoTable(pdf, {
      startY: cursorY,
      head: [["Tanggal", "Kategori", "Jumlah", "Status", "Keterangan"]],
      body: reimbursements.map((r) => {
        if (r.status === "approved") totalApproved += r.amount;
        const statusLabel = { pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak" }[r.status] || r.status;
        return [
          format(new Date(r.transaction_date), "dd MMM yyyy", { locale: idLocale }),
          r.category,
          `Rp ${r.amount.toLocaleString("id-ID")}`,
          statusLabel,
          r.description || "-",
        ];
      }),
      theme: "grid",
      headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 7.5, cellPadding: 1.8 },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 22, halign: "center" },
        2: { cellWidth: 26, halign: "right" },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: "auto" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const v = data.cell.raw as string;
          if (v === "Disetujui") data.cell.styles.textColor = [22, 163, 74];
          else if (v === "Ditolak") data.cell.styles.textColor = [220, 38, 38];
          else if (v === "Menunggu") data.cell.styles.textColor = [217, 119, 6];
        }
      },
    });
    cursorY = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

    // Total approved row
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...PRIMARY);
    pdf.text(`Total disetujui: Rp ${totalApproved.toLocaleString("id-ID")}`, 196, cursorY + 4, { align: "right" });
    cursorY += 8;
  } else {
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text("Tidak ada pengajuan reimbursement pada periode ini.", 14, cursorY + 6);
    cursorY += 10;
  }

  // === FOOTER ON ALL PAGES ===
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `RedWine Shoes & Bags · Laporan ${employee.name} · ${monthLabel} · Halaman ${i}/${pageCount}`,
      105,
      290,
      { align: "center" }
    );
  }

  const safeName = employee.name.replace(/[^a-zA-Z0-9]/g, "_");
  pdf.save(`Laporan_${safeName}_${month}.pdf`);
}
