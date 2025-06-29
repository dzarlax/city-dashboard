import React, { useMemo } from 'react';
import { Bus, Clock, MapPin, Zap, ArrowRight } from 'lucide-react';
import { useLocalization } from '../utils/LocalizationContext';

// Utility functions
const formatMinutes = (seconds, t) => {
  const minutes = Math.ceil(seconds / 60);
  return `${minutes}${t('minutes')}`;
};

const isVehicleChanged = (oldVehicle, newVehicle) => {
  return oldVehicle.secondsLeft !== newVehicle.secondsLeft ||
         oldVehicle.stationsBetween !== newVehicle.stationsBetween;
};

const BusStation = React.memo(({ name, distance, stopId, vehicles = [], city }) => {
  const { t } = useLocalization();
  
  const groupedVehicles = useMemo(() => {
    return vehicles.reduce((acc, vehicle) => {
      const directionKey = `${stopId}-${vehicle.lineNumber}-${vehicle.lineName || 'unknown'}-${vehicle.stationName || ''}`;
      if (!acc[directionKey]) {
        acc[directionKey] = {
          lineNumber: vehicle.lineNumber,
          lineName: vehicle.lineName,
          stationName: vehicle.stationName,
          arrivals: [],
        };
      }
      acc[directionKey].arrivals.push({
        secondsLeft: vehicle.secondsLeft,
        stationsBetween: vehicle.stationsBetween,
        garageNo: vehicle.garageNo,
      });
      return acc;
    }, {});
  }, [vehicles, stopId]);

  const sortedGroups = useMemo(() => 
    Object.values(groupedVehicles).sort(
      (a, b) => parseInt(a.lineNumber) - parseInt(b.lineNumber)
    ),
    [groupedVehicles]
  );

  const cityColors = {
    'BG': 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800 border-emerald-200 dark:from-emerald-900/50 dark:to-green-900/50 dark:text-emerald-200 dark:border-emerald-700',
    'NS': 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-800 border-blue-200 dark:from-blue-900/50 dark:to-cyan-900/50 dark:text-blue-200 dark:border-blue-700',
    'NIS': 'bg-gradient-to-r from-purple-100 to-violet-100 text-purple-800 border-purple-200 dark:from-purple-900/50 dark:to-violet-900/50 dark:text-purple-200 dark:border-purple-700'
  };

  const hasUpcomingArrivals = sortedGroups.some(group => 
    group.arrivals.some(arrival => arrival.secondsLeft < 300) // Less than 5 minutes
  );

  return (
    <div className="group relative bg-gradient-to-br from-white via-white to-gray-50/50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-900/50 border border-gray-200/60 dark:border-gray-700/60 rounded-xl shadow-sm hover:shadow-lg dark:hover:shadow-xl transition-all duration-300 overflow-hidden animate-fade-in">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50/15 via-transparent to-blue-50/15 dark:from-primary-900/5 dark:via-transparent dark:to-blue-900/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      {/* Active indicator for upcoming arrivals */}
      {hasUpcomingArrivals && (
        <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-pulse shadow-sm"></div>
      )}

      <div className="relative p-3 sm:p-4">
        {/* Compact Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center space-x-2.5">
            <div className="relative bg-gradient-to-br from-primary-100 via-primary-50 to-primary-100 dark:from-primary-800 dark:via-primary-900 dark:to-primary-800 p-2 rounded-lg group-hover:scale-105 transition-all duration-200 shadow-sm">
              <Bus className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight mb-1 group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors duration-200">
                {name}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  #{stopId}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${cityColors[city] || 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 border-gray-300 dark:from-gray-700 dark:to-gray-600 dark:text-gray-200 dark:border-gray-500'}`}>
                  {city}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs bg-gray-100/60 dark:bg-gray-700/40 px-2 py-1 rounded-md">
            <MapPin className="w-3 h-3" />
            <span className="font-medium">{distance}</span>
          </div>
        </div>

        {/* Compact Routes */}
        {sortedGroups.length > 0 ? (
          <div className="space-y-2.5 border-t border-gray-100/60 dark:border-gray-700/40 pt-2.5">
            {sortedGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="space-y-2">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-sm flex-shrink-0">
                      {group.lineNumber}
                    </span>
                    {group.lineName && (
                      <div className="text-xs text-gray-700 dark:text-gray-300 flex-1">
                        {group.lineName.includes(' - ') ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {group.lineName.split(' - ').map((part, index, array) => (
                              <span key={index}>
                                {index === array.length - 1 ? (
                                  <span className="font-bold text-black dark:text-white">{part}</span>
                                ) : (
                                  <span>{part}</span>
                                )}
                                {index < array.length - 1 && (
                                  <span className="text-blue-600 dark:text-blue-400 font-bold text-sm mx-1">→</span>
                                )}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="font-bold text-black dark:text-white">{group.lineName}</span>
                        )}
                      </div>
                    )}
                  </div>
                  {group.stationName && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded border-l-4 border-blue-500">
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">→</span>
                        <div className="text-gray-700 dark:text-gray-300">
                          {group.stationName.includes(' - ') ? (
                            <>
                              {group.stationName.split(' - ').map((part, index, array) => (
                                <span key={index}>
                                  {index === array.length - 1 ? (
                                    <span className="font-bold text-black dark:text-white">{part}</span>
                                  ) : (
                                    <span>{part}</span>
                                  )}
                                  {index < array.length - 1 && <span className="text-gray-500"> - </span>}
                                </span>
                              ))}
                            </>
                          ) : (
                            <span className="font-bold text-black dark:text-white">{group.stationName}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <div className="flex flex-wrap gap-1">
                    {group.arrivals
                      .sort((a, b) => a.secondsLeft - b.secondsLeft)
                      .slice(0, 5) // Show max 5 arrivals for better info density
                      .map((arrival, arrivalIndex) => {
                        const isNow = arrival.secondsLeft < 120; // Less than 2 minutes
                        const isUpcoming = arrival.secondsLeft < 300; // Less than 5 minutes
                        return (
                          <span 
                            key={arrivalIndex} 
                            className={
                              isNow 
                                ? 'inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-bold whitespace-nowrap bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm animate-pulse' 
                                : isUpcoming
                                ? 'inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium whitespace-nowrap bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200 dark:from-green-900/50 dark:to-emerald-900/50 dark:text-green-200 dark:border-green-700'
                                : 'inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium whitespace-nowrap bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                            }
                          >
                            {isNow && <Zap className="w-2.5 h-2.5 mr-0.5" />}
                            {formatMinutes(arrival.secondsLeft, t)}
                            {arrival.stationsBetween > 0 && (
                              <span className="ml-1 opacity-75 text-[10px]">({arrival.stationsBetween})</span>
                            )}
                          </span>
                        );
                      })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-3 border-t border-gray-100/60 dark:border-gray-700/40">
            <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500 mx-auto mb-1" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('noArrivalsScheduled')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  if (prevProps.vehicles.length !== nextProps.vehicles.length) return false;
  return prevProps.vehicles.every((vehicle, index) => {
    const nextVehicle = nextProps.vehicles[index];
    return !isVehicleChanged(vehicle, nextVehicle);
  });
});

export default BusStation; 