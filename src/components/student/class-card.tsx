import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, User, QrCode, BarChart3, Calendar } from 'lucide-react';

interface ClassData {
  id: string;
  class_id?: string;
  class_code: string;
  class_name: string;
  description?: string;
  credits?: number;
  professor: string;
  professor_email?: string;
  room: string;
  schedule: string;
  department?: string;
  department_code?: string;
  academic_period?: string;
  enrollment_date?: string;
  attendance_rate: number;
  total_sessions?: number;
  attended_sessions?: number;
  max_students?: number;
  current_enrollment?: number;
  hasAttendanceToday?: boolean;
}

interface ClassCardProps {
  classData: ClassData;
  showAttendanceStatus?: boolean; // New prop to control attendance status display
  compact?: boolean; // New prop for compact dashboard mode
}

export const ClassCard = React.memo<ClassCardProps>(({ classData, showAttendanceStatus = false, compact = false }) => {
  // Safety check
  if (!classData) {
    return null;
  }

  const getAttendanceColor = (rate: number) => {
    if (rate >= 90) return 'text-emerald-600 dark:text-emerald-400';
    if (rate >= 80) return 'text-blue-600 dark:text-blue-400';
    if (rate >= 70) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  // Format schedule to be more professional
  const formatSchedule = (schedule: string): string => {
    if (!schedule) return 'TBD';
    
    // Handle different schedule formats
    if (schedule.includes('TuesdayThursday') || schedule.includes('Tue/Thu')) {
      return schedule.replace(/TuesdayThursday|Tue\/Thu/g, 'Tue/Thu');
    }
    if (schedule.includes('MondayWednesdayFriday') || schedule.includes('Mon/Wed/Fri')) {
      return schedule.replace(/MondayWednesdayFriday|Mon\/Wed\/Fri/g, 'Mon/Wed/Fri');
    }
    if (schedule.includes('MondayWednesday') || schedule.includes('Mon/Wed')) {
      return schedule.replace(/MondayWednesday|Mon\/Wed/g, 'Mon/Wed');
    }
    if (schedule.includes('TuesdayThursday') || schedule.includes('Tue/Thu')) {
      return schedule.replace(/TuesdayThursday|Tue\/Thu/g, 'Tue/Thu');
    }
    
    // Handle individual days
    const dayMappings: { [key: string]: string } = {
      'Monday': 'Mon',
      'Tuesday': 'Tue', 
      'Wednesday': 'Wed',
      'Thursday': 'Thu',
      'Friday': 'Fri',
      'Saturday': 'Sat',
      'Sunday': 'Sun'
    };
    
    let formattedSchedule = schedule;
    Object.entries(dayMappings).forEach(([full, short]) => {
      formattedSchedule = formattedSchedule.replace(new RegExp(full, 'g'), short);
    });
    
    return formattedSchedule;
  };

  // Check if attendance has been taken for today using real data
  const hasAttendanceToday = classData.hasAttendanceToday || false;
  
  // Compact version for dashboard
  if (compact) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all duration-200 p-3">
        {/* Compact Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {classData.class_code || 'N/A'}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
              {classData.class_name || 'Unknown Class'}
            </p>
          </div>

          {/* Attendance Status */}
          {showAttendanceStatus && (
            <div className="flex items-center gap-1 ml-2">
              {hasAttendanceToday ? (
                <div className="flex items-center gap-1 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-green-700 dark:text-green-300 font-medium">Taken</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-full">
                  <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                  <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">Pending</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Compact Info */}
        <div className="space-y-1">
          {/* Time */}
          {classData.schedule && (
            <div className="flex items-center gap-1.5 text-xs">
              <Clock className="w-3 h-3 text-slate-500 dark:text-slate-400 flex-shrink-0" />
              <span className="text-slate-600 dark:text-slate-400">{formatSchedule(classData.schedule)}</span>
            </div>
          )}

          {/* Room */}
          {classData.room && (
            <div className="flex items-center gap-1.5 text-xs">
              <MapPin className="w-3 h-3 text-slate-500 dark:text-slate-400 flex-shrink-0" />
              <span className="text-slate-600 dark:text-slate-400">{classData.room}</span>
            </div>
          )}

          {/* Professor */}
          {classData.professor && (
            <div className="flex items-center gap-1.5 text-xs">
              <User className="w-3 h-3 text-slate-500 dark:text-slate-400 flex-shrink-0" />
              <span className="text-slate-600 dark:text-slate-400 truncate">{classData.professor}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Full version for classes page
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-200 p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
            {classData.class_code || 'N/A'}
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
            {classData.class_name || 'Unknown Class'}
          </p>
        </div>
        
        {/* Attendance Status - Only show if explicitly requested */}
        {showAttendanceStatus && (
          <div className="flex items-center gap-1 ml-2">
            {hasAttendanceToday ? (
              <div className="flex items-center gap-1 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-green-700 dark:text-green-300 font-medium">Taken</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-full">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">Pending</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Class Info */}
      <div className="space-y-2">
        {/* Schedule */}
        {classData.schedule && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">
              {formatSchedule(classData.schedule)}
            </span>
          </div>
        )}

        {/* Room */}
        {classData.room && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
            <span className="text-slate-600 dark:text-slate-400">{classData.room}</span>
          </div>
        )}

        {/* Professor */}
        {classData.professor && (
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
            <span className="text-slate-600 dark:text-slate-400 truncate">{classData.professor}</span>
          </div>
        )}

        {/* Attendance Rate */}
        <div className="flex items-center gap-2 text-sm">
          <BarChart3 className="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
          <span className="text-slate-600 dark:text-slate-400">
            Attendance: <span className={`font-medium ${getAttendanceColor(classData.attendance_rate)}`}>
              {classData.attendance_rate}%
            </span>
          </span>
        </div>
      </div>

      {/* Action Button */}
      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
        <Link href={`/student/classes/${classData.id}`}>
          <Button variant="outline" size="sm" className="w-full hover:bg-slate-50 dark:hover:bg-slate-700">
            View Details
          </Button>
        </Link>
      </div>
    </div>
  );
});

ClassCard.displayName = 'ClassCard';