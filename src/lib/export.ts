/**
 * Export Utilities
 * Generate PDF, Excel, and CSV exports for reports
 */

// ==========================================
// CSV EXPORT
// ==========================================

export interface CSVColumn {
  key: string;
  header: string;
  format?: (value: any) => string;
}

export function generateCSV(data: any[], columns: CSVColumn[]): string {
  const headers = columns.map(col => col.header).join(',');
  
  const rows = data.map(row => {
    return columns.map(col => {
      const value = row[col.key];
      const formatted = col.format ? col.format(value) : value;
      // Escape commas and quotes
      if (typeof formatted === 'string' && (formatted.includes(',') || formatted.includes('"'))) {
        return `"${formatted.replace(/"/g, '""')}"`;
      }
      return formatted ?? '';
    }).join(',');
  });
  
  return [headers, ...rows].join('\n');
}

export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

// ==========================================
// EXCEL EXPORT (Simple HTML table format)
// ==========================================

export function generateExcel(data: any[], columns: CSVColumn[], title: string): string {
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head>
      <meta charset="utf-8">
      <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #10b981; color: white; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
        .date { font-size: 12px; color: #666; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="title">${escapeHtml(title)}</div>
      <div class="date">Generated: ${new Date().toLocaleString()}</div>
      <table>
        <thead>
          <tr>
            ${columns.map(col => `<th>${escapeHtml(col.header)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              ${columns.map(col => {
                const value = row[col.key];
                const formatted = col.format ? col.format(value) : value;
                return `<td>${escapeHtml(String(formatted ?? ''))}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
  
  return html;
}

export function downloadExcel(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8' });
  downloadBlob(blob, filename);
}

// ==========================================
// PDF EXPORT (Simple HTML to PDF)
// ==========================================

export function generatePDFHtml(data: any[], columns: CSVColumn[], title: string, options: {
  subtitle?: string;
  company?: string;
  orientation?: 'portrait' | 'landscape';
} = {}): string {
  const { subtitle, company, orientation = 'portrait' } = options;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(title)}</title>
      <style>
        @page {
          size: A4 ${orientation};
          margin: 20mm;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #333; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #10b981; padding-bottom: 15px; }
        .company { font-size: 14px; color: #666; margin-bottom: 5px; }
        .title { font-size: 24px; font-weight: bold; color: #1a1a1a; }
        .subtitle { font-size: 14px; color: #666; margin-top: 5px; }
        .date { font-size: 10px; color: #999; margin-top: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #e5e5e5; padding: 10px 8px; text-align: left; }
        th { background-color: #10b981; color: white; font-weight: 600; font-size: 11px; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        tr:hover { background-color: #f0f0f0; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 15px; }
        .summary { margin-top: 20px; background: #f5f5f5; padding: 15px; border-radius: 8px; }
        .summary-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .summary-label { font-weight: 600; }
        .status-present { color: #10b981; font-weight: 600; }
        .status-late { color: #f59e0b; font-weight: 600; }
        .status-absent { color: #ef4444; font-weight: 600; }
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        ${company ? `<div class="company">${escapeHtml(company)}</div>` : ''}
        <div class="title">${escapeHtml(title)}</div>
        ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ''}
        <div class="date">Generated on: ${new Date().toLocaleString()}</div>
      </div>
      
      <table>
        <thead>
          <tr>
            ${columns.map(col => `<th>${escapeHtml(col.header)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              ${columns.map(col => {
                const value = row[col.key];
                const formatted = col.format ? col.format(value) : value;
                let className = '';
                if (col.key === 'status') {
                  className = `status-${String(formatted).toLowerCase()}`;
                }
                return `<td class="${className}">${escapeHtml(String(formatted ?? ''))}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="footer">
        <p>This report was automatically generated by AttendanceHub</p>
        <p>Page 1 of 1</p>
      </div>
    </body>
    </html>
  `;
}

export function downloadPDF(html: string, filename: string): void {
  // Open print dialog for PDF generation
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}

// ==========================================
// ATTENDANCE REPORT EXPORTS
// ==========================================

export const attendanceColumns: CSVColumn[] = [
  { key: 'employeeCode', header: 'Employee ID' },
  { key: 'firstName', header: 'First Name' },
  { key: 'lastName', header: 'Last Name' },
  { key: 'branchName', header: 'Branch' },
  { key: 'date', header: 'Date', format: (v) => v ? new Date(v).toLocaleDateString() : '' },
  { key: 'checkInTime', header: 'Check In', format: (v) => v ? new Date(v).toLocaleTimeString() : '-' },
  { key: 'checkOutTime', header: 'Check Out', format: (v) => v ? new Date(v).toLocaleTimeString() : '-' },
  { key: 'totalHours', header: 'Hours', format: (v) => v ? v.toFixed(2) : '0.00' },
  { key: 'status', header: 'Status', format: (v) => v?.toUpperCase() },
  { key: 'lateMinutes', header: 'Late (min)' },
];

export function exportAttendanceReport(
  records: any[],
  format: 'csv' | 'excel' | 'pdf',
  title: string = 'Attendance Report',
  company?: string
): void {
  // Flatten data
  const data = records.map(r => ({
    employeeCode: r.employee?.employeeCode || '',
    firstName: r.employee?.firstName || '',
    lastName: r.employee?.lastName || '',
    branchName: r.branch?.name || '',
    date: r.date,
    checkInTime: r.checkInTime,
    checkOutTime: r.checkOutTime,
    totalHours: r.totalHours,
    status: r.status,
    lateMinutes: r.lateMinutes,
  }));
  
  const filename = `attendance_${new Date().toISOString().split('T')[0]}`;
  
  switch (format) {
    case 'csv':
      downloadCSV(generateCSV(data, attendanceColumns), `${filename}.csv`);
      break;
    case 'excel':
      downloadExcel(generateExcel(data, attendanceColumns, title), `${filename}.xls`);
      break;
    case 'pdf':
      downloadPDF(generatePDFHtml(data, attendanceColumns, title, { company }), filename);
      break;
  }
}

// ==========================================
// PAYROLL REPORT EXPORTS
// ==========================================

export const payrollColumns: CSVColumn[] = [
  { key: 'employeeCode', header: 'Employee ID' },
  { key: 'name', header: 'Employee Name' },
  { key: 'workingDays', header: 'Working Days' },
  { key: 'presentDays', header: 'Present Days' },
  { key: 'absentDays', header: 'Absent Days' },
  { key: 'lateDays', header: 'Late Days' },
  { key: 'totalHours', header: 'Total Hours', format: (v) => v?.toFixed(2) || '0.00' },
  { key: 'overtimeHours', header: 'Overtime', format: (v) => v?.toFixed(2) || '0.00' },
  { key: 'baseSalary', header: 'Base Salary', format: (v) => `$${(v || 0).toFixed(2)}` },
  { key: 'overtimePay', header: 'Overtime Pay', format: (v) => `$${(v || 0).toFixed(2)}` },
  { key: 'deductions', header: 'Deductions', format: (v) => `$${(v || 0).toFixed(2)}` },
  { key: 'netPay', header: 'Net Pay', format: (v) => `$${(v || 0).toFixed(2)}` },
];

export function exportPayrollReport(
  records: any[],
  format: 'csv' | 'excel' | 'pdf',
  title: string = 'Payroll Report',
  company?: string
): void {
  const data = records.map(r => ({
    employeeCode: r.employee?.employeeCode || '',
    name: `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`,
    workingDays: r.workingDays,
    presentDays: r.presentDays,
    absentDays: r.absentDays,
    lateDays: r.lateDays,
    totalHours: r.totalHours,
    overtimeHours: r.overtimeHours,
    baseSalary: r.baseSalary,
    overtimePay: r.overtimePay,
    deductions: (r.lateDeductions || 0) + (r.absenceDeductions || 0) + (r.otherDeductions || 0),
    netPay: r.netPay,
  }));
  
  const filename = `payroll_${new Date().toISOString().split('T')[0]}`;
  
  switch (format) {
    case 'csv':
      downloadCSV(generateCSV(data, payrollColumns), `${filename}.csv`);
      break;
    case 'excel':
      downloadExcel(generateExcel(data, payrollColumns, title), `${filename}.xls`);
      break;
    case 'pdf':
      downloadPDF(generatePDFHtml(data, payrollColumns, title, { company }), filename);
      break;
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeHtml(str: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return str.replace(/[&<>"']/g, char => htmlEntities[char]);
}

// Format helpers
export const formatCurrency = (value: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
};

export const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatTime = (date: string | Date): string => {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDateTime = (date: string | Date): string => {
  return `${formatDate(date)} ${formatTime(date)}`;
};

export const formatHours = (hours: number): string => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
};
