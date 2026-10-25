package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	weatherUpstreamBase = "https://api.openweathermap.org/data/2.5/"
	weatherCacheTTL     = 5 * time.Minute
	weatherCacheMax     = 256
	weatherResponseMax  = 1 << 20
	weatherRateWindow   = time.Minute
	weatherRateLimit    = 60
)

type weatherProxy struct {
	apiKey string
	client *http.Client

	mu          sync.Mutex
	cache       map[string]weatherCacheEntry
	cacheOrder  []string
	rateStarted time.Time
	rateCount   int
	semaphore   chan struct{}
}

type weatherCacheEntry struct {
	data      []byte
	expiresAt time.Time
}

func newWeatherProxy(apiKey string, transport http.RoundTripper) *weatherProxy {
	if transport == nil {
		transport = http.DefaultTransport
	}
	return &weatherProxy{
		apiKey:    apiKey,
		client:    &http.Client{Transport: transport, Timeout: 5 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }},
		cache:     make(map[string]weatherCacheEntry),
		semaphore: make(chan struct{}, 2),
	}
}

type weatherConditions struct {
	Icon        string `json:"icon"`
	Description string `json:"description"`
}

type weatherMain struct {
	Temp float64 `json:"temp"`
}

type upstreamCurrent struct {
	Main    weatherMain         `json:"main"`
	Weather []weatherConditions `json:"weather"`
}

type upstreamForecastItem struct {
	DT      int64               `json:"dt"`
	Main    weatherMain         `json:"main"`
	Pop     float64             `json:"pop"`
	Weather []weatherConditions `json:"weather"`
}

type upstreamForecast struct {
	List []upstreamForecastItem `json:"list"`
}

func (proxy *weatherProxy) handleCurrent(c *gin.Context) {
	query, err := url.ParseQuery(c.Request.URL.RawQuery)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid weather request"})
		return
	}
	lat, lon, _, err := parseWeatherParams(query, false)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid weather request"})
		return
	}
	key := fmt.Sprintf("current:%s:%s", strconv.FormatFloat(lat, 'g', -1, 64), strconv.FormatFloat(lon, 'g', -1, 64))
	payload, status := proxy.fetch(c, "weather", key, lat, lon, 0)
	if status != http.StatusOK {
		c.JSON(status, gin.H{"error": weatherError(status)})
		return
	}
	var upstream upstreamCurrent
	if err := json.Unmarshal(payload, &upstream); err != nil || len(upstream.Weather) == 0 || !finite(upstream.Main.Temp) {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Weather service unavailable"})
		return
	}
	response := weatherCurrentDTO{Main: weatherMain{Temp: upstream.Main.Temp}, Weather: []weatherConditions{upstream.Weather[0]}}
	jsonPayload, err := json.Marshal(response)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Weather service unavailable"})
		return
	}
	proxy.store(key, jsonPayload, time.Now())
	c.Data(http.StatusOK, "application/json; charset=utf-8", jsonPayload)
}

func (proxy *weatherProxy) handleForecast(c *gin.Context) {
	query, err := url.ParseQuery(c.Request.URL.RawQuery)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid weather request"})
		return
	}
	lat, lon, cnt, err := parseForecastParams(query)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid weather request"})
		return
	}
	key := fmt.Sprintf("forecast:%s:%s:%d", strconv.FormatFloat(lat, 'g', -1, 64), strconv.FormatFloat(lon, 'g', -1, 64), cnt)
	payload, status := proxy.fetch(c, "forecast", key, lat, lon, cnt)
	if status != http.StatusOK {
		c.JSON(status, gin.H{"error": weatherError(status)})
		return
	}
	var upstream upstreamForecast
	if err := json.Unmarshal(payload, &upstream); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Weather service unavailable"})
		return
	}
	items := make([]upstreamForecastItem, 0, min(cnt, len(upstream.List)))
	for _, item := range upstream.List {
		if len(items) == cnt {
			break
		}
		if len(item.Weather) == 0 || !finite(item.Main.Temp) || !finite(item.Pop) {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Weather service unavailable"})
			return
		}
		items = append(items, upstreamForecastItem{
			DT:      item.DT,
			Main:    weatherMain{Temp: item.Main.Temp},
			Pop:     item.Pop,
			Weather: []weatherConditions{item.Weather[0]},
		})
	}
	response := weatherForecastDTO{List: items}
	jsonPayload, err := json.Marshal(response)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Weather service unavailable"})
		return
	}
	proxy.store(key, jsonPayload, time.Now())
	c.Data(http.StatusOK, "application/json; charset=utf-8", jsonPayload)
}

type weatherCurrentDTO struct {
	Main    weatherMain         `json:"main"`
	Weather []weatherConditions `json:"weather"`
}

type weatherForecastDTO struct {
	List []upstreamForecastItem `json:"list"`
}

func parseWeatherParams(query url.Values, forecast bool) (float64, float64, int, error) {
	allowed := map[string]bool{"lat": true, "lon": true}
	if forecast {
		allowed["cnt"] = true
	}
	for name := range query {
		if !allowed[name] || len(query[name]) != 1 {
			return 0, 0, 0, errors.New("invalid parameters")
		}
	}
	lat, err := parseCoordinate(query.Get("lat"), -90, 90)
	if err != nil {
		return 0, 0, 0, err
	}
	lon, err := parseCoordinate(query.Get("lon"), -180, 180)
	if err != nil {
		return 0, 0, 0, err
	}
	cnt := 0
	if forecast {
		cnt, err = strconv.Atoi(query.Get("cnt"))
		if err != nil || cnt < 1 || cnt > 12 {
			return 0, 0, 0, errors.New("invalid count")
		}
	}
	return lat, lon, cnt, nil
}

func parseForecastParams(query url.Values) (float64, float64, int, error) {
	return parseWeatherParams(query, true)
}

func parseCoordinate(value string, minValue, maxValue float64) (float64, error) {
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil || !finite(parsed) || parsed < minValue || parsed > maxValue {
		return 0, errors.New("invalid coordinate")
	}
	return parsed, nil
}

func finite(value float64) bool { return !math.IsNaN(value) && !math.IsInf(value, 0) }

func (proxy *weatherProxy) fetch(c *gin.Context, endpoint, cacheKey string, lat, lon float64, count int) ([]byte, int) {
	if proxy.apiKey == "" {
		return nil, http.StatusServiceUnavailable
	}
	if data, ok := proxy.cached(cacheKey); ok {
		return data, http.StatusOK
	}
	select {
	case proxy.semaphore <- struct{}{}:
		defer func() { <-proxy.semaphore }()
	default:
		return nil, http.StatusTooManyRequests
	}
	// Recheck after acquiring a slot in case a concurrent request populated the cache.
	if data, ok := proxy.cached(cacheKey); ok {
		return data, http.StatusOK
	}
	if !proxy.takeBudget(time.Now()) {
		return nil, http.StatusTooManyRequests
	}
	query := url.Values{
		"lat":   {strconv.FormatFloat(lat, 'f', -1, 64)},
		"lon":   {strconv.FormatFloat(lon, 'f', -1, 64)},
		"units": {"metric"},
		"appid": {proxy.apiKey},
	}
	if count > 0 {
		query.Set("cnt", strconv.Itoa(count))
	}
	request, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, weatherUpstreamBase+endpoint+"?"+query.Encode(), nil)
	if err != nil {
		return nil, http.StatusBadGateway
	}
	response, err := proxy.client.Do(request)
	if err != nil {
		return nil, http.StatusBadGateway
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, http.StatusBadGateway
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, weatherResponseMax+1))
	if err != nil || len(data) > weatherResponseMax {
		return nil, http.StatusBadGateway
	}
	if !json.Valid(data) {
		return nil, http.StatusBadGateway
	}
	return data, http.StatusOK
}

func weatherError(status int) string {
	if status == http.StatusTooManyRequests {
		return "Weather request limit reached"
	}
	if status == http.StatusGatewayTimeout {
		return "Weather service timed out"
	}
	return "Weather service unavailable"
}

func (proxy *weatherProxy) takeBudget(now time.Time) bool {
	proxy.mu.Lock()
	defer proxy.mu.Unlock()
	if proxy.rateStarted.IsZero() || now.Sub(proxy.rateStarted) >= weatherRateWindow {
		proxy.rateStarted = now
		proxy.rateCount = 0
	}
	if proxy.rateCount >= weatherRateLimit {
		return false
	}
	proxy.rateCount++
	return true
}

func (proxy *weatherProxy) cached(key string) ([]byte, bool) {
	proxy.mu.Lock()
	defer proxy.mu.Unlock()
	entry, ok := proxy.cache[key]
	if !ok {
		return nil, false
	}
	if time.Now().After(entry.expiresAt) {
		delete(proxy.cache, key)
		proxy.removeCacheOrderKey(key)
		return nil, false
	}
	return append([]byte(nil), entry.data...), true
}

func (proxy *weatherProxy) store(key string, data []byte, now time.Time) {
	proxy.mu.Lock()
	defer proxy.mu.Unlock()
	if _, exists := proxy.cache[key]; !exists {
		if len(proxy.cacheOrder) >= weatherCacheMax {
			oldest := proxy.cacheOrder[0]
			proxy.cacheOrder = proxy.cacheOrder[1:]
			delete(proxy.cache, oldest)
		}
		proxy.cacheOrder = append(proxy.cacheOrder, key)
	}
	proxy.cache[key] = weatherCacheEntry{data: append([]byte(nil), data...), expiresAt: now.Add(weatherCacheTTL)}
}

func (proxy *weatherProxy) removeCacheOrderKey(key string) {
	for i, candidate := range proxy.cacheOrder {
		if candidate == key {
			proxy.cacheOrder = append(proxy.cacheOrder[:i], proxy.cacheOrder[i+1:]...)
			return
		}
	}
}
