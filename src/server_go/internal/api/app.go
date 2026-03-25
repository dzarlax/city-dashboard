package api

import (
	"context"
	"errors"
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
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrForbidden is returned when the upstream API responds with HTTP 403.
var ErrForbidden = errors.New("403 Forbidden")

const circuitBreakerThreshold = 5

// cityCircuit tracks consecutive API failures for one city.
type cityCircuit struct {
	consecutive403 int
	disabled       bool
}

type App struct {
	cache       *cache.Cache
	apiKeys     map[string]models.APIKey
	idUIDMap    map[string]map[string]string
	allStations map[string]map[string]models.Station
	gtfsData    map[string]*gtfs.Data // city -> GTFS dataset
	circuits    map[string]*cityCircuit
	db          *pgxpool.Pool // optional Postgres connection pool
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
		circuits:    make(map[string]*cityCircuit),
	}
}

// SetDB attaches a Postgres connection pool for GTFS persistence.
func (app *App) SetDB(db *pgxpool.Pool) {
	app.mu.Lock()
	defer app.mu.Unlock()
	app.db = db
}

// isAPIDisabled reports whether the live API for city is currently disabled.
func (app *App) isAPIDisabled(city string) bool {
	app.mu.RLock()
	defer app.mu.RUnlock()
	cb := app.circuits[city]
	return cb != nil && cb.disabled
}

// recordAPISuccess resets the circuit breaker for city.
func (app *App) recordAPISuccess(city string) {
	app.mu.Lock()
	defer app.mu.Unlock()
	if cb := app.circuits[city]; cb != nil && cb.consecutive403 > 0 {
		cb.consecutive403 = 0
		if cb.disabled {
			cb.disabled = false
			log.Printf("CircuitBreaker: %s API re-enabled after successful response", city)
		}
	}
}

// record403 increments the 403 counter for city and disables the API if threshold is hit.
func (app *App) record403(city string) {
	app.mu.Lock()
	defer app.mu.Unlock()
	cb := app.circuits[city]
	if cb == nil {
		cb = &cityCircuit{}
		app.circuits[city] = cb
	}
	if cb.disabled {
		return
	}
	cb.consecutive403++
	if cb.consecutive403 >= circuitBreakerThreshold {
		cb.disabled = true
		log.Printf("CircuitBreaker: %s API disabled after %d consecutive 403 errors — switching to GTFS schedule only",
			city, cb.consecutive403)
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
// If a Postgres pool is configured and the stored data is less than 24 hours old,
// the data is loaded from the database instead of re-downloading.
// After a successful download+parse the data is saved to the database.
func (app *App) LoadGTFSFromURL(city, url string) error {
	const maxAge = 24 * time.Hour

	app.mu.RLock()
	db := app.db
	app.mu.RUnlock()

	var store gtfs.DBStore

	// Try to load from DB if available and fresh
	if db != nil && store.IsDataFresh(context.Background(), db, city, maxAge) {
		log.Printf("GTFS: loading %q from database (data is fresh)", city)
		data, err := store.LoadFromDB(context.Background(), db, city)
		if err != nil {
			log.Printf("GTFS: DB load failed for %q, falling back to download: %v", city, err)
		} else {
			app.mu.Lock()
			app.gtfsData[city] = data
			app.allStations[city] = nil
			app.idUIDMap[city] = nil
			app.mu.Unlock()
			log.Printf("GTFS: loaded %q from database successfully", city)
			return app.PopulateMap(false)
		}
	}

	log.Printf("GTFS: downloading %q from URL %s", city, url)
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

	// Persist to DB if available
	if db != nil {
		log.Printf("GTFS: saving %q to database...", city)
		if err := store.SaveToDB(context.Background(), db, city, data); err != nil {
			log.Printf("GTFS: failed to save %q to database: %v", city, err)
			// Non-fatal: continue serving from in-memory data
		} else {
			log.Printf("GTFS: saved %q to database successfully", city)
		}
	}

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
		gtfsGroup := api.Group("/gtfs")
		{
			gtfsGroup.GET("/:city/schedule", app.HandleGTFSSchedule)
			gtfsGroup.GET("/:city/shape", app.HandleGTFSShape)
			gtfsGroup.GET("/:city/stop-directions", app.HandleStopDirections)
		}
		api.GET("/transit-changes", app.HandleTransitChanges)
		api.GET("/status", app.HandleStatus)
	}
}

func (app *App) HandleStatus(c *gin.Context) {
	app.mu.RLock()
	defer app.mu.RUnlock()

	cities := make(map[string]gin.H)
	for city := range app.apiKeys {
		cb := app.circuits[city]
		disabled := cb != nil && cb.disabled
		consecutive403 := 0
		if cb != nil {
			consecutive403 = cb.consecutive403
		}
		_, hasGTFS := app.gtfsData[city]
		cities[city] = gin.H{
			"apiDisabled":    disabled,
			"consecutive403": consecutive403,
			"gtfsLoaded":     hasGTFS,
			"stationsLoaded": len(app.allStations[city]),
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"cities": cities,
		"time":   time.Now().Format(time.RFC3339),
	})
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

	if resp.StatusCode == http.StatusForbidden {
		return nil, ErrForbidden
	}
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

	if resp.StatusCode == http.StatusForbidden {
		return nil, ErrForbidden
	}
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
