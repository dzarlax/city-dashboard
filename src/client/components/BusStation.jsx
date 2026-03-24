import React, { useMemo, useState } from 'react';
import { Bus, TramFront, TrainFront, Moon, Zap, Star, ExternalLink, ChevronDown, ChevronRight, Clock, MapPin, CalendarClock } from 'lucide-react';
import { useLocalization } from '../utils/LocalizationContext';
import { formatMinutes, isVehicleChanged, getStationUrl, getLineUrl, getLineTooltip, getTransportType, TRANSPORT_CONFIG } from '../utils/helpers';
import { CITY_INFO, NOW_ARRIVAL_THRESHOLD, UPCOMING_ARRIVAL_THRESHOLD, MAX_ARRIVALS_PER_ROUTE } from '../utils/constants';
import ScheduleModal from './ScheduleModal';
import RouteMapSVG from './RouteMapSVG';

const TRANSPORT_ICON = {
  'трамвај':      TramFront,
  'БГ-воз':       TrainFront,
  'ноћне-линије': Moon,
  'тролејбус':    Zap,
  'E linije':     Zap,
  'аутобус':      Bus,
  'минибус':      Bus,
};

const BusStation = React.memo(({ name, distance, stopId, vehicles = [], city, isFavorite, onToggleFavorite }) => {
  const { t } = useLocalization();
  const [expandedRoutes, setExpandedRoutes] = useState({});
  const [scheduleModal, setScheduleModal] = useState(null); // { lineNumber, lineName, routeColor, routeTextColor }
  const [mapModal, setMapModal] = useState(null); // { lineNumber, lineName, routeColor }

  const toggleRouteDetails = (lineNumber) => {
    setExpandedRoutes(prev => ({
      ...prev,
      [lineNumber]: !prev[lineNumber]
    }));
  };

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
          routeColor: vehicle.routeColor || '',
          routeTextColor: vehicle.routeTextColor || '',
          fareAmount: vehicle.fareAmount || 0,
          firstDeparture: vehicle.firstDeparture || '',
          lastDeparture: vehicle.lastDeparture || '',
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

  const isScheduled = vehicles.length > 0 && vehicles.every(v => v.scheduled);

  return (
    <article
      className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden animate-fade-in focus-within:ring-2 focus-within:ring-primary-500"
      tabIndex={0}
      aria-label={`Bus station ${name}, stop ID ${stopId}, ${distance} away`}
    >
      {/* Active indicator dot — only for live data */}
      {hasUpcomingArrivals && !isScheduled && (
        <div className="absolute top-2 left-2 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
      )}

      <div className="p-3 sm:p-4 pr-12">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center space-x-2.5">
            <div className="bg-primary-100 dark:bg-primary-900/40 p-2 rounded-lg flex-shrink-0">
              <Bus className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="min-w-0 flex-1">
              {hasStationUrl ? (
                <a
                  href={stationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight mb-1 inline-flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                  title={`View ${name} on BG Prevoz website`}
                >
                  {name}
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </a>
              ) : (
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight mb-1">
                  {name}
                </h3>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                  #{stopId}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${CITY_INFO[city]?.badge || 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'}`}>
                  {city}
                </span>
                {isScheduled && (
                  <span
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700"
                    title={t('scheduledDataTitle')}
                  >
                    <CalendarClock className="w-3 h-3" />
                    {t('scheduledData')}
                  </span>
                )}
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
                    isFavorite ? 'fill-amber-400 text-amber-400' : 'text-gray-400 dark:text-gray-500 hover:text-amber-400'
                  }`}
                />
              </button>
            )}
            <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">
              <MapPin className="w-3 h-3" />
              <span className="font-medium">{distance}</span>
            </div>
          </div>
        </div>

        {/* Routes */}
        {sortedGroups.length > 0 ? (
          <div className="space-y-2.5 border-t border-gray-100 dark:border-gray-700 pt-2.5">
            {sortedGroups.map((group) => {
              const isExpanded = expandedRoutes[group.lineNumber];
              const lineTooltip = city === 'BG' ? getLineTooltip(group.lineNumber, city) : null;
              const transportType = getTransportType(group.lineNumber, city, group.lineName);

              // Use official GTFS color if available, fall back to transport config
              const hasOfficialColor = group.routeColor && group.routeColor.length === 6;
              const btnStyle = hasOfficialColor
                ? { backgroundColor: `#${group.routeColor}`, color: `#${group.routeTextColor || 'FFFFFF'}` }
                : {};
              const btnClass = hasOfficialColor
                ? 'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-colors duration-150'
                : `inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-colors duration-150 ${TRANSPORT_CONFIG[transportType]?.btnClass || TRANSPORT_CONFIG['аутобус'].btnClass}`;

              const TransportIcon = TRANSPORT_ICON[transportType] || Bus;

              return (
                <div key={`${group.lineNumber}-${group.lineName || 'unknown'}`} className="space-y-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleRouteDetails(group.lineNumber)}
                          className={btnClass}
                          style={btnStyle}
                          aria-label={isExpanded ? `Hide details for line ${group.lineNumber}` : `Show details for line ${group.lineNumber}`}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <TransportIcon className="w-3 h-3" />
                          )}
                          {group.lineNumber}
                        </button>

                        {city === 'BG' && (
                          <a
                            href={getLineUrl(group.lineNumber, city)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center p-1 rounded-lg text-xs bg-sky-500 hover:bg-sky-600 text-white transition-colors duration-150"
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
                                    <span className="font-bold text-gray-900 dark:text-white">{part}</span>
                                  ) : (
                                    <span>{part}</span>
                                  )}
                                  {index < array.length - 1 && (
                                    <span className="text-primary-600 dark:text-primary-400 font-bold text-sm mx-1">→</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="font-bold text-gray-900 dark:text-white">{group.lineName}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {isExpanded && lineTooltip && (
                      <div className="bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                          {lineTooltip}
                        </div>
                      </div>
                    )}

                    {group.stationName && (
                      <div className="bg-sky-50 dark:bg-sky-900/20 px-2 py-1 rounded border-l-4 border-sky-500">
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-sky-600 dark:text-sky-400 font-bold text-sm">→</span>
                          <div className="text-gray-700 dark:text-gray-300">
                            {group.stationName.includes(' - ') ? (
                              <>
                                {group.stationName.split(' - ').map((part, index, array) => (
                                  <span key={index}>
                                    {index === array.length - 1 ? (
                                      <span className="font-bold text-gray-900 dark:text-white">{part}</span>
                                    ) : (
                                      <span>{part}</span>
                                    )}
                                    {index < array.length - 1 && <span className="text-gray-500"> - </span>}
                                  </span>
                                ))}
                              </>
                            ) : (
                              <span className="font-bold text-gray-900 dark:text-white">{group.stationName}</span>
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
                                  ? 'inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-bold whitespace-nowrap bg-amber-500 text-white animate-pulse'
                                  : isUpcoming
                                  ? 'inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium whitespace-nowrap bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-700'
                                  : 'inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium whitespace-nowrap bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
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

                  {group.firstDeparture && (
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {group.firstDeparture} → {group.lastDeparture}
                      </span>
                      {group.fareAmount > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-medium border border-amber-200 dark:border-amber-700">
                          {group.fareAmount} RSD
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-1 mt-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setScheduleModal({ lineNumber: group.lineNumber, lineName: group.lineName, routeColor: group.routeColor, routeTextColor: group.routeTextColor }); }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title={t('fullSchedule')}
                    >
                      <CalendarClock className="w-3 h-3" />
                      <span>{t('fullSchedule')}</span>
                    </button>
                    {city === 'BG' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setMapModal({ lineNumber: group.lineNumber, lineName: group.lineName, routeColor: group.routeColor }); }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title={t('routeMap')}
                      >
                        <MapPin className="w-3 h-3" />
                        <span>{t('routeMap')}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-3 border-t border-gray-100 dark:border-gray-700">
            <Clock className="w-4 h-4 text-gray-300 dark:text-gray-600 mx-auto mb-1" />
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {t('noArrivalsScheduled')}
            </p>
          </div>
        )}
      </div>

      {scheduleModal && (
        <ScheduleModal
          isOpen={!!scheduleModal}
          onClose={() => setScheduleModal(null)}
          stopId={stopId}
          city={city}
          lineNumber={scheduleModal.lineNumber}
          lineName={scheduleModal.lineName}
          routeColor={scheduleModal.routeColor}
          routeTextColor={scheduleModal.routeTextColor}
        />
      )}
      {mapModal && (
        <RouteMapSVG
          isOpen={!!mapModal}
          onClose={() => setMapModal(null)}
          lineNumber={mapModal.lineNumber}
          lineName={mapModal.lineName}
          city={city}
          routeColor={mapModal.routeColor}
          stopLat={null}
          stopLon={null}
        />
      )}
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
