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
	"transit-server/internal/gtfs"
	"transit-server/internal/models"

	"github.com/gin-gonic/gin"
)

type App struct {
	cache       *cache.Cache
	apiKeys     map[string]models.APIKey
	idUIDMap    map[string]map[string]string
	allStations map[string]map[string]models.Station
	gtfsData    map[string]*gtfs.Data // city -> GTFS dataset
	mapReady    bool
	mu          sync.RWMutex
}

func NewApp() *App {
	return &App{
		cache:       cache.New(),
		apiKeys:     make(map[string]models.APIKey),
		idUIDMap:    make(map[string]map[string]string),
		allStations: make(map[string]map[string]models.Station),
		gtfsData:    make(map[string]*gtfs.Data),
	}
}

// LoadGTFS loads a GTFS dataset for the given city from a local directory.
func (app *App) LoadGTFS(city, dir string) error {
	data, err := gtfs.Load(dir)
	if err != nil {
		return err
	}
	app.mu.Lock()
	app.gtfsData[city] = data
	app.mu.Unlock()
	log.Printf("GTFS: loaded dataset for city %q from %s", city, dir)
	return nil
}

// LoadGTFSFromURL downloads a GTFS ZIP from url and loads it for the given city.
func (app *App) LoadGTFSFromURL(city, url string) error {
	data, err := gtfs.DownloadAndLoad(url)
	if err != nil {
		return err
	}
	app.mu.Lock()
	app.gtfsData[city] = data
	// Reset station map so PopulateMap re-runs with fresh GTFS data
	app.allStations[city] = nil
	app.idUIDMap[city] = nil
	app.mu.Unlock()
	log.Printf("GTFS: refreshed dataset for city %q from URL", city)

	// Re-populate station map (picks up new GTFS stops)
	return app.PopulateMap(false)
}

// StartGTFSRefresher refreshes GTFS data for city from url on the given interval.
func (app *App) StartGTFSRefresher(city, url string, interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for range ticker.C {
			log.Printf("GTFSRefresher: updating %q from %s", city, url)
			if err := app.LoadGTFSFromURL(city, url); err != nil {
				log.Printf("GTFSRefresher: failed to update %q: %v", city, err)
			}
		}
	}()
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
		api.GET("/transit-changes", app.HandleTransitChanges)
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

func (app *App) StartMapRefresher(interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		for range ticker.C {
			log.Printf("MapRefresher: refreshing station map...")
			if err := app.PopulateMap(false); err != nil {
				log.Printf("MapRefresher: failed to refresh: %v", err)
			} else {
				log.Printf("MapRefresher: station map refreshed successfully")
			}
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
