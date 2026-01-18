import React, { useMemo, useState } from 'react';
import { Bus, Clock, MapPin, Zap, Star, ExternalLink, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { useLocalization } from '../utils/LocalizationContext';
import { formatMinutes, isVehicleChanged, getStationUrl, getLineUrl, getLineTooltip } from '../utils/helpers';
import { CITY_INFO, NOW_ARRIVAL_THRESHOLD, UPCOMING_ARRIVAL_THRESHOLD, MAX_ARRIVALS_PER_ROUTE } from '../utils/constants';

const BusStation = React.memo(({ name, distance, stopId, vehicles = [], city, isFavorite, onToggleFavorite }) => {
  const { t } = useLocalization();
  const [expandedRoutes, setExpandedRoutes] = useState({});

  // Toggle route details
  const toggleRouteDetails = (lineNumber) => {
    setExpandedRoutes(prev => ({
      ...prev,
      [lineNumber]: !prev[lineNumber]
    }));
  };

  // Generate station URL (only for Belgrade)
  const stationUrl = useMemo(() => getStationUrl(stopId, name, city), [stopId, name, city]);
  const hasStationUrl = stationUrl !== null;

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

  const hasUpcomingArrivals = sortedGroups.some(group =>
    group.arrivals.some(arrival => arrival.secondsLeft < UPCOMING_ARRIVAL_THRESHOLD)
  );

  return (
    <article
      className="group relative bg-gradient-to-br from-white via-white to-gray-50/50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-900/50 border border-gray-200/60 dark:border-gray-700/60 rounded-xl shadow-sm hover:shadow-lg dark:hover:shadow-xl transition-all duration-300 overflow-hidden animate-fade-in focus-within:ring-2 focus-within:ring-primary-500"
      tabIndex={0}
      aria-label={`Bus station ${name}, stop ID ${stopId}, ${distance} away`}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50/15 via-transparent to-blue-50/15 dark:from-primary-900/5 dark:via-transparent dark:to-blue-900/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      {/* Active indicator for upcoming arrivals */}
      {hasUpcomingArrivals && (
        <div className="absolute top-2 left-2 w-1.5 h-1.5 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-pulse shadow-sm"></div>
      )}

      <div className="relative p-3 sm:p-4 pr-12">
        {/* Compact Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center space-x-2.5">
            <div className="relative bg-gradient-to-br from-primary-100 via-primary-50 to-primary-100 dark:from-primary-800 dark:via-primary-900 dark:to-primary-800 p-2 rounded-lg group-hover:scale-105 transition-all duration-200 shadow-sm">
              <Bus className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="min-w-0 flex-1">
              {hasStationUrl ? (
                <a
                  href={stationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight mb-1 group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors duration-200 inline-flex items-center gap-1 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                  title={`View ${name} on BG Prevoz website`}
                >
                  {name}
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              ) : (
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight mb-1 group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors duration-200">
                  {name}
                </h3>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  #{stopId}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${CITY_INFO[city]?.gradient || 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 border-gray-300 dark:from-gray-700 dark:to-gray-600 dark:text-gray-200 dark:border-gray-500'}`}>
                  {city}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onToggleFavorite && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(stopId, city);
                }}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                aria-pressed={isFavorite}
              >
                <Star
                  className={`w-4 h-4 transition-colors duration-200 ${
                    isFavorite
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-gray-400 hover:text-amber-400'
                  }`}
                />
              </button>
            )}
            <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs bg-gray-100/60 dark:bg-gray-700/40 px-2 py-1 rounded-md">
              <MapPin className="w-3 h-3" />
              <span className="font-medium">{distance}</span>
            </div>
          </div>
        </div>

        {/* Compact Routes */}
        {sortedGroups.length > 0 ? (
          <div className="space-y-2.5 border-t border-gray-100/60 dark:border-gray-700/40 pt-2.5">
            {sortedGroups.map((group, groupIndex) => {
              const isExpanded = expandedRoutes[group.lineNumber];
              const lineTooltip = city === 'BG' ? getLineTooltip(group.lineNumber, city) : null;

              return (
                <div key={groupIndex} className="space-y-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      {/* Line number with expand/collapse */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleRouteDetails(group.lineNumber)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-sm hover:from-primary-600 hover:to-primary-700 transition-all duration-200"
                          aria-label={isExpanded ? `Hide details for line ${group.lineNumber}` : `Show details for line ${group.lineNumber}`}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                          {group.lineNumber}
                        </button>

                        {/* External link button for BG lines */}
                        {city === 'BG' && (
                          <a
                            href={getLineUrl(group.lineNumber, city)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center p-1 rounded-lg text-xs bg-blue-500 text-white shadow-sm hover:bg-blue-600 transition-all duration-200"
                            onClick={(e) => e.stopPropagation()}
                            title={`View line ${group.lineNumber} on BG Prevoz website`}
                            aria-label={`Open line ${group.lineNumber} on BG Prevoz website`}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

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

                    {/* Expanded route details */}
                    {isExpanded && lineTooltip && (
                      <div className="bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 px-3 py-2 rounded-lg border border-primary-200 dark:border-primary-700">
                        <div className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {lineTooltip}
                        </div>
                      </div>
                    )}

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
                      .slice(0, MAX_ARRIVALS_PER_ROUTE)
                      .map((arrival, arrivalIndex) => {
                        const isNow = arrival.secondsLeft < NOW_ARRIVAL_THRESHOLD;
                        const isUpcoming = arrival.secondsLeft < UPCOMING_ARRIVAL_THRESHOLD;
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
            );
          })}
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
    </article>
  );
}, (prevProps, nextProps) => {
  if (prevProps.vehicles.length !== nextProps.vehicles.length) return false;
  if (prevProps.isFavorite !== nextProps.isFavorite) return false;
  return prevProps.vehicles.every((vehicle, index) => {
    const nextVehicle = nextProps.vehicles[index];
    return !isVehicleChanged(vehicle, nextVehicle);
  });
});

export default BusStation; 