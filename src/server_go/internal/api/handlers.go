package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"sync"
	"time"

	"transit-server/internal/crypto"
	"transit-server/internal/models"
	"transit-server/internal/utils"

	"github.com/gin-gonic/gin"
)

func (app *App) HandleStationSearch(c *gin.Context) {
	city := c.Param("city")
	query := c.Request.URL.Query()

	stationInfo, err := app.GetStationInfo(city, query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stationInfo)
}

func (app *App) HandleAllStations(c *gin.Context) {
	city := c.Param("city")
	lat, err := strconv.ParseFloat(c.Query("lat"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid latitude"})
		return
	}

	lon, err := strconv.ParseFloat(c.Query("lon"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid longitude"})
		return
	}

	rad, err := strconv.ParseFloat(c.Query("rad"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid radius"})
		return
	}

	stations, err := app.GetAllStations(city, lat, lon, rad)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stations)
}

func (app *App) GetStationInfo(city string, query url.Values) (*models.Station, error) {
	uid, err := app.GetStationUID(city, query)
	if err != nil {
		return nil, err
	}

	stationID := query.Get("id")
	var station *models.Station
	if cachedStation, found := app.cache.GetCachedStation(city, stationID); found {
		station = cachedStation.(*models.Station)
		log.Printf("Using cached station data for %s:%s", city, stationID)
	}

	var vehicles []models.Vehicle
	if cachedVehicles, found := app.cache.GetCachedVehicles(city, stationID); found {
		vehicles = cachedVehicles.([]models.Vehicle)
		log.Printf("Using cached vehicles for %s:%s (%d vehicles)", city, stationID, len(vehicles))
	}

	apiKey, exists := app.apiKeys[city]
	if !exists {
		return nil, fmt.Errorf("API key not found for city: %s", city)
	}

	log.Printf("Using API version %s for city %s", apiKey.API, city)

	if station == nil || vehicles == nil {
		var stationData []byte

		if apiKey.API == "v1" { // Changed condition to match JS version
			url := fmt.Sprintf("%s/publicapi/v1/announcement/announcement.php?action=get_announcement_data&station_uid=%s",
				apiKey.URL, uid)
			respData, reqErr := app.getRequest(url, apiKey.Key)
			if reqErr != nil {
				log.Printf("Request error for station %s: %v", stationID, reqErr)
			} else {
				log.Printf("Raw v1 response for station %s: %s", stationID, string(respData))

				var jsonResponse interface{}
				if jsonErr := json.Unmarshal(respData, &jsonResponse); jsonErr == nil {
					stationData = respData
				} else {
					log.Printf("Response is not JSON for station %s", stationID)
				}
			}

			// Fallback to cache for empty/error responses
			if stationData == nil || len(stationData) == 0 {
				log.Printf("Using fallback data for station %s", stationID)
				app.mu.RLock()
				stationData, exists := app.allStations[city][uid]
				app.mu.RUnlock()

				if !exists {
					return nil, fmt.Errorf("station not found in cache")
				}

				station = &models.Station{
					Name:     stationData.Name,
					UID:      utils.InterfaceToInt(uid),
					ID:       stationID,
					StopID:   stationID,
					Coords:   stationData.Coords,
					Vehicles: []models.Vehicle{},
				}

				app.cache.SetCachedStation(city, stationID, station)
				app.cache.SetCachedVehicles(city, stationID, []models.Vehicle{})

				return station, nil
			}
		} else { // v2 handling
			url := fmt.Sprintf("%s/publicapi/v2/api.php", apiKey.URL)
			sessionID := fmt.Sprintf("A%d", time.Now().Unix())

			jsonData := map[string]string{
				"station_uid": uid,
				"session_id":  sessionID,
			}
			jsonBytes, _ := json.Marshal(jsonData)

			// Debug logging
			log.Printf("V2 API Request for city %s, station %s:", city, uid)
			log.Printf("URL: %s", url)
			log.Printf("JSON payload: %s", string(jsonBytes))

			base, encErr := crypto.Encrypt(string(jsonBytes), apiKey.V2Key, apiKey.V2IV)
			if encErr != nil {
				log.Printf("Encryption failed: %v", encErr)
				return nil, fmt.Errorf("v2 encryption error: %v", encErr)
			}
			log.Printf("Encrypted base parameter: %s", base)

			payload := fmt.Sprintf("action=data_bulletin&base=%s", base)
			respData, reqErr := app.postRequest(url, apiKey.Key, payload)
			if reqErr != nil {
				log.Printf("Request failed: %v", reqErr)
				return nil, fmt.Errorf("v2 request error: %v", reqErr)
			}
			log.Printf("Raw response data: %s", string(respData))

			decrypted, decErr := crypto.Decrypt(string(respData), apiKey.V2Key, apiKey.V2IV)
			if decErr != nil {
				log.Printf("Decryption failed: %v", decErr)
				return nil, fmt.Errorf("v2 decryption error: %v", decErr)
			}
			log.Printf("Decrypted response: %s", decrypted)

			var v2Response struct {
				Success bool            `json:"success"`
				Data    json.RawMessage `json:"data"`
			}
			if jsonErr := json.Unmarshal([]byte(decrypted), &v2Response); jsonErr != nil {
				log.Printf("JSON unmarshal failed: %v", jsonErr)
				return nil, fmt.Errorf("v2 unmarshal error: %v", jsonErr)
			}

			if !v2Response.Success {
				log.Printf("API reported failure")
				return nil, fmt.Errorf("invalid station ID")
			}

			stationData = v2Response.Data
			log.Printf("V2 API response for station %s: %s", stationID, string(stationData))
		}

		if stationData != nil && len(stationData) > 0 {
			transformedStation, transformErr := app.transformStationResponse(stationData, city)
			if transformErr != nil {
				log.Printf("Transform error for station %s: %v", stationID, transformErr)
			} else {
				station = transformedStation
				vehicles = station.Vehicles
				log.Printf("Got fresh data for %s:%s (%d vehicles)", city, stationID, len(vehicles))

				stationWithoutVehicles := *station
				stationWithoutVehicles.Vehicles = nil
				app.cache.SetCachedStation(city, stationID, &stationWithoutVehicles)
				app.cache.SetCachedVehicles(city, stationID, vehicles)
			}
		}
	}

	// Ensure valid station object
	if station == nil {
		app.mu.RLock()
		stationData, exists := app.allStations[city][uid]
		app.mu.RUnlock()

		if !exists {
			return nil, fmt.Errorf("station not found in cache")
		}

		station = &models.Station{
			Name:     stationData.Name,
			UID:      utils.InterfaceToInt(uid),
			ID:       stationID,
			StopID:   stationID,
			Coords:   stationData.Coords,
			Vehicles: []models.Vehicle{},
		}
	}

	station.StopID = station.ID
	station.Vehicles = vehicles
	if station.Vehicles == nil {
		station.Vehicles = []models.Vehicle{}
	}

	return station, nil
}

func (app *App) GetAllStations(city string, lat, lon, rad float64) ([]models.Station, error) {
	app.mu.RLock()
	cityStations, exists := app.allStations[city]
	app.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("stations for city %s not populated", city)
	}

	var nearbyStations []models.Station
	for _, station := range cityStations {
		latF, _ := strconv.ParseFloat(station.Coords[0], 64)
		lonF, _ := strconv.ParseFloat(station.Coords[1], 64)
		distance := utils.CalculateDistance(lat, lon, latF, lonF)
		if distance <= rad {
			stationCopy := station
			stationCopy.Distance = distance
			stationCopy.StopID = stationCopy.ID
			nearbyStations = append(nearbyStations, stationCopy)
		}
	}

	sort.Slice(nearbyStations, func(i, j int) bool {
		return nearbyStations[i].Distance < nearbyStations[j].Distance
	})

	var wg sync.WaitGroup
	results := make([]models.Station, len(nearbyStations))

	for i, station := range nearbyStations {
		wg.Add(1)
		go func(i int, station models.Station) {
			defer wg.Done()

			query := url.Values{}
			query.Set("id", station.ID)

			realTimeData, err := app.GetStationInfo(city, query)
			if err != nil {
				log.Printf("Failed to fetch real-time data for station %s: %v", station.ID, err)
				results[i] = station
				results[i].Vehicles = []models.Vehicle{}
				return
			}

			station.Vehicles = realTimeData.Vehicles
			results[i] = station
		}(i, station)
	}

	wg.Wait()
	return results, nil
}
