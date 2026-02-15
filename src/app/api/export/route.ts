import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  generateCSV,
  generateExcel,
  generatePDFHtml,
  downloadCSV,
  downloadExcel,
  downloadPDF,
  attendanceColumns,
  payrollColumns,
  exportAttendanceReport,
  exportPayrollReport,
} from '@/lib/export';

// GET /api/export - Export data
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'attendance';
    const format = searchParams.get('format') as 'csv' | 'excel' | 'pdf' || 'csv';
    const tenantId = searchParams.get('tenantId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const branchId = searchParams.get('branchId');
    
    if (!tenantId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    let data: any[] = [];
    let columns = attendanceColumns;
    let title = 'Attendance Report';
    
    if (type === 'attendance') {
      data = await db.attendance.findMany({
        where: {
          tenantId,
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
          ...(branchId ? { branchId } : {}),
        },
        include: {
          employee: true,
          branch: true,
        },
        orderBy: { date: 'desc' },
      });
      
      columns = attendanceColumns;
      title = `Attendance Report (${startDate} - ${endDate})`;
    } else if (type === 'payroll') {
      const periodId = searchParams.get('periodId');
      
      if (!periodId) {
        return NextResponse.json(
          { error: 'Payroll period ID is required' },
          { status: 400 }
        );
      }
      
      data = await db.payrollRecord.findMany({
        where: { payrollPeriodId: periodId },
        include: {
          employee: true,
        },
      });
      
      columns = payrollColumns;
      title = 'Payroll Report';
    } else if (type === 'employees') {
      data = await db.employee.findMany({
        where: {
          tenantId,
          status: 'active',
          ...(branchId ? { branchId } : {}),
        },
        include: {
          branch: true,
          department: true,
        },
      });
      
      columns = [
        { key: 'employeeCode', header: 'Employee ID' },
        { key: 'firstName', header: 'First Name' },
        { key: 'lastName', header: 'Last Name' },
        { key: 'email', header: 'Email' },
        { key: 'phone', header: 'Phone' },
        { key: 'branchName', header: 'Branch' },
        { key: 'position', header: 'Position' },
        { key: 'status', header: 'Status' },
      ];
      title = 'Employee List';
    }
    
    // Generate export based on format
    const filename = `${type}_${new Date().toISOString().split('T')[0]}`;
    
    if (format === 'csv') {
      const csv = generateCSV(data.map(d => ({
        ...d,
        branchName: d.branch?.name || '',
      })), columns);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv;charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      });
    } else if (format === 'excel') {
      const excel = generateExcel(data.map(d => ({
        ...d,
        branchName: d.branch?.name || '',
      })), columns, title);
      return new NextResponse(excel, {
        headers: {
          'Content-Type': 'application/vnd.ms-excel;charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.xls"`,
        },
      });
    } else if (format === 'pdf') {
      const pdf = generatePDFHtml(data.map(d => ({
        ...d,
        branchName: d.branch?.name || '',
      })), columns, title);
      return new NextResponse(pdf, {
        headers: {
          'Content-Type': 'text/html;charset=utf-8',
        },
      });
    }
    
    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
