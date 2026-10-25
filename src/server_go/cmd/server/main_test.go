package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSanitizeWeatherLogPathOnlyRedactsWeatherQuery(t *testing.T) {
	if got := sanitizeWeatherLogPath("/api/weather/current?lat=44.8&lon=20.4"); got != "/api/weather/current" {
		t.Fatalf("weather log path = %q", got)
	}
	otherPath := "/api/stations/bg/search?id=station"
	if got := sanitizeWeatherLogPath(otherPath); got != otherPath {
		t.Fatalf("non-weather log path changed to %q", got)
	}
}

func TestPublicEnvironmentNeverDisclosesWeatherKey(t *testing.T) {
	t.Setenv("WEATHER_API_KEY", "synthetic-weather-secret")
	t.Setenv("BELGRADE_LAT", "44.8")
	t.Setenv("BELGRADE_LON", "20.4")
	t.Setenv("SEARCH_RAD", "400")
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/env", handlePublicEnvironment)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/env", nil))
	if recorder.Code != 200 {
		t.Fatalf("status=%d", recorder.Code)
	}
	if strings.Contains(recorder.Body.String(), "WEATHER_API_KEY") || strings.Contains(recorder.Body.String(), "synthetic-weather-secret") {
		t.Fatal("public environment exposed the weather key")
	}
	var got struct {
		Env map[string]string `json:"env"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Env) != 3 || got.Env["BELGRADE_LAT"] != "44.8" || got.Env["BELGRADE_LON"] != "20.4" || got.Env["SEARCH_RAD"] != "400" {
		t.Fatal("public location configuration contract changed")
	}
	if recorder.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("public configuration must not be cached")
	}
}
