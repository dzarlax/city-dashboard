package gtfs

import (
	"bufio"
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// --- Data structures ---

type Stop struct {
	StopID   string
	StopCode string
	Name     string
	Lat      float64
	Lon      float64
}

type Trip struct {
	RouteID   string
	ServiceID string
	Headsign  string
}

type Route struct {
	ShortName string
	LongName  string
}

type StopTime struct {
	TripID        string
	DepartureTime int // seconds since midnight (may exceed 86400 for after-midnight trips)
}

type calendarRule struct {
	Weekdays  [7]bool // Mon=0 .. Sun=6
	StartDate string  // YYYYMMDD
	EndDate   string  // YYYYMMDD
}

type calendarException struct {
	Date          string // YYYYMMDD
	ExceptionType int    // 1=added, 2=removed
}

// Data holds the fully loaded GTFS dataset.
type Data struct {
	// stop_id -> Stop
	Stops map[string]*Stop
	// stop_code -> Stop  (for cross-referencing with legacy IDs)
	StopsByCode map[string]*Stop
	// stop_id -> []StopTime sorted by DepartureTime
	StopTimes map[string][]StopTime
	// trip_id -> Trip
	Trips map[string]*Trip
	// route_id -> Route
	Routes map[string]*Route
	// service_id -> calendar rule
	calendar map[string]calendarRule
	// service_id -> []exception
	calendarDates map[string][]calendarException
}

// Load reads all GTFS files from dir and returns a populated Data.
func Load(dir string) (*Data, error) {
	d := &Data{
		Stops:         make(map[string]*Stop),
		StopsByCode:   make(map[string]*Stop),
		StopTimes:     make(map[string][]StopTime),
		Trips:         make(map[string]*Trip),
		Routes:        make(map[string]*Route),
		calendar:      make(map[string]calendarRule),
		calendarDates: make(map[string][]calendarException),
	}

	steps := []struct {
		file string
		fn   func(*Data, string) error
	}{
		{"routes.txt", loadRoutes},
		{"trips.txt", loadTrips},
		{"stops.txt", loadStops},
		{"calendar.txt", loadCalendar},
		{"calendar_dates.txt", loadCalendarDates},
		{"stop_times.txt", loadStopTimes},
	}

	for _, s := range steps {
		path := filepath.Join(dir, s.file)
		log.Printf("GTFS: loading %s", path)
		if err := s.fn(d, path); err != nil {
			return nil, fmt.Errorf("GTFS load %s: %w", s.file, err)
		}
	}

	log.Printf("GTFS: loaded %d stops, %d trips, %d routes",
		len(d.Stops), len(d.Trips), len(d.Routes))
	return d, nil
}

// ScheduledArrivals returns the next N departures for a GTFS stop_id at the given time.
func (d *Data) ScheduledArrivals(stopID string, t time.Time, maxResults int) []ScheduledDeparture {
	active := d.activeServiceIDs(t)
	if len(active) == 0 {
		return nil
	}

	nowSec := timeToSeconds(t)
	// Also consider trips that departed after midnight (departure > 86400)
	// by checking [nowSec, nowSec + 2h]
	window := nowSec + 2*3600

	times := d.StopTimes[stopID]
	var results []ScheduledDeparture

	for _, st := range times {
		if st.DepartureTime < nowSec || st.DepartureTime > window {
			continue
		}
		trip := d.Trips[st.TripID]
		if trip == nil {
			continue
		}
		if !active[trip.ServiceID] {
			continue
		}
		route := d.Routes[trip.RouteID]
		if route == nil {
			continue
		}
		results = append(results, ScheduledDeparture{
			LineNumber:  route.ShortName,
			LineName:    trip.Headsign,
			SecondsLeft: st.DepartureTime - nowSec,
		})
		if len(results) >= maxResults {
			break
		}
	}
	return results
}

// ScheduledDeparture is a simplified vehicle representation from GTFS schedule.
type ScheduledDeparture struct {
	LineNumber  string
	LineName    string
	SecondsLeft int
}

// activeServiceIDs returns a set of service_ids valid for the given time.
func (d *Data) activeServiceIDs(t time.Time) map[string]bool {
	loc := t.Location()
	dateStr := t.Format("20060102")
	weekday := int(t.Weekday()+6) % 7 // Mon=0 .. Sun=6

	active := make(map[string]bool)

	for sid, rule := range d.calendar {
		if dateStr < rule.StartDate || dateStr > rule.EndDate {
			continue
		}
		_ = loc
		if rule.Weekdays[weekday] {
			active[sid] = true
		}
	}

	// Apply exceptions
	for sid, exceptions := range d.calendarDates {
		for _, ex := range exceptions {
			if ex.Date != dateStr {
				continue
			}
			if ex.ExceptionType == 1 {
				active[sid] = true
			} else if ex.ExceptionType == 2 {
				delete(active, sid)
			}
		}
	}

	return active
}

// --- Loaders ---

func loadStops(d *Data, path string) error {
	return readCSV(path, func(header map[string]int, row []string) {
		stopID := col(row, header, "stop_id")
		latStr := col(row, header, "stop_lat")
		lonStr := col(row, header, "stop_lon")
		if stopID == "" || latStr == "" || lonStr == "" {
			return
		}
		lat, err1 := strconv.ParseFloat(latStr, 64)
		lon, err2 := strconv.ParseFloat(lonStr, 64)
		if err1 != nil || err2 != nil {
			return
		}
		s := &Stop{
			StopID:   stopID,
			StopCode: col(row, header, "stop_code"),
			Name:     col(row, header, "stop_name"),
			Lat:      lat,
			Lon:      lon,
		}
		d.Stops[stopID] = s
		if s.StopCode != "" {
			d.StopsByCode[s.StopCode] = s
		}
	})
}

func loadRoutes(d *Data, path string) error {
	return readCSV(path, func(header map[string]int, row []string) {
		routeID := col(row, header, "route_id")
		if routeID == "" {
			return
		}
		d.Routes[routeID] = &Route{
			ShortName: col(row, header, "route_short_name"),
			LongName:  col(row, header, "route_long_name"),
		}
	})
}

func loadTrips(d *Data, path string) error {
	return readCSV(path, func(header map[string]int, row []string) {
		tripID := col(row, header, "trip_id")
		if tripID == "" {
			return
		}
		d.Trips[tripID] = &Trip{
			RouteID:   col(row, header, "route_id"),
			ServiceID: col(row, header, "service_id"),
			Headsign:  col(row, header, "trip_headsign"),
		}
	})
}

func loadCalendar(d *Data, path string) error {
	return readCSV(path, func(header map[string]int, row []string) {
		sid := col(row, header, "service_id")
		if sid == "" {
			return
		}
		days := [7]string{"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"}
		var wd [7]bool
		for i, day := range days {
			wd[i] = col(row, header, day) == "1"
		}
		d.calendar[sid] = calendarRule{
			Weekdays:  wd,
			StartDate: col(row, header, "start_date"),
			EndDate:   col(row, header, "end_date"),
		}
	})
}

func loadCalendarDates(d *Data, path string) error {
	return readCSV(path, func(header map[string]int, row []string) {
		sid := col(row, header, "service_id")
		dateStr := col(row, header, "date")
		exTypeStr := col(row, header, "exception_type")
		if sid == "" || dateStr == "" {
			return
		}
		exType, _ := strconv.Atoi(exTypeStr)
		d.calendarDates[sid] = append(d.calendarDates[sid], calendarException{
			Date:          dateStr,
			ExceptionType: exType,
		})
	})
}

func loadStopTimes(d *Data, path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	r := csv.NewReader(bufio.NewReaderSize(f, 1<<20)) // 1MB buffer
	r.ReuseRecord = true

	headerRow, err := r.Read()
	if err != nil {
		return err
	}
	header := buildHeader(headerRow)

	tripIdx := header["trip_id"]
	depIdx := header["departure_time"]
	stopIdx := header["stop_id"]

	count := 0
	for {
		row, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		if len(row) <= tripIdx || len(row) <= depIdx || len(row) <= stopIdx {
			continue
		}
		tripID := row[tripIdx]
		stopID := row[stopIdx]
		depSec := parseTime(row[depIdx])
		if depSec < 0 {
			continue
		}
		d.StopTimes[stopID] = append(d.StopTimes[stopID], StopTime{
			TripID:        strings.Clone(tripID), // avoid holding reference to reused slice
			DepartureTime: depSec,
		})
		count++
	}
	log.Printf("GTFS: loaded %d stop_times", count)
	return nil
}

// --- Helpers ---

func readCSV(path string, fn func(map[string]int, []string)) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	r := csv.NewReader(bufio.NewReader(f))
	headerRow, err := r.Read()
	if err != nil {
		return err
	}
	header := buildHeader(headerRow)

	for {
		row, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		fn(header, row)
	}
	return nil
}

func buildHeader(row []string) map[string]int {
	m := make(map[string]int, len(row))
	for i, v := range row {
		m[strings.TrimSpace(v)] = i
	}
	return m
}

func col(row []string, header map[string]int, name string) string {
	idx, ok := header[name]
	if !ok || idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[idx])
}

// parseTime converts "HH:MM:SS" (may be > 24:00:00) to seconds since midnight.
func parseTime(s string) int {
	parts := strings.SplitN(s, ":", 3)
	if len(parts) != 3 {
		return -1
	}
	h, err1 := strconv.Atoi(parts[0])
	m, err2 := strconv.Atoi(parts[1])
	sec, err3 := strconv.Atoi(parts[2])
	if err1 != nil || err2 != nil || err3 != nil {
		return -1
	}
	return h*3600 + m*60 + sec
}

func timeToSeconds(t time.Time) int {
	return t.Hour()*3600 + t.Minute()*60 + t.Second()
}
