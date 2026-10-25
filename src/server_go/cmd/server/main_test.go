package main

import "testing"

func TestSanitizeWeatherLogPathOnlyRedactsWeatherQuery(t *testing.T) {
	if got := sanitizeWeatherLogPath("/api/weather/current?lat=44.8&lon=20.4"); got != "/api/weather/current" {
		t.Fatalf("weather log path = %q", got)
	}
	otherPath := "/api/stations/bg/search?id=station"
	if got := sanitizeWeatherLogPath(otherPath); got != otherPath {
		t.Fatalf("non-weather log path changed to %q", got)
	}
}
