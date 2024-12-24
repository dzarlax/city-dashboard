package api

import (
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"transit-server/internal/cache"
	"transit-server/internal/models"

	"github.com/gin-gonic/gin"
)

type App struct {
	cache       *cache.Cache
	apiKeys     map[string]models.APIKey
	idUIDMap    map[string]map[string]string
	allStations map[string]map[string]models.Station
	mapReady    bool
	mu          sync.RWMutex
}

func NewApp() *App {
	return &App{
		cache:       cache.New(),
		apiKeys:     make(map[string]models.APIKey),
		idUIDMap:    make(map[string]map[string]string),
		allStations: make(map[string]map[string]models.Station),
	}
}

func (app *App) LoadAPIKeysFromEnv(keys map[string]map[string]string) error {
	if app.apiKeys == nil {
		app.apiKeys = make(map[string]models.APIKey)
	}

	for city, keySet := range keys {
		// Validate required fields
		if keySet["name"] == "" || keySet["url"] == "" || keySet["key"] == "" {
			return fmt.Errorf("missing required fields for city '%s'", city)
		}

		// Populate the app.apiKeys with validated data
		app.apiKeys[city] = models.APIKey{
			Name:  keySet["name"],
			URL:   keySet["url"],
			Key:   keySet["key"],
			API:   keySet["api"],
			V2Key: keySet["v2_key"], // Optional
			V2IV:  keySet["v2_iv"],  // Optional
		}

		// Log the loaded key details
		log.Printf("Loaded API keys for city '%s' (API version: %s)", city, keySet["api"])
	}

	return nil
}

func (app *App) SetupRoutes(router *gin.Engine) {
	api := router.Group("/api")
	{
		stations := api.Group("/stations")
		{
			stations.GET("/:city/search", app.HandleStationSearch)
			stations.GET("/:city/all", app.HandleAllStations)
		}
	}
}

func (app *App) StartCacheCleaner() {
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		for range ticker.C {
			app.cache.ClearExpiredCache()
		}
	}()
}

func (app *App) getRequest(url, apiKey string) ([]byte, error) {
	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("X-Api-Authentication", apiKey)
	req.Header.Set("User-Agent", "okhttp/4.10.0")

	log.Printf("Making request to: %s", url)
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("request failed with status code %d", resp.StatusCode)
	}

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	log.Printf("Response status: %d, Content-Type: %s, Length: %d",
		resp.StatusCode,
		resp.Header.Get("Content-Type"),
		len(body))

	if len(body) > 0 {
		sampleSize := 100
		if len(body) < sampleSize {
			sampleSize = len(body)
		}
		log.Printf("Response sample: %s", string(body[:sampleSize]))
	}

	return body, nil
}

func (app *App) postRequest(url, apiKey string, payload string) ([]byte, error) {
	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	req, err := http.NewRequest("POST", url, strings.NewReader(payload))
	if err != nil {
		return nil, err
	}

	req.Header.Set("X-Api-Authentication", apiKey)
	req.Header.Set("User-Agent", "okhttp/4.10.0")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("request failed with status code %d", resp.StatusCode)
	}

	return ioutil.ReadAll(resp.Body)
}

func (app *App) GetStationUID(city string, query url.Values) (string, error) {
	if uid := query.Get("uid"); uid != "" {
		return uid, nil
	}

	if id := query.Get("id"); id != "" {
		app.mu.RLock()
		cityMap, exists := app.idUIDMap[city]
		app.mu.RUnlock()

		if !exists {
			return "", fmt.Errorf("map for city '%s' is not populated yet", city)
		}

		if uid, exists := cityMap[id]; exists {
			return uid, nil
		}

		return "", fmt.Errorf("invalid station ID: %s", id)
	}

	return "", fmt.Errorf("invalid query parameters")
}
