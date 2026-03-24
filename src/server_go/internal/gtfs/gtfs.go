package gtfs

import (
	"bufio"
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
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
	ShapeID   string
}

type Route struct {
	ShortName  string
	LongName   string
	Color      string
	TextColor  string
	FareAmount float64
}

// ShapePoint is a single lat/lon point on a route shape.
type ShapePoint struct {
	Lat float64
	Lon float64
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

// ScheduledDeparture is a simplified vehicle representation from GTFS schedule.
type ScheduledDeparture struct {
	LineNumber     string
	LineName       string
	SecondsLeft    int
	RouteColor     string
	RouteTextColor string
	FareAmount     float64
	FirstDeparture string // "04:10"
	LastDeparture  string // "24:35"
}

// DayRoute holds all departures for a route/headsign combination from a stop for a full day.
type DayRoute struct {
	LineNumber     string   `json:"line_number"`
	LineName       string   `json:"line_name"`
	RouteColor     string   `json:"route_color"`
	RouteTextColor string   `json:"route_text_color"`
	FareAmount     float64  `json:"fare_amount"`
	FirstDeparture string   `json:"first_departure"`
	LastDeparture  string   `json:"last_departure"`
	Departures     []string `json:"departures"`
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
	// shortName -> routeID
	RouteByShortName map[string]string
	// shapeID -> ordered []ShapePoint
	Shapes map[string][]ShapePoint
	// service_id -> calendar rule
	calendar map[string]calendarRule
	// service_id -> []exception
	calendarDates map[string][]calendarException
	// fare_id -> price (unexported, used during load only)
	farePrice map[string]float64
}

// Load reads all GTFS files from dir and returns a populated Data.
func Load(dir string) (*Data, error) {
	d := &Data{
		Stops:            make(map[string]*Stop),
		StopsByCode:      make(map[string]*Stop),
		StopTimes:        make(map[string][]StopTime),
		Trips:            make(map[string]*Trip),
		Routes:           make(map[string]*Route),
		RouteByShortName: make(map[string]string),
		Shapes:           make(map[string][]ShapePoint),
		calendar:         make(map[string]calendarRule),
		calendarDates:    make(map[string][]calendarException),
		farePrice:        make(map[string]float64),
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
		{"fare_attributes.txt", loadFareAttributes},
		{"fare_rules.txt", loadFareRules},
		{"shapes.txt", loadShapes},
	}

	for _, s := range steps {
		path := filepath.Join(dir, s.file)
		log.Printf("GTFS: loading %s", path)
		if err := s.fn(d, path); err != nil {
			return nil, fmt.Errorf("GTFS load %s: %w", s.file, err)
		}
	}

	// Sort each stop's StopTimes slice by DepartureTime.
	for stopID, times := range d.StopTimes {
		sort.Slice(times, func(i, j int) bool {
			return times[i].DepartureTime < times[j].DepartureTime
		})
		d.StopTimes[stopID] = times
	}

	log.Printf("GTFS: loaded %d stops, %d trips, %d routes, %d shapes",
		len(d.Stops), len(d.Trips), len(d.Routes), len(d.Shapes))
	return d, nil
}

// ScheduledArrivals returns upcoming departures for a GTFS stop_id within 2 hours of t.
// It scans ALL active stop times to compute FirstDeparture/LastDeparture per route+headsign,
// then emits one ScheduledDeparture per departure in the [now, now+2h] window, sorted by SecondsLeft.
func (d *Data) ScheduledArrivals(stopID string, t time.Time, maxResults int) []ScheduledDeparture {
	active := d.activeServiceIDs(t)
	if len(active) == 0 {
		return nil
	}

	nowSec := timeToSeconds(t)
	window := nowSec + 2*3600

	times := d.StopTimes[stopID]

	// Group ALL active departures by (routeID+"|"+headsign) to compute first/last.
	type groupKey struct {
		routeID  string
		headsign string
	}
	type groupMeta struct {
		minDep int
		maxDep int
		route  *Route
	}

	allGroups := make(map[groupKey]*groupMeta)

	for _, st := range times {
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
		k := groupKey{routeID: trip.RouteID, headsign: trip.Headsign}
		gm, ok := allGroups[k]
		if !ok {
			gm = &groupMeta{minDep: st.DepartureTime, maxDep: st.DepartureTime, route: route}
			allGroups[k] = gm
		} else {
			if st.DepartureTime < gm.minDep {
				gm.minDep = st.DepartureTime
			}
			if st.DepartureTime > gm.maxDep {
				gm.maxDep = st.DepartureTime
			}
		}
	}

	// Emit one ScheduledDeparture per upcoming departure in the 2h window.
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

		k := groupKey{routeID: trip.RouteID, headsign: trip.Headsign}
		gm := allGroups[k]

		dep := ScheduledDeparture{
			LineNumber:     route.ShortName,
			LineName:       trip.Headsign,
			SecondsLeft:    st.DepartureTime - nowSec,
			RouteColor:     route.Color,
			RouteTextColor: route.TextColor,
			FareAmount:     route.FareAmount,
		}
		if gm != nil {
			dep.FirstDeparture = secondsToHHMM(gm.minDep)
			dep.LastDeparture = secondsToHHMM(gm.maxDep)
		}
		results = append(results, dep)
		if len(results) >= maxResults {
			break
		}
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].SecondsLeft < results[j].SecondsLeft
	})
	return results
}

// FullDaySchedule returns all departures for the day grouped by route+headsign.
// Results are sorted by LineNumber; Departures within each DayRoute are sorted.
func (d *Data) FullDaySchedule(stopID string, t time.Time) []DayRoute {
	active := d.activeServiceIDs(t)
	if len(active) == 0 {
		return nil
	}

	times := d.StopTimes[stopID]

	type groupKey struct {
		routeID  string
		headsign string
	}
	type groupVal struct {
		route      *Route
		departures []int
	}

	groups := make(map[groupKey]*groupVal)
	var order []groupKey // preserve first-seen order before final sort

	for _, st := range times {
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
		k := groupKey{routeID: trip.RouteID, headsign: trip.Headsign}
		gv, ok := groups[k]
		if !ok {
			gv = &groupVal{route: route}
			groups[k] = gv
			order = append(order, k)
		}
		gv.departures = append(gv.departures, st.DepartureTime)
	}

	var result []DayRoute
	for _, k := range order {
		gv := groups[k]
		route := gv.route
		deps := gv.departures
		sort.Ints(deps)

		depStrings := make([]string, len(deps))
		for i, sec := range deps {
			depStrings[i] = secondsToHHMM(sec)
		}

		first, last := "", ""
		if len(deps) > 0 {
			first = secondsToHHMM(deps[0])
			last = secondsToHHMM(deps[len(deps)-1])
		}

		result = append(result, DayRoute{
			LineNumber:     route.ShortName,
			LineName:       k.headsign,
			RouteColor:     route.Color,
			RouteTextColor: route.TextColor,
			FareAmount:     route.FareAmount,
			FirstDeparture: first,
			LastDeparture:  last,
			Departures:     depStrings,
		})
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].LineNumber < result[j].LineNumber
	})
	return result
}

// ShapesForLine returns up to 2 shape point slices (directions A and B) for the given short name.
func (d *Data) ShapesForLine(shortName string) [][]ShapePoint {
	routeID, ok := d.RouteByShortName[shortName]
	if !ok {
		return nil
	}

	seen := make(map[string]bool)
	var result [][]ShapePoint

	for _, trip := range d.Trips {
		if trip.RouteID != routeID || trip.ShapeID == "" {
			continue
		}
		if seen[trip.ShapeID] {
			continue
		}
		seen[trip.ShapeID] = true
		if pts, ok2 := d.Shapes[trip.ShapeID]; ok2 {
			result = append(result, pts)
		}
		if len(result) >= 2 {
			break
		}
	}
	return result
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
		color := strings.ToUpper(col(row, header, "route_color"))
		textColor := strings.ToUpper(col(row, header, "route_text_color"))
		d.Routes[routeID] = &Route{
			ShortName: col(row, header, "route_short_name"),
			LongName:  col(row, header, "route_long_name"),
			Color:     color,
			TextColor: textColor,
		}
	})
}

func loadTrips(d *Data, path string) error {
	return readCSV(path, func(header map[string]int, row []string) {
		tripID := col(row, header, "trip_id")
		if tripID == "" {
			return
		}
		routeID := col(row, header, "route_id")
		shapeID := col(row, header, "shape_id")
		d.Trips[tripID] = &Trip{
			RouteID:   routeID,
			ServiceID: col(row, header, "service_id"),
			Headsign:  col(row, header, "trip_headsign"),
			ShapeID:   shapeID,
		}
		// Populate RouteByShortName using the already-loaded Routes map.
		if route, ok := d.Routes[routeID]; ok {
			if route.ShortName != "" {
				d.RouteByShortName[route.ShortName] = routeID
			}
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

func loadFareAttributes(d *Data, path string) error {
	return readCSV(path, func(header map[string]int, row []string) {
		fareID := col(row, header, "fare_id")
		priceStr := col(row, header, "price")
		if fareID == "" || priceStr == "" {
			return
		}
		price, err := strconv.ParseFloat(priceStr, 64)
		if err != nil {
			return
		}
		d.farePrice[fareID] = price
	})
}

func loadFareRules(d *Data, path string) error {
	return readCSV(path, func(header map[string]int, row []string) {
		fareID := col(row, header, "fare_id")
		routeID := col(row, header, "route_id")
		if fareID == "" || routeID == "" {
			return
		}
		if route, ok := d.Routes[routeID]; ok {
			route.FareAmount = d.farePrice[fareID]
		}
	})
}

func loadShapes(d *Data, path string) error {
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

	shapeIdx, hasShape := header["shape_id"]
	latIdx, hasLat := header["shape_pt_lat"]
	lonIdx, hasLon := header["shape_pt_lon"]
	if !hasShape || !hasLat || !hasLon {
		// shapes.txt missing required columns — skip silently
		return nil
	}

	count := 0
	for {
		row, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		if len(row) <= shapeIdx || len(row) <= latIdx || len(row) <= lonIdx {
			continue
		}
		shapeID := strings.TrimSpace(row[shapeIdx])
		latStr := strings.TrimSpace(row[latIdx])
		lonStr := strings.TrimSpace(row[lonIdx])
		if shapeID == "" {
			continue
		}
		lat, err1 := strconv.ParseFloat(latStr, 64)
		lon, err2 := strconv.ParseFloat(lonStr, 64)
		if err1 != nil || err2 != nil {
			continue
		}
		// Shapes are already ordered in the file — no sort needed.
		d.Shapes[shapeID] = append(d.Shapes[shapeID], ShapePoint{Lat: lat, Lon: lon})
		count++
	}
	log.Printf("GTFS: loaded %d shape points across %d shapes", count, len(d.Shapes))
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

// secondsToHHMM formats seconds-since-midnight as "HH:MM", supporting times >= 24h (e.g. "24:35").
func secondsToHHMM(sec int) string {
	h := sec / 3600
	m := (sec % 3600) / 60
	return fmt.Sprintf("%02d:%02d", h, m)
}
