package api

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) { return fn(request) }

func weatherResponse(status int, body string, headers http.Header) *http.Response {
	return &http.Response{
		StatusCode: status,
		Header:     headers,
		Body:       io.NopCloser(strings.NewReader(body)),
		Request:    &http.Request{},
	}
}

func weatherRouter(proxy *weatherProxy) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/weather/current", proxy.handleCurrent)
	router.GET("/api/weather/forecast", proxy.handleForecast)
	return router
}

func TestWeatherProxyUsesFixedHTTPSUpstreamAndTypedCurrentDTO(t *testing.T) {
	calls := 0
	proxy := newWeatherProxy("server-secret", roundTripFunc(func(request *http.Request) (*http.Response, error) {
		calls++
		if request.URL.Scheme != "https" || request.URL.Host != "api.openweathermap.org" || request.URL.Path != "/data/2.5/weather" {
			t.Fatalf("unexpected upstream: %s", request.URL.String())
		}
		query := request.URL.Query()
		if query.Get("appid") != "server-secret" || query.Get("units") != "metric" || query.Get("lat") != "44.8" || query.Get("lon") != "20.4" || len(query) != 4 {
			t.Fatalf("unexpected upstream query: %#v", query)
		}
		return weatherResponse(http.StatusOK, `{"name":"private place","main":{"temp":18,"humidity":40},"weather":[{"icon":"01d","description":"clear sky","id":800}],"sys":{"country":"RS"}}`, nil), nil
	}))
	recorder := httptest.NewRecorder()
	weatherRouter(proxy).ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/weather/current?lat=44.8&lon=20.4", nil))
	if recorder.Code != http.StatusOK || recorder.Body.String() != `{"main":{"temp":18},"weather":[{"icon":"01d","description":"clear sky"}]}` {
		t.Fatalf("unexpected response %d: %s", recorder.Code, recorder.Body.String())
	}
	if calls != 1 {
		t.Fatalf("upstream calls = %d, want 1", calls)
	}
}

func TestWeatherProxyRejectsInvalidAndUnknownParamsBeforeUpstream(t *testing.T) {
	calls := 0
	proxy := newWeatherProxy("key", roundTripFunc(func(*http.Request) (*http.Response, error) {
		calls++
		return weatherResponse(http.StatusOK, `{}`, nil), nil
	}))
	router := weatherRouter(proxy)
	for _, path := range []string{
		"/api/weather/current?lat=NaN&lon=20",
		"/api/weather/current?lat=Inf&lon=20",
		"/api/weather/current?lat=44&lon=-Inf",
		"/api/weather/current?lat=44&lon=20&url=https://attacker.invalid",
		"/api/weather/current?lat=91&lon=20",
		"/api/weather/current?lat=44&lon=181",
		"/api/weather/current?lat=44&lon=20&appid=client-key",
		"/api/weather/current?lat=44&lat=45&lon=20",
		"/api/weather/forecast?lat=44&lon=20&cnt=13",
		"/api/weather/forecast?lat=44&lon=20&cnt=6&units=imperial",
	} {
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
		if recorder.Code != http.StatusBadRequest {
			t.Errorf("%s returned %d, want 400", path, recorder.Code)
		}
	}
	if calls != 0 {
		t.Fatalf("invalid requests made %d upstream calls", calls)
	}
}

func TestWeatherProxyDoesNotFollowRedirectsOrExposeUpstreamBody(t *testing.T) {
	calls := 0
	headers := make(http.Header)
	headers.Set("Location", "https://attacker.invalid/steal")
	proxy := newWeatherProxy("secret-key", roundTripFunc(func(*http.Request) (*http.Response, error) {
		calls++
		return weatherResponse(http.StatusFound, "secret-key upstream details", headers), nil
	}))
	recorder := httptest.NewRecorder()
	weatherRouter(proxy).ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/weather/current?lat=44&lon=20", nil))
	if recorder.Code != http.StatusBadGateway || calls != 1 {
		t.Fatalf("redirect result status=%d calls=%d", recorder.Code, calls)
	}
	if strings.Contains(recorder.Body.String(), "secret-key") || strings.Contains(recorder.Body.String(), "attacker") {
		t.Fatalf("response leaked upstream details: %s", recorder.Body.String())
	}
}

func TestWeatherProxyForecastRetainsPOPAndReturnsOnlyUIFields(t *testing.T) {
	proxy := newWeatherProxy("key", roundTripFunc(func(*http.Request) (*http.Response, error) {
		return weatherResponse(http.StatusOK, `{"list":[{"dt":1,"main":{"temp":17,"humidity":80},"pop":0.42,"weather":[{"icon":"10d","description":"rain","id":500}],"visibility":1000}]}`, nil), nil
	}))
	recorder := httptest.NewRecorder()
	weatherRouter(proxy).ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/weather/forecast?lat=44&lon=20&cnt=6", nil))
	want := `{"list":[{"dt":1,"main":{"temp":17},"pop":0.42,"weather":[{"icon":"10d","description":"rain"}]}]}`
	if recorder.Code != http.StatusOK || recorder.Body.String() != want {
		t.Fatalf("unexpected forecast response %d: %s", recorder.Code, recorder.Body.String())
	}
}

func TestWeatherProxyRejectsOversizedResponse(t *testing.T) {
	proxy := newWeatherProxy("key", roundTripFunc(func(*http.Request) (*http.Response, error) {
		return weatherResponse(http.StatusOK, strings.Repeat("x", weatherResponseMax+1), nil), nil
	}))
	recorder := httptest.NewRecorder()
	weatherRouter(proxy).ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/weather/current?lat=44&lon=20", nil))
	if recorder.Code != http.StatusBadGateway || strings.Contains(recorder.Body.String(), "xxxx") {
		t.Fatalf("oversized response was not safely rejected: %d %q", recorder.Code, recorder.Body.String())
	}
}

func TestWeatherProxyRateBudgetAndCacheAreBounded(t *testing.T) {
	proxy := newWeatherProxy("key", roundTripFunc(func(*http.Request) (*http.Response, error) {
		return weatherResponse(http.StatusOK, `{}`, nil), nil
	}))
	now := time.Now()
	for i := 0; i < weatherRateLimit; i++ {
		if !proxy.takeBudget(now) {
			t.Fatalf("budget rejected request %d", i+1)
		}
	}
	if proxy.takeBudget(now) {
		t.Fatal("budget allowed request 61 within one minute")
	}
	if !proxy.takeBudget(now.Add(weatherRateWindow)) {
		t.Fatal("budget did not reset after one minute")
	}
	for i := 0; i < weatherCacheMax+50; i++ {
		key := fmt.Sprintf("coordinate-%d", i)
		proxy.store(key, []byte(`{}`), now)
	}
	if len(proxy.cache) != weatherCacheMax || len(proxy.cacheOrder) != weatherCacheMax {
		t.Fatalf("cache sizes map=%d order=%d, want %d", len(proxy.cache), len(proxy.cacheOrder), weatherCacheMax)
	}
}

func TestWeatherProxyLimitsConcurrentUpstreamRequestsAndCaches(t *testing.T) {
	var active, maxActive, calls atomic.Int32
	proxy := newWeatherProxy("key", roundTripFunc(func(*http.Request) (*http.Response, error) {
		calls.Add(1)
		current := active.Add(1)
		for previous := maxActive.Load(); current > previous && !maxActive.CompareAndSwap(previous, current); previous = maxActive.Load() {
		}
		time.Sleep(15 * time.Millisecond)
		active.Add(-1)
		return weatherResponse(http.StatusOK, `{"main":{"temp":18},"weather":[{"icon":"01d","description":"clear"}]}`, nil), nil
	}))
	router := weatherRouter(proxy)
	var wait sync.WaitGroup
	for i := 0; i < 10; i++ {
		wait.Add(1)
		go func(index int) {
			defer wait.Done()
			recorder := httptest.NewRecorder()
			path := fmt.Sprintf("/api/weather/current?lat=44&lon=%d", index)
			router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
			if recorder.Code != http.StatusOK && recorder.Code != http.StatusTooManyRequests {
				t.Errorf("request %d returned unexpected status %d: %s", index, recorder.Code, recorder.Body.String())
			}
		}(i)
	}
	wait.Wait()
	if maxActive.Load() > 2 || maxActive.Load() == 0 {
		t.Fatalf("max concurrent upstream calls = %d, want 1 or 2", maxActive.Load())
	}
	if calls.Load() > 2 {
		t.Fatalf("upstream calls = %d, want at most 2 during concurrent overload", calls.Load())
	}
	first := httptest.NewRecorder()
	path := "/api/weather/current?lat=44&lon=50"
	router.ServeHTTP(first, httptest.NewRequest(http.MethodGet, path, nil))
	if first.Code != http.StatusOK {
		t.Fatalf("single request after overload returned %d", first.Code)
	}
	callsBeforeCacheHit := calls.Load()
	second := httptest.NewRecorder()
	router.ServeHTTP(second, httptest.NewRequest(http.MethodGet, path, nil))
	if second.Code != http.StatusOK || calls.Load() != callsBeforeCacheHit {
		t.Fatalf("cache miss on repeat: status=%d calls=%d prior=%d", second.Code, calls.Load(), callsBeforeCacheHit)
	}
}

func TestWeatherProxyCancelsSlowUpstreamWithoutLeakingDetails(t *testing.T) {
	proxy := newWeatherProxy("timeout-secret", roundTripFunc(func(request *http.Request) (*http.Response, error) {
		<-request.Context().Done()
		return nil, request.Context().Err()
	}))
	proxy.client.Timeout = 20 * time.Millisecond
	recorder := httptest.NewRecorder()
	started := time.Now()
	weatherRouter(proxy).ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/weather/current?lat=44&lon=20", nil))
	if time.Since(started) > time.Second || recorder.Code != http.StatusBadGateway {
		t.Fatalf("timeout not bounded: status=%d elapsed=%s", recorder.Code, time.Since(started))
	}
	if strings.Contains(recorder.Body.String(), "timeout-secret") || strings.Contains(recorder.Body.String(), "appid") {
		t.Fatal("timeout response leaked provider details")
	}
}
