package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"transit-server/internal/api"
	"transit-server/internal/gtfs"
)

const PORT = 3001

func main() {
	// Set Gin to release mode
	gin.SetMode(gin.ReleaseMode)

	// Initialize the application
	app := api.NewApp()

	// Load API keys from environment variables
	apiKeys := map[string]map[string]string{
		"bg": {
			"name":   os.Getenv("BG_API_NAME"),
			"url":    os.Getenv("BG_API_URL"),
			"key":    os.Getenv("BG_API_KEY"),
			"v2_key": os.Getenv("BG_API_V2_KEY"),
			"v2_iv":  os.Getenv("BG_API_V2_IV"),
		},
		"ns": {
			"name": os.Getenv("NS_API_NAME"),
			"url":  os.Getenv("NS_API_URL"),
			"key":  os.Getenv("NS_API_KEY"),
		},
		"nis": {
			"name": os.Getenv("NIS_API_NAME"),
			"url":  os.Getenv("NIS_API_URL"),
			"key":  os.Getenv("NIS_API_KEY"),
		},
	}

	// Pass API keys to the app
	if err := app.LoadAPIKeysFromEnv(apiKeys); err != nil {
		log.Fatalf("Failed to load API keys: %v", err)
	}

	// Connect to Postgres if DATABASE_URL is set
	if dbURL := os.Getenv("DATABASE_URL"); dbURL != "" {
		log.Printf("DB: connecting to Postgres...")
		pool, err := pgxpool.New(context.Background(), dbURL)
		if err != nil {
			log.Fatalf("DB: failed to create pool: %v", err)
		}
		if err := pool.Ping(context.Background()); err != nil {
			log.Printf("DB: failed to ping, running without persistence: %v", err)
			pool.Close()
		} else {
			log.Printf("DB: connected successfully")

			var store gtfs.DBStore
			if err := store.CreateSchema(context.Background(), pool); err != nil {
				log.Printf("DB: failed to create schema, running without persistence: %v", err)
				pool.Close()
			} else {
				app.SetDB(pool)
				defer pool.Close()
			}
		}
	} else {
		log.Printf("DB: DATABASE_URL not set — running without Postgres persistence")
	}

	// Load GTFS data: prefer URL over local directory
	type gtfsSource struct {
		city string
		url  string
		dir  string
	}
	gtfsSources := []gtfsSource{
		{"bg", os.Getenv("GTFS_BG_URL"), os.Getenv("GTFS_BG_DIR")},
	}
	for _, src := range gtfsSources {
		if src.url != "" {
			log.Printf("GTFS: fetching %q from URL", src.city)
			if err := app.LoadGTFSFromURL(src.city, src.url); err != nil {
				log.Printf("Warning: failed to load GTFS from URL for %s: %v", src.city, err)
			} else {
				// Refresh every 24 hours
				app.StartGTFSRefresher(src.city, src.url, 24*time.Hour)
			}
		} else if src.dir != "" {
			log.Printf("GTFS: loading %q from local dir %s", src.city, src.dir)
			if err := app.LoadGTFS(src.city, src.dir); err != nil {
				log.Printf("Warning: failed to load GTFS for %s: %v", src.city, err)
			}
		}
	}

	// Start cache cleaner
	app.StartCacheCleaner()

	// Refresh station map every 6 hours
	app.StartMapRefresher(6 * time.Hour)

	// Initialize router
	router := gin.New()

	// Add logging and recovery middleware
	router.Use(gin.Logger())
	router.Use(gin.Recovery())

	// Configure CORS
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowMethods = []string{"GET", "POST", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept"}
	router.Use(cors.New(config))

	// Setup routes
	app.SetupRoutes(router)

	// Initialize map data
	if err := app.PopulateMap(true); err != nil {
		log.Fatalf("Failed to populate initial map data: %v", err)
	}

	// Add health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
			"time":   time.Now().Format(time.RFC3339),
		})
	})

	// Add debug endpoint
	router.GET("/debug", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "debug endpoint working",
			"time":   time.Now().Format(time.RFC3339),
		})
	})

	// Endpoint for fetching environment variables
	router.GET("/api/env", func(c *gin.Context) {
		envVars := map[string]string{
			"BELGRADE_LAT":    os.Getenv("BELGRADE_LAT"),
			"BELGRADE_LON":    os.Getenv("BELGRADE_LON"),
			"SEARCH_RAD":      os.Getenv("SEARCH_RAD"),
			"WEATHER_API_KEY": os.Getenv("WEATHER_API_KEY"),
		}

		c.JSON(200, gin.H{
			"env": envVars,
		})
	})

	// Setup graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-quit
		log.Println("Shutting down server...")
		os.Exit(0)
	}()

	// Start server
	log.Printf("Server starting on port %d...", PORT)
	if err := router.Run(fmt.Sprintf(":%d", PORT)); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
