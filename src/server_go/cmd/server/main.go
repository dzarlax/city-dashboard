package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"transit-server/internal/api"
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

	// Start cache cleaner
	app.StartCacheCleaner()

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
