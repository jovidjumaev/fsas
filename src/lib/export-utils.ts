import * as XLSX from 'xlsx';
import { AttendanceRecord, AttendanceStats } from './student-attendance-service';

export interface ExportData {
  records: AttendanceRecord[];
  stats: AttendanceStats;
  studentName: string;
  exportDate: string;
}

export class ExportUtils {
  /**
   * Export attendance data to Excel format
   */
  static exportToExcel(data: ExportData): void {
    const workbook = XLSX.utils.book_new();
    
    // Create summary sheet
    const summaryData = [
      ['Student Attendance Report'],
      [''],
      ['Student Name:', data.studentName],
      ['Export Date:', data.exportDate],
      [''],
      ['Attendance Summary'],
      ['Total Classes:', data.stats.totalClasses],
      ['Present:', data.stats.present],
      ['Late:', data.stats.late],
      ['Absent:', data.stats.absent],
      ['Excused:', data.stats.excused],
      ['Attendance Rate:', `${data.stats.attendanceRate}%`],
      [''],
      ['Detailed Records']
    ];
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    
    // Create detailed records sheet
    const recordsData = [
      ['Class Code', 'Class Name', 'Professor', 'Date', 'Time', 'Room', 'Status', 'Scanned At', 'Minutes Late']
    ];
    
    data.records.forEach(record => {
      recordsData.push([
        record.class_code,
        record.class_name,
        record.professor,
        new Date(record.date).toLocaleDateString(),
        record.time,
        record.room,
        record.status.toUpperCase(),
        record.scanned_at ? new Date(record.scanned_at).toLocaleString() : 'N/A',
        record.minutes_late || 0
      ]);
    });
    
    const recordsSheet = XLSX.utils.aoa_to_sheet(recordsData);
    
    // Set column widths
    const colWidths = [
      { wch: 12 }, // Class Code
      { wch: 30 }, // Class Name
      { wch: 20 }, // Professor
      { wch: 12 }, // Date
      { wch: 15 }, // Time
      { wch: 10 }, // Room
      { wch: 10 }, // Status
      { wch: 20 }, // Scanned At
      { wch: 12 }  // Minutes Late
    ];
    recordsSheet['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(workbook, recordsSheet, 'Attendance Records');
    
    // Create class-wise statistics sheet
    const classStats = this.calculateClassStats(data.records);
    const classStatsData = [
      ['Class Code', 'Class Name', 'Total Sessions', 'Present', 'Late', 'Absent', 'Excused', 'Attendance Rate']
    ];
    
    Object.values(classStats).forEach(stats => {
      const attendanceRate = stats.total_sessions > 0 
        ? Math.round(((stats.present + stats.late + stats.excused) / stats.total_sessions) * 100)
        : 0;
      
      classStatsData.push([
        stats.class_code,
        stats.class_name,
        stats.total_sessions,
        stats.present,
        stats.late,
        stats.absent,
        stats.excused,
        `${attendanceRate}%`
      ]);
    });
    
    const classStatsSheet = XLSX.utils.aoa_to_sheet(classStatsData);
    classStatsSheet['!cols'] = [
      { wch: 12 }, // Class Code
      { wch: 30 }, // Class Name
      { wch: 15 }, // Total Sessions
      { wch: 10 }, // Present
      { wch: 10 }, // Late
      { wch: 10 }, // Absent
      { wch: 10 }, // Excused
      { wch: 15 }  // Attendance Rate
    ];
    
    XLSX.utils.book_append_sheet(workbook, classStatsSheet, 'Class Statistics');
    
    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `attendance-report-${data.studentName.replace(/\s+/g, '-')}-${timestamp}.xlsx`;
    
    // Download the file
    XLSX.writeFile(workbook, filename);
  }
  
  /**
   * Export attendance data to CSV format
   */
  static exportToCSV(data: ExportData): void {
    const csvData = [
      ['Student Attendance Report'],
      [''],
      ['Student Name:', data.studentName],
      ['Export Date:', data.exportDate],
      [''],
      ['Attendance Summary'],
      ['Total Classes:', data.stats.totalClasses],
      ['Present:', data.stats.present],
      ['Late:', data.stats.late],
      ['Absent:', data.stats.absent],
      ['Excused:', data.stats.excused],
      ['Attendance Rate:', `${data.stats.attendanceRate}%`],
      [''],
      ['Detailed Records'],
      ['Class Code', 'Class Name', 'Professor', 'Date', 'Time', 'Room', 'Status', 'Scanned At', 'Minutes Late']
    ];
    
    data.records.forEach(record => {
      csvData.push([
        record.class_code,
        record.class_name,
        record.professor,
        new Date(record.date).toLocaleDateString(),
        record.time,
        record.room,
        record.status.toUpperCase(),
        record.scanned_at ? new Date(record.scanned_at).toLocaleString() : 'N/A',
        record.minutes_late || 0
      ]);
    });
    
    // Convert to CSV string
    const csvString = csvData.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
    
    // Create and download file
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `attendance-report-${data.studentName.replace(/\s+/g, '-')}-${timestamp}.csv`;
    link.setAttribute('download', filename);
    
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  /**
   * Calculate class-wise statistics
   */
  private static calculateClassStats(records: AttendanceRecord[]): Record<string, {
    class_code: string;
    class_name: string;
    total_sessions: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
  }> {
    const classStats: Record<string, any> = {};
    
    records.forEach(record => {
      const classCode = record.class_code;
      
      if (!classStats[classCode]) {
        classStats[classCode] = {
          class_code: classCode,
          class_name: record.class_name,
          total_sessions: 0,
          present: 0,
          late: 0,
          absent: 0,
          excused: 0
        };
      }
      
      classStats[classCode].total_sessions++;
      classStats[classCode][record.status]++;
    });
    
    return classStats;
  }
}
