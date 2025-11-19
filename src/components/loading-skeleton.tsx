import React from 'react';

export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-200 via-gray-200 to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="animate-pulse p-8">
        {/* Header skeleton */}
        <div className="h-16 bg-gray-300 dark:bg-gray-700 rounded-lg mb-8"></div>

        {/* Content skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-32 bg-gray-300 dark:bg-gray-700 rounded-lg"></div>
          <div className="h-32 bg-gray-300 dark:bg-gray-700 rounded-lg"></div>
          <div className="h-32 bg-gray-300 dark:bg-gray-700 rounded-lg"></div>
        </div>

        {/* Table skeleton */}
        <div className="mt-8 space-y-3">
          <div className="h-12 bg-gray-300 dark:bg-gray-700 rounded"></div>
          <div className="h-12 bg-gray-300 dark:bg-gray-700 rounded"></div>
          <div className="h-12 bg-gray-300 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="h-8 w-48 bg-gray-300 dark:bg-gray-700 rounded"></div>
            <div className="flex space-x-4">
              <div className="h-10 w-10 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
              <div className="h-10 w-10 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Main content skeleton */}
        <div className="max-w-7xl mx-auto p-6">
          {/* Welcome section */}
          <div className="mb-8">
            <div className="h-8 w-64 bg-gray-300 dark:bg-gray-700 rounded mb-2"></div>
            <div className="h-4 w-96 bg-gray-200 dark:bg-gray-600 rounded"></div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <div className="h-4 w-24 bg-gray-300 dark:bg-gray-700 rounded mb-2"></div>
                <div className="h-8 w-16 bg-gray-400 dark:bg-gray-600 rounded"></div>
              </div>
            ))}
          </div>

          {/* Today's Classes */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <div className="h-6 w-40 bg-gray-300 dark:bg-gray-700 rounded mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="h-5 w-48 bg-gray-300 dark:bg-gray-700 rounded mb-2"></div>
                  <div className="h-4 w-32 bg-gray-200 dark:bg-gray-600 rounded"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Attendance */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="h-6 w-48 bg-gray-300 dark:bg-gray-700 rounded mb-4"></div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                  <div className="h-4 w-32 bg-gray-300 dark:bg-gray-700 rounded"></div>
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-600 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-200 via-gray-200 to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md animate-pulse">
        <div className="h-8 w-48 bg-gray-300 dark:bg-gray-700 rounded mb-6 mx-auto"></div>

        <div className="space-y-4">
          <div>
            <div className="h-4 w-20 bg-gray-300 dark:bg-gray-700 rounded mb-2"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-600 rounded"></div>
          </div>
          <div>
            <div className="h-4 w-24 bg-gray-300 dark:bg-gray-700 rounded mb-2"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-600 rounded"></div>
          </div>
          <div className="h-12 bg-blue-300 dark:bg-blue-700 rounded"></div>
        </div>
      </div>
    </div>
  );
}

export function ComponentSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-64 bg-gray-300 dark:bg-gray-700 rounded-lg"></div>
    </div>
  );
}