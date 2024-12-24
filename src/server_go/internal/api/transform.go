package api

import (
	"encoding/json"
	"fmt"
	"log"

	"transit-server/internal/models"
	"transit-server/internal/utils"
)

type rawVehicle struct {
	StationName string      `json:"station_name"`
	GarageNo    string      `json:"garageNo"`
	Lat         interface{} `json:"lat"`
	Lng         interface{} `json:"lng"`
}

type rawStation struct {
	StationName     string       `json:"station_name"`
	StationUID      interface{}  `json:"station_uid"`
	StationID       interface{}  `json:"station_id"`
	JustCoordinates string       `json:"just_coordinates"`
	LineNumber      string       `json:"line_number"`
	MainLineTitle   string       `json:"main_line_title"`
	SecondsLeft     int          `json:"seconds_left"`
	StationsBetween int          `json:"stations_between"`
	Vehicles        []rawVehicle `json:"vehicles"`
}

func (app *App) transformStationResponse(response []byte, city string) (*models.Station, error) {
	log.Printf("Raw station response for city %s: %s", city, string(response))

	// Handle empty response
	if len(response) == 0 || string(response) == "" {
		return nil, fmt.Errorf("empty response")
	}

	var rawStations []rawStation
	if err := json.Unmarshal(response, &rawStations); err != nil {
		// Try decoding as single station
		var singleStation rawStation
		if err2 := json.Unmarshal(response, &singleStation); err2 != nil {
			return nil, fmt.Errorf("failed to unmarshal station response: %v", err)
		}
		rawStations = []rawStation{singleStation}
	}

	if len(rawStations) == 0 {
		return nil, fmt.Errorf("empty station response")
	}

	stationUID := utils.InterfaceToInt(rawStations[0].StationUID)
	stationID := utils.InterfaceToString(rawStations[0].StationID)

	app.mu.RLock()
	stationData, exists := app.allStations[city][fmt.Sprint(stationUID)]
	app.mu.RUnlock()

	if !exists {
		log.Printf("Station %d not found in cache for city %s", stationUID, city)
		return nil, fmt.Errorf("station not found in cache")
	}

	station := models.Station{
		Name:     stationData.Name,
		UID:      stationUID,
		ID:       stationID,
		StopID:   stationID,
		Coords:   stationData.Coords,
		Vehicles: make([]models.Vehicle, 0),
	}

	// If just_coordinates is "1" or we have an empty response, return station without vehicles
	if rawStations[0].JustCoordinates == "1" {
		log.Printf("Station %s has just_coordinates=1, returning without vehicles", stationID)
		return &station, nil
	}

	for _, raw := range rawStations {
		if len(raw.Vehicles) == 0 {
			log.Printf("No vehicles in response for station %s", stationID)
			continue
		}

		for _, rawVeh := range raw.Vehicles {
			coords := make([]string, 2)
			coords[0] = utils.FormatFloat(rawVeh.Lat)
			coords[1] = utils.FormatFloat(rawVeh.Lng)

			vehicle := models.Vehicle{
				LineNumber:      raw.LineNumber,
				LineName:        raw.MainLineTitle,
				SecondsLeft:     raw.SecondsLeft,
				StationsBetween: raw.StationsBetween,
				GarageNo:        rawVeh.GarageNo,
				Coords:          coords,
			}

			station.Vehicles = append(station.Vehicles, vehicle)
		}
	}

	log.Printf("Transformed response for station %s: %d vehicles", stationID, len(station.Vehicles))
	return &station, nil
}
