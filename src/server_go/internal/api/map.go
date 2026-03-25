package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"transit-server/internal/gtfs"
	"transit-server/internal/models"
	"transit-server/internal/utils"
)

const liveStationsMaxAge = 24 * time.Hour

type CoordinatesStr struct {
	Latitude  interface{} `json:"latitude"`
	Longitude interface{} `json:"longitude"`
}

type StationResponse struct {
	Stations []struct {
		Name        string         `json:"name"`
		ID          interface{}    `json:"id"`
		StationID   interface{}    `json:"station_id"`
		Coordinates CoordinatesStr `json:"coordinates"`
	} `json:"stations"`
}

func (app *App) PopulateMap(force bool) error {
	app.mu.Lock()
	app.mapReady = false
	app.mu.Unlock()

	// Step 1: Load GTFS stops as the base layer for every city.
	app.mu.Lock()
	for city, gd := range app.gtfsData {
		if gd == nil {
			continue
		}
		log.Printf("PopulateMap: loading %d GTFS stops as base for %q", len(gd.Stops), city)
		if app.allStations[city] == nil {
			app.allStations[city] = make(map[string]models.Station)
		}
		if app.idUIDMap[city] == nil {
			app.idUIDMap[city] = make(map[string]string)
		}
		for _, s := range gd.Stops {
			coords := []string{
				strconv.FormatFloat(s.Lat, 'f', 10, 64),
				strconv.FormatFloat(s.Lon, 'f', 10, 64),
			}
			app.allStations[city][s.StopID] = models.Station{
				Name:     s.Name,
				UID:      0,
				ID:       s.StopID,
				StopID:   s.StopID,
				Coords:   coords,
				Vehicles: make([]models.Vehicle, 0),
			}
			app.idUIDMap[city][s.StopID] = s.StopID
		}
		log.Printf("PopulateMap: GTFS base — %d stations for %q", len(app.allStations[city]), city)
	}
	app.mu.Unlock()

	// Step 2: Enrich with live API stations.
	// Try DB cache first, fall back to live API, then persist to DB.
	for city, apiKey := range app.apiKeys {
		// Try fresh DB cache → Live API → stale DB cache as last resort
		liveStations := app.loadLiveStationsFromDB(city, false)

		if liveStations == nil {
			liveStations = app.fetchLiveStationsFromAPI(city, apiKey)
			if liveStations != nil {
				app.saveLiveStationsToDB(city, liveStations)
			} else {
				// API failed — try stale DB data (better than nothing)
				liveStations = app.loadLiveStationsFromDB(city, true)
				if liveStations != nil {
					log.Printf("PopulateMap: using stale DB cache for %q (API unavailable)", city)
				}
			}
		}

		if liveStations == nil {
			log.Printf("PopulateMap: no live stations for %q, keeping GTFS base", city)
			continue
		}

		app.mergeLiveStations(city, liveStations)
	}

	app.mu.Lock()
	app.mapReady = true
	app.mu.Unlock()

	return nil
}

// loadLiveStationsFromDB tries to load cached live stations from the database.
// If allowStale is false, returns nil when data is older than liveStationsMaxAge.
// If allowStale is true, returns any cached data regardless of age.
func (app *App) loadLiveStationsFromDB(city string, allowStale bool) []gtfs.LiveStation {
	app.mu.RLock()
	db := app.db
	app.mu.RUnlock()

	if db == nil {
		return nil
	}

	var store gtfs.DBStore
	ctx := context.Background()

	if !allowStale && !store.AreLiveStationsFresh(ctx, db, city, liveStationsMaxAge) {
		return nil
	}

	stations, err := store.LoadLiveStations(ctx, db, city)
	if err != nil {
		log.Printf("PopulateMap: failed to load live stations from DB for %q: %v", city, err)
		return nil
	}

	if len(stations) == 0 {
		return nil
	}

	log.Printf("PopulateMap: loaded %d live stations from DB for %q (stale=%v)", len(stations), city, allowStale)
	return stations
}

// fetchLiveStationsFromAPI fetches the station list from the external live API.
func (app *App) fetchLiveStationsFromAPI(city string, apiKey models.APIKey) []gtfs.LiveStation {
	log.Printf("PopulateMap: fetching live station list from API for %q", city)

	url := fmt.Sprintf("%s/publicapi/v1/networkextended.php?action=get_cities_extended", apiKey.URL)
	response, err := app.getRequest(url, apiKey.Key)
	if err != nil {
		log.Printf("PopulateMap: live API failed for %q: %v", city, err)
		return nil
	}

	var stationsResp StationResponse
	decoder := json.NewDecoder(strings.NewReader(string(response)))
	decoder.UseNumber()
	if err := decoder.Decode(&stationsResp); err != nil {
		log.Printf("PopulateMap: failed to parse live stations for %q: %v", city, err)
		return nil
	}

	var result []gtfs.LiveStation
	for _, station := range stationsResp.Stations {
		stationID := utils.InterfaceToString(station.StationID)
		if stationID == "" || stationID == "0" {
			continue
		}

		uid := utils.InterfaceToInt(station.ID)
		if uid == 0 {
			continue
		}

		lat := utils.FormatFloat(station.Coordinates.Latitude)
		lon := utils.FormatFloat(station.Coordinates.Longitude)
		if lat == "" || lon == "" {
			continue
		}

		result = append(result, gtfs.LiveStation{
			City:      city,
			StationID: stationID,
			UID:       uid,
			Name:      station.Name,
			Lat:       lat,
			Lon:       lon,
		})
	}

	log.Printf("PopulateMap: fetched %d live stations from API for %q", len(result), city)
	return result
}

// saveLiveStationsToDB persists live stations to the database (non-blocking).
func (app *App) saveLiveStationsToDB(city string, stations []gtfs.LiveStation) {
	app.mu.RLock()
	db := app.db
	app.mu.RUnlock()

	if db == nil {
		return
	}

	var store gtfs.DBStore
	if err := store.SaveLiveStations(context.Background(), db, city, stations); err != nil {
		log.Printf("PopulateMap: failed to save live stations to DB for %q: %v", city, err)
	}
}

// mergeLiveStations merges live station data on top of the existing station map.
func (app *App) mergeLiveStations(city string, stations []gtfs.LiveStation) {
	if app.idUIDMap[city] == nil {
		app.idUIDMap[city] = make(map[string]string)
	}
	if app.allStations[city] == nil {
		app.allStations[city] = make(map[string]models.Station)
	}

	liveCount := 0
	for _, s := range stations {
		// Remove GTFS entry keyed by stationID if it exists
		// (live API re-keys by UID instead).
		if _, gtfsExists := app.allStations[city][s.StationID]; gtfsExists {
			delete(app.allStations[city], s.StationID)
		}

		uidStr := fmt.Sprint(s.UID)
		app.idUIDMap[city][s.StationID] = uidStr
		app.allStations[city][uidStr] = models.Station{
			Name:     s.Name,
			UID:      s.UID,
			ID:       s.StationID,
			StopID:   s.StationID,
			Coords:   []string{s.Lat, s.Lon},
			Vehicles: make([]models.Vehicle, 0),
		}
		liveCount++
	}

	log.Printf("PopulateMap: merged %d live stations for %q (total: %d)",
		liveCount, city, len(app.allStations[city]))
}
