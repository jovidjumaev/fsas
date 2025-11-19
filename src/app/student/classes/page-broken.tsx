'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useStudentClasses } from '@/hooks/use-student-data-swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, User, BookOpen, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { memo } from 'react';

// Memoized class card component
const ClassCard = memo(({ classItem, onClick }: any) => (
  <Card
    className="hover:shadow-lg transition-all duration-200 cursor-pointer border-gray-200 dark:border-gray-700"
    onClick={onClick}
  >
    <CardHeader className="pb-3">
      <div className="flex justify-between items-start">
        <div>
          <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
            {classItem.courseCode}
          </CardTitle>
          <CardDescription className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {classItem.courseName}
          </CardDescription>
        </div>
        <Badge variant="outline" className="text-xs">
          Active
        </Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <User className="w-4 h-4" />
        <span>{classItem.professor}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <Calendar className="w-4 h-4" />
        <span>{classItem.schedule}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <Clock className="w-4 h-4" />
        <span>{classItem.time}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <MapPin className="w-4 h-4" />
        <span>{classItem.room}</span>
      </div>
      <div className="pt-3 flex justify-end">
        <Button variant="ghost" size="sm" className="gap-1">
          View Details
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </CardContent>
  </Card>
));

ClassCard.displayName = 'ClassCard';

// Loading skeleton component
const ClassesSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {[1, 2, 3, 4, 5, 6].map(i => (
      <Card key={i} className="animate-pulse">
        <CardHeader className="pb-3">
          <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
          <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map(j => (
            <div key={j} className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    ))}
  </div>
);

export default function OptimizedStudentClassesPage() {
  const { user, userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const { classes, isLoading, error, refresh } = useStudentClasses(user?.id);

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                My Classes
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                View and manage your enrolled courses
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading && !classes.length ? (
          <ClassesSkeleton />
        ) : error ? (
          <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
            <CardContent className="p-6">
              <p className="text-red-600 dark:text-red-400">
                Error loading classes. Please try again later.
              </p>
              <Button onClick={() => refresh()} className="mt-4" variant="outline">
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : classes.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <BookOpen className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Classes Enrolled
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                You haven't enrolled in any classes yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-6 flex justify-between items-center">
              <p className="text-gray-600 dark:text-gray-400">
                You are enrolled in <span className="font-semibold">{classes.length}</span> classes
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {classes.map((classItem) => (
                <ClassCard
                  key={classItem.id}
                  classItem={classItem}
                  onClick={() => router.push(`/student/classes/${classItem.id}`)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}