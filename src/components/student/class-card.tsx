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
}

interface ClassCardProps {
  classData: ClassData;
}

export const ClassCard = React.memo<ClassCardProps>(({ classData }) => {
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

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all duration-200 overflow-hidden">
      {/* Class Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">
              {classData.class_code || 'N/A'}
            </h3>
            <p className="text-blue-100 text-sm font-medium">
              {classData.class_name || 'Unknown Class'}
            </p>
          </div>
          {classData.credits && (
            <div className="bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg">
              <p className="text-xs text-white font-semibold">{classData.credits} Credits</p>
            </div>
          )}
        </div>
      </div>

      {/* Class Body */}
      <div className="p-4 space-y-3">
        {/* Schedule Info */}
        {classData.schedule && (
          <div className="flex items-start gap-2 text-sm">
            <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" />
            <span className="text-slate-700 dark:text-slate-300 font-medium">{classData.schedule}</span>
          </div>
        )}

        {/* Room */}
        {classData.room && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" />
            <span className="text-slate-700 dark:text-slate-300">{classData.room}</span>
          </div>
        )}

        {/* Professor */}
        {classData.professor && (
          <div className="flex items-start gap-2 text-sm">
            <User className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" />
            <span className="text-slate-700 dark:text-slate-300">{classData.professor}</span>
          </div>
        )}

        {/* Academic Period */}
        {classData.academic_period && (
          <div className="flex items-start gap-2 text-sm">
            <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" />
            <span className="text-slate-600 dark:text-slate-400 text-xs">{classData.academic_period}</span>
          </div>
        )}

        {/* Attendance Stats */}
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-600">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Attendance</span>
            <span className={`text-lg font-bold ${getAttendanceColor(classData.attendance_rate || 0)}`}>
              {classData.attendance_rate || 0}%
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span>{classData.attended_sessions || 0} / {classData.total_sessions || 0} sessions</span>
            <span>{classData.current_enrollment || 0} / {classData.max_students || 0} students</span>
          </div>
        </div>

        {/* Action Button */}
        <Link href="/student/scan" className="block mt-4">
          <Button className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all duration-200">
            <QrCode className="w-4 h-4 mr-2" />
            Scan QR Code
          </Button>
        </Link>
      </div>
    </div>
  );
});

ClassCard.displayName = 'ClassCard';
