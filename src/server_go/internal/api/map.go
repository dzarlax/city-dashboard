package api

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"

	"transit-server/internal/models"
	"transit-server/internal/utils"
)

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

	for city, apiKey := range app.apiKeys {
		log.Printf("Populating map for city: %s", city)

		url := fmt.Sprintf("%s/publicapi/v1/networkextended.php?action=get_cities_extended", apiKey.URL)
		response, err := app.getRequest(url, apiKey.Key)
		if err != nil {
			log.Printf("Failed to populate map for city %s: %v", city, err)
			continue
		}

		var stationsResp StationResponse
		decoder := json.NewDecoder(strings.NewReader(string(response)))
		decoder.UseNumber()
		if err := decoder.Decode(&stationsResp); err != nil {
			log.Printf("Failed to parse stations for city %s: %v", city, err)
			continue
		}

		if app.idUIDMap[city] == nil {
			app.idUIDMap[city] = make(map[string]string)
		}
		if app.allStations[city] == nil {
			app.allStations[city] = make(map[string]models.Station)
		}

		for _, station := range stationsResp.Stations {
			stationID := utils.InterfaceToString(station.StationID)
			if stationID == "" || stationID == "0" {
				log.Printf("Skipping station with empty ID in city %s", city)
				continue
			}

			uid := utils.InterfaceToInt(station.ID)
			if uid == 0 {
				log.Printf("Skipping station with invalid UID in city %s", city)
				continue
			}

			coords := make([]string, 2)
			coords[0] = utils.FormatFloat(station.Coordinates.Latitude)
			coords[1] = utils.FormatFloat(station.Coordinates.Longitude)

			if coords[0] == "" || coords[1] == "" {
				log.Printf("Skipping station with invalid coordinates in city %s", city)
				continue
			}

			app.idUIDMap[city][stationID] = fmt.Sprint(uid)
			app.allStations[city][fmt.Sprint(uid)] = models.Station{
				Name:     station.Name,
				UID:      uid,
				ID:       stationID,
				StopID:   stationID,
				Coords:   coords,
				Vehicles: make([]models.Vehicle, 0),
			}
		}

		log.Printf("Successfully populated map for %s with %d stations",
			city, len(app.allStations[city]))
	}

	// For cities with no stations loaded from API, fall back to GTFS stops.
	app.mu.Lock()
	for city, gd := range app.gtfsData {
		if len(app.allStations[city]) == 0 && gd != nil {
			log.Printf("PopulateMap: no API stations for %q — falling back to GTFS (%d stops)", city, len(gd.Stops))
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
			log.Printf("PopulateMap: GTFS fallback loaded %d stations for %q", len(app.allStations[city]), city)
		}
	}
	app.mapReady = true
	app.mu.Unlock()

	return nil
}
