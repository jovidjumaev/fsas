'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useStudentAttendance } from '@/hooks/use-student-data-swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle, XCircle, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { memo } from 'react';

// Status badge component
const StatusBadge = memo(({ status }: { status: string }) => {
  const statusConfig = {
    present: { label: 'Present', variant: 'success' as const, icon: CheckCircle },
    absent: { label: 'Absent', variant: 'destructive' as const, icon: XCircle },
    late: { label: 'Late', variant: 'warning' as const, icon: Clock },
    excused: { label: 'Excused', variant: 'secondary' as const, icon: AlertCircle }
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.absent;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
});

StatusBadge.displayName = 'StatusBadge';

// Attendance card component
const AttendanceCard = memo(({ classData }: any) => {
  const presentCount = classData.records.filter((r: any) => r.status === 'present').length;
  const totalCount = classData.records.length;
  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  return (
    <Card className="hover:shadow-lg transition-all duration-200">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
              {classData.classCode}
            </CardTitle>
            <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
              {classData.className}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {attendanceRate}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {presentCount}/{totalCount} classes
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Attendance Rate</span>
            <div className="flex items-center gap-1">
              {attendanceRate >= 80 ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-yellow-500" />
              )}
              <span className={attendanceRate >= 80 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}>
                {attendanceRate >= 80 ? 'Good' : 'Needs Improvement'}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Recent Attendance
            </p>
            <div className="space-y-2">
              {classData.records.slice(0, 3).map((record: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    {new Date(record.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                  <StatusBadge status={record.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

AttendanceCard.displayName = 'AttendanceCard';

// Loading skeleton
const AttendanceSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {[1, 2, 3, 4, 5, 6].map(i => (
      <Card key={i} className="animate-pulse">
        <CardHeader>
          <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
          <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="space-y-2 pt-3">
            {[1, 2, 3].map(j => (
              <div key={j} className="flex justify-between">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

export default function OptimizedStudentAttendancePage() {
  const { user, userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const { attendance, isLoading, error, refresh } = useStudentAttendance(user?.id);
  const [filter, setFilter] = useState<'all' | 'present' | 'absent' | 'late' | 'excused'>('all');

  useEffect(() => {
    if (!authLoading && (!user || userRole !== 'student')) {
      router.push('/student/login');
    }
  }, [user, userRole, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-300 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || userRole !== 'student') {
    return null;
  }

  // Calculate overall stats
  const allRecords = attendance.flatMap(c => c.records);
  const overallStats = {
    total: allRecords.length,
    present: allRecords.filter(r => r.status === 'present').length,
    absent: allRecords.filter(r => r.status === 'absent').length,
    late: allRecords.filter(r => r.status === 'late').length,
    excused: allRecords.filter(r => r.status === 'excused').length
  };
  const overallRate = overallStats.total > 0
    ? Math.round(((overallStats.present + overallStats.late) / overallStats.total) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Attendance Records
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Track your attendance across all classes
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/student/dashboard">
                <Button variant="outline">
                  Back to Dashboard
                </Button>
              </Link>
              <Button onClick={() => refresh()} variant="outline">
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      {!isLoading && attendance.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {overallRate}%
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Overall Rate</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {overallStats.present}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Present</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {overallStats.absent}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Absent</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {overallStats.late}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Late</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                    {overallStats.excused}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Excused</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading && !attendance.length ? (
          <AttendanceSkeleton />
        ) : error ? (
          <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
            <CardContent className="p-6">
              <p className="text-red-600 dark:text-red-400">
                Error loading attendance records. Please try again later.
              </p>
              <Button onClick={() => refresh()} className="mt-4" variant="outline">
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : attendance.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Attendance Records
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                You don't have any attendance records yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {attendance.map((classData, idx) => (
              <AttendanceCard key={idx} classData={classData} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}