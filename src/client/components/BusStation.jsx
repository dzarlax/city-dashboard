import React, { useMemo } from 'react';
import { Bus, Clock, MapPin } from 'lucide-react';

// Utility functions
const formatMinutes = (seconds) => {
  const minutes = Math.ceil(seconds / 60);
  return `${minutes}min`;
};

const isVehicleChanged = (oldVehicle, newVehicle) => {
  return oldVehicle.secondsLeft !== newVehicle.secondsLeft ||
         oldVehicle.stationsBetween !== newVehicle.stationsBetween;
};

const BusStation = React.memo(({ name, distance, stopId, vehicles = [], city }) => {
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
    'BG': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'NS': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'NIS': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
  };

  return (
    <div className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md dark:hover:shadow-lg transition-all duration-300 overflow-hidden animate-fade-in">
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-start space-x-3">
            <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900 dark:to-primary-800 p-2.5 rounded-lg group-hover:scale-105 transition-transform duration-200">
              <Bus className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                {name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  #{stopId}
                </span>
                <span className={cityColors[city] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 text-xs px-2 py-0.5 rounded-full font-medium'}>
                  {city}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
            <MapPin className="w-3 h-3" />
            <span className="text-xs font-medium">{distance}</span>
          </div>
        </div>

        {/* Routes */}
        {sortedGroups.length > 0 ? (
          <div className="space-y-3 border-t border-gray-100 dark:border-gray-700 pt-3">
            {sortedGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
                      {group.lineNumber}
                    </span>
                    {group.lineName && (
                      <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                        {group.lineName}
                      </span>
                    )}
                  </div>
                  {group.stationName && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 max-w-[40%]">
                      <span className="truncate">→ {group.stationName}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-3 pl-1">
                  <Clock className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <div className="flex flex-wrap gap-2 text-sm">
                    {group.arrivals
                      .sort((a, b) => a.secondsLeft - b.secondsLeft)
                      .slice(0, 4) // Show max 4 arrivals
                      .map((arrival, arrivalIndex) => {
                        const isNow = arrival.secondsLeft < 120; // Less than 2 minutes
                        return (
                          <span 
                            key={arrivalIndex} 
                            className={
                              isNow 
                                ? 'inline-flex items-center px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap bg-warning-100 text-warning-800 dark:bg-warning-900 dark:text-warning-200 animate-pulse-subtle' 
                                : 'inline-flex items-center px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                            }
                          >
                            {formatMinutes(arrival.secondsLeft)}
                            {arrival.stationsBetween > 0 && (
                              <span className="ml-1 opacity-75">({arrival.stationsBetween})</span>
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
          <div className="text-center py-4 border-t border-gray-100 dark:border-gray-700">
            <Clock className="w-5 h-5 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No arrivals scheduled
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