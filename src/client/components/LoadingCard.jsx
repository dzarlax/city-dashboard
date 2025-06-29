import React from 'react';

const LoadingCard = () => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
    <div className="p-4 animate-pulse">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 bg-gray-300 dark:bg-gray-600 rounded"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
        </div>
        <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-12"></div>
      </div>
      <div className="space-y-2 border-t border-gray-100 dark:border-gray-700 pt-3">
        <div className="flex items-center gap-2">
          <div className="h-3 bg-primary-200 dark:bg-primary-800 rounded w-16"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-24"></div>
        </div>
        <div className="flex gap-2 pl-8">
          <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-12"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-16"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-14"></div>
        </div>
      </div>
    </div>
  </div>
);

const LoadingGrid = ({ count = 6 }) => (
  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: count }, (_, i) => (
      <LoadingCard key={i} />
    ))}
  </div>
);

export { LoadingCard, LoadingGrid }; 