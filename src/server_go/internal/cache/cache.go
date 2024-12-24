package cache

import (
	"fmt"
	"sync"
	"time"
)

const (
	VEHICLE_CACHE_TTL = 30 * time.Second
	STATION_CACHE_TTL = 24 * time.Hour
)

type CacheEntry struct {
	Timestamp time.Time
	Data      interface{}
}

type Cache struct {
	stationCache map[string]CacheEntry
	vehicleCache map[string]CacheEntry
	mu           sync.RWMutex
}

func New() *Cache {
	return &Cache{
		stationCache: make(map[string]CacheEntry),
		vehicleCache: make(map[string]CacheEntry),
	}
}

func (c *Cache) getStationCacheKey(city, stationID string) string {
	return fmt.Sprintf("%s:%s", city, stationID)
}

func (c *Cache) getVehicleCacheKey(city, stationID string) string {
	return fmt.Sprintf("%s:%s:vehicles", city, stationID)
}

func (c *Cache) GetCachedStation(city, stationID string) (interface{}, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	key := c.getStationCacheKey(city, stationID)
	if entry, exists := c.stationCache[key]; exists {
		if time.Since(entry.Timestamp) < STATION_CACHE_TTL {
			return entry.Data, true
		}
	}
	return nil, false
}

func (c *Cache) GetCachedVehicles(city, stationID string) (interface{}, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	key := c.getVehicleCacheKey(city, stationID)
	if entry, exists := c.vehicleCache[key]; exists {
		if time.Since(entry.Timestamp) < VEHICLE_CACHE_TTL {
			return entry.Data, true
		}
	}
	return nil, false
}

func (c *Cache) SetCachedStation(city, stationID string, data interface{}) {
	c.mu.Lock()
	defer c.mu.Unlock()

	key := c.getStationCacheKey(city, stationID)
	c.stationCache[key] = CacheEntry{
		Timestamp: time.Now(),
		Data:      data,
	}
}

func (c *Cache) SetCachedVehicles(city, stationID string, data interface{}) {
	c.mu.Lock()
	defer c.mu.Unlock()

	key := c.getVehicleCacheKey(city, stationID)
	c.vehicleCache[key] = CacheEntry{
		Timestamp: time.Now(),
		Data:      data,
	}
}

func (c *Cache) ClearExpiredCache() {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()

	for key, entry := range c.stationCache {
		if now.Sub(entry.Timestamp) > STATION_CACHE_TTL {
			delete(c.stationCache, key)
		}
	}

	for key, entry := range c.vehicleCache {
		if now.Sub(entry.Timestamp) > VEHICLE_CACHE_TTL {
			delete(c.vehicleCache, key)
		}
	}
}
