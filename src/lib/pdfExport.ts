import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Attendance, Employee, Settings } from "./types";
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
