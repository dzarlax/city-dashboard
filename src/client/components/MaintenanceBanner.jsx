import React from 'react';
import { AlertTriangle } from 'lucide-react';

const messages = [
  {
    lang: 'EN',
    title: 'Service temporarily unavailable',
    body: 'Due to an update in the Belgrade city transit system, real-time data for Belgrade is currently unavailable. We are working to restore the service.',
  },
  {
    lang: 'RU',
    title: 'Сервис временно недоступен',
    body: 'В связи с обновлением городской системы Белграда данные о транспорте в реальном времени для Белграда временно недоступны. Мы работаем над восстановлением сервиса.',
  },
  {
    lang: 'SR',
    title: 'Servis privremeno nije dostupan',
    body: 'Zbog ažuriranja gradskog sistema Beograda, podaci o prevozu u realnom vremenu za Beograd trenutno nisu dostupni. Radimo na uspostavljanju servisa.',
  },
];

export default function MaintenanceBanner() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">

        {/* Top accent bar */}
        <div className="h-1.5 bg-amber-400" />

        <div className="px-6 py-8 sm:px-8">
          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-amber-500 dark:text-amber-400" />
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-5">
            {messages.map(({ lang, title, body }) => (
              <div key={lang} className="text-center">
                <span className="inline-block text-xs font-bold tracking-widest text-amber-500 dark:text-amber-400 mb-1 uppercase">
                  {lang}
                </span>
                <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {title}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
