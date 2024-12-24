package models

// APIKey configuration
type APIKey struct {
	Name  string `json:"name"` // Add this line
	URL   string `json:"url"`
	Key   string `json:"key"`
	API   string `json:"api"`
	V2Key string `json:"v2_key,omitempty"`
	V2IV  string `json:"v2_iv,omitempty"`
}

// Station represents a transit station
type Station struct {
	Name     string    `json:"name"`
	UID      int       `json:"uid"`
	ID       string    `json:"id"`
	StopID   string    `json:"stopId"`
	Coords   []string  `json:"coords"`
	Distance float64   `json:"distance,omitempty"`
	Vehicles []Vehicle `json:"vehicles"`
}

// Vehicle represents a transit vehicle
type Vehicle struct {
	LineNumber      string   `json:"lineNumber"`
	LineName        string   `json:"lineName"`
	SecondsLeft     int      `json:"secondsLeft"`
	StationsBetween int      `json:"stationsBetween"`
	GarageNo        string   `json:"garageNo"`
	Coords          []string `json:"coords"`
}
