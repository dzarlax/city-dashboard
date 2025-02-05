import React, { useState, useEffect, useCallback } from 'react';
import { Bus } from 'lucide-react';

const SERVER_IP = "https://transport-api.dzarlax.dev";

const formatMinutes = (seconds) => {
  const minutes = Math.ceil(seconds / 60);
  return `${minutes}min`;
};

const BusStation = React.memo(({ name, distance, stopId, vehicles = [], city }) => {
  const groupedVehicles = vehicles.reduce((acc, vehicle) => {
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
    });
    return acc;
  }, {});

  const sortedGroups = Object.values(groupedVehicles).sort(
    (a, b) => parseInt(a.lineNumber) - parseInt(b.lineNumber)
  );

  return (
    <div className="station-card">
      <div className="station-header">
        <div className="station-title">
          <Bus className="station-icon" />
          <span>{name} <small>(#{stopId})</small></span>
        </div>
        <span className="station-distance">{distance}</span>
      </div>
      {sortedGroups.length > 0 && (
        <div className="station-lines">
          {sortedGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="line-info">
              <div className="line-header">
                <span className="line-number">
                  {group.lineNumber} {group.lineName ? `- ${group.lineName}` : ''}
                </span>
                {group.stationName && (
                  <span className="line-destination">→ {group.stationName}</span>
                )}
              </div>
              <div className="arrival-times">
                {group.arrivals
                  .sort((a, b) => a.secondsLeft - b.secondsLeft)
                  .map((arrival, arrivalIndex) => (
                    <span key={arrivalIndex} className="arrival-time">
                      {formatMinutes(arrival.secondsLeft)}
                      {arrival.stationsBetween > 0 && ` (${arrival.stationsBetween})`}
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

const TransportCard = ({ config }) => {
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStops = useCallback(async () => {
    try {
      const cities = ['bg', 'ns', 'nis'];
      const allStops = [];
      
      await Promise.all(cities.map(async city => {
        const params = new URLSearchParams({
          lat: config.latitude || 44.8178131,
          lon: config.longitude || 20.4568974,
          rad: config.radius || 500,
        });

        const response = await fetch(
          `${SERVER_IP}/api/stations/${city}/all?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch stations for ${city.toUpperCase()}`);
        }

        const data = await response.json();
        allStops.push(...data.map(stop => ({
          ...stop,
          distance: `${Math.round(stop.distance)}m`,
          city: city.toUpperCase(),
        })));
      }));

      setStops(allStops.sort((a, b) => a.distance - b.distance));
      setLoading(false);
    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    fetchStops();
    const interval = setInterval(fetchStops, (config.update_interval || 60) * 1000);
    return () => clearInterval(interval);
  }, [fetchStops, config]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="transport-card">
      {stops.map((stop) => (
        <BusStation key={`${stop.stopId}-${stop.city}`} {...stop} />
      ))}
    </div>
  );
};

export default TransportCard; 