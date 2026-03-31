package gtfs

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DBStore provides PostgreSQL persistence for GTFS data.
type DBStore struct{}

// CreateSchema creates all required tables in the transit schema (idempotent).
func (DBStore) CreateSchema(ctx context.Context, db *pgxpool.Pool) error {
	statements := []string{
		`CREATE SCHEMA IF NOT EXISTS transit`,

		`CREATE TABLE IF NOT EXISTS transit.gtfs_stops (
			city      TEXT,
			stop_id   TEXT,
			stop_code TEXT,
			name      TEXT,
			lat       FLOAT8,
			lon       FLOAT8,
			PRIMARY KEY (city, stop_id)
		)`,

		`CREATE TABLE IF NOT EXISTS transit.gtfs_routes (
			city        TEXT,
			route_id    TEXT,
			short_name  TEXT,
			long_name   TEXT,
			color       TEXT,
			text_color  TEXT,
			fare_amount FLOAT8,
			PRIMARY KEY (city, route_id)
		)`,

		`CREATE TABLE IF NOT EXISTS transit.gtfs_trips (
			city       TEXT,
			trip_id    TEXT,
			route_id   TEXT,
			service_id TEXT,
			headsign   TEXT,
			shape_id   TEXT,
			PRIMARY KEY (city, trip_id)
		)`,

		`CREATE TABLE IF NOT EXISTS transit.gtfs_stop_times (
			city              TEXT,
			stop_id           TEXT,
			trip_id           TEXT,
			departure_seconds INT,
			stop_sequence     INT
		)`,

		`CREATE INDEX IF NOT EXISTS gtfs_stop_times_stop_idx
			ON transit.gtfs_stop_times (city, stop_id)`,

		`CREATE TABLE IF NOT EXISTS transit.gtfs_calendar (
			city       TEXT,
			service_id TEXT,
			mon        BOOL,
			tue        BOOL,
			wed        BOOL,
			thu        BOOL,
			fri        BOOL,
			sat        BOOL,
			sun        BOOL,
			start_date TEXT,
			end_date   TEXT,
			PRIMARY KEY (city, service_id)
		)`,

		`CREATE TABLE IF NOT EXISTS transit.gtfs_calendar_dates (
			city           TEXT,
			service_id     TEXT,
			date           TEXT,
			exception_type INT,
			PRIMARY KEY (city, service_id, date)
		)`,

		`CREATE TABLE IF NOT EXISTS transit.gtfs_shapes (
			city     TEXT,
			shape_id TEXT,
			lat      FLOAT8,
			lon      FLOAT8,
			sequence INT,
			PRIMARY KEY (city, shape_id, sequence)
		)`,

		`CREATE TABLE IF NOT EXISTS transit.gtfs_metadata (
			city      TEXT PRIMARY KEY,
			loaded_at TIMESTAMPTZ
		)`,

		// Live API station cache
		`CREATE TABLE IF NOT EXISTS transit.live_stations (
			city       TEXT,
			station_id TEXT,
			uid        INT,
			name       TEXT,
			lat        TEXT,
			lon        TEXT,
			PRIMARY KEY (city, station_id)
		)`,

		`CREATE TABLE IF NOT EXISTS transit.live_stations_metadata (
			city      TEXT PRIMARY KEY,
			loaded_at TIMESTAMPTZ
		)`,
	}

	for _, stmt := range statements {
		if _, err := db.Exec(ctx, stmt); err != nil {
			return fmt.Errorf("CreateSchema exec: %w\nSQL: %s", err, stmt)
		}
	}
	log.Println("GTFS DB: schema created/verified")
	return nil
}

// SaveToDB deletes existing rows for city and bulk-inserts all GTFS data.
// Uses CopyFrom for high-throughput inserts of large tables like stop_times.
func (DBStore) SaveToDB(ctx context.Context, db *pgxpool.Pool, city string, d *Data) error {
	log.Printf("GTFS DB: saving city %q to database", city)

	tx, err := db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Delete existing data for city
	tables := []string{
		"transit.gtfs_stop_times",
		"transit.gtfs_shapes",
		"transit.gtfs_trips",
		"transit.gtfs_routes",
		"transit.gtfs_stops",
		"transit.gtfs_calendar",
		"transit.gtfs_calendar_dates",
	}
	for _, tbl := range tables {
		if _, err := tx.Exec(ctx, fmt.Sprintf("DELETE FROM %s WHERE city = $1", tbl), city); err != nil {
			return fmt.Errorf("delete %s: %w", tbl, err)
		}
	}
	log.Printf("GTFS DB: cleared existing rows for city %q", city)

	// --- Stops ---
	stopRows := make([][]interface{}, 0, len(d.Stops))
	for _, s := range d.Stops {
		stopRows = append(stopRows, []interface{}{city, s.StopID, s.StopCode, s.Name, s.Lat, s.Lon})
	}
	n, err := tx.CopyFrom(ctx,
		pgx.Identifier{"transit", "gtfs_stops"},
		[]string{"city", "stop_id", "stop_code", "name", "lat", "lon"},
		pgx.CopyFromRows(stopRows),
	)
	if err != nil {
		return fmt.Errorf("copy stops: %w", err)
	}
	log.Printf("GTFS DB: inserted %d stops", n)

	// --- Routes ---
	routeRows := make([][]interface{}, 0, len(d.Routes))
	for routeID, r := range d.Routes {
		routeRows = append(routeRows, []interface{}{city, routeID, r.ShortName, r.LongName, r.Color, r.TextColor, r.FareAmount})
	}
	n, err = tx.CopyFrom(ctx,
		pgx.Identifier{"transit", "gtfs_routes"},
		[]string{"city", "route_id", "short_name", "long_name", "color", "text_color", "fare_amount"},
		pgx.CopyFromRows(routeRows),
	)
	if err != nil {
		return fmt.Errorf("copy routes: %w", err)
	}
	log.Printf("GTFS DB: inserted %d routes", n)

	// --- Trips ---
	tripRows := make([][]interface{}, 0, len(d.Trips))
	for tripID, t := range d.Trips {
		tripRows = append(tripRows, []interface{}{city, tripID, t.RouteID, t.ServiceID, t.Headsign, t.ShapeID})
	}
	n, err = tx.CopyFrom(ctx,
		pgx.Identifier{"transit", "gtfs_trips"},
		[]string{"city", "trip_id", "route_id", "service_id", "headsign", "shape_id"},
		pgx.CopyFromRows(tripRows),
	)
	if err != nil {
		return fmt.Errorf("copy trips: %w", err)
	}
	log.Printf("GTFS DB: inserted %d trips", n)

	// --- Stop times (large: 2.3M rows) ---
	// Flatten stop_id -> []StopTime into rows; use stop_sequence as index within stop's slice.
	totalStopTimes := 0
	for _, times := range d.StopTimes {
		totalStopTimes += len(times)
	}
	log.Printf("GTFS DB: preparing %d stop_times rows...", totalStopTimes)

	stopTimeRows := make([][]interface{}, 0, totalStopTimes)
	for stopID, times := range d.StopTimes {
		for seq, st := range times {
			stopTimeRows = append(stopTimeRows, []interface{}{city, stopID, st.TripID, st.DepartureTime, seq})
		}
	}
	n, err = tx.CopyFrom(ctx,
		pgx.Identifier{"transit", "gtfs_stop_times"},
		[]string{"city", "stop_id", "trip_id", "departure_seconds", "stop_sequence"},
		pgx.CopyFromRows(stopTimeRows),
	)
	if err != nil {
		return fmt.Errorf("copy stop_times: %w", err)
	}
	log.Printf("GTFS DB: inserted %d stop_times", n)

	// --- Calendar ---
	calRows := make([][]interface{}, 0, len(d.calendar))
	for sid, rule := range d.calendar {
		calRows = append(calRows, []interface{}{
			city, sid,
			rule.Weekdays[0], rule.Weekdays[1], rule.Weekdays[2], rule.Weekdays[3],
			rule.Weekdays[4], rule.Weekdays[5], rule.Weekdays[6],
			rule.StartDate, rule.EndDate,
		})
	}
	n, err = tx.CopyFrom(ctx,
		pgx.Identifier{"transit", "gtfs_calendar"},
		[]string{"city", "service_id", "mon", "tue", "wed", "thu", "fri", "sat", "sun", "start_date", "end_date"},
		pgx.CopyFromRows(calRows),
	)
	if err != nil {
		return fmt.Errorf("copy calendar: %w", err)
	}
	log.Printf("GTFS DB: inserted %d calendar rules", n)

	// --- Calendar dates ---
	calDateRows := make([][]interface{}, 0)
	for sid, exceptions := range d.calendarDates {
		for _, ex := range exceptions {
			calDateRows = append(calDateRows, []interface{}{city, sid, ex.Date, ex.ExceptionType})
		}
	}
	n, err = tx.CopyFrom(ctx,
		pgx.Identifier{"transit", "gtfs_calendar_dates"},
		[]string{"city", "service_id", "date", "exception_type"},
		pgx.CopyFromRows(calDateRows),
	)
	if err != nil {
		return fmt.Errorf("copy calendar_dates: %w", err)
	}
	log.Printf("GTFS DB: inserted %d calendar_date exceptions", n)

	// --- Shapes ---
	totalShapePoints := 0
	for _, pts := range d.Shapes {
		totalShapePoints += len(pts)
	}
	shapeRows := make([][]interface{}, 0, totalShapePoints)
	for shapeID, pts := range d.Shapes {
		for seq, pt := range pts {
			shapeRows = append(shapeRows, []interface{}{city, shapeID, pt.Lat, pt.Lon, seq})
		}
	}
	n, err = tx.CopyFrom(ctx,
		pgx.Identifier{"transit", "gtfs_shapes"},
		[]string{"city", "shape_id", "lat", "lon", "sequence"},
		pgx.CopyFromRows(shapeRows),
	)
	if err != nil {
		return fmt.Errorf("copy shapes: %w", err)
	}
	log.Printf("GTFS DB: inserted %d shape points", n)

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}

	// Update metadata (outside main transaction so it's visible immediately)
	_, err = db.Exec(ctx,
		`INSERT INTO transit.gtfs_metadata (city, loaded_at)
		 VALUES ($1, NOW())
		 ON CONFLICT (city) DO UPDATE SET loaded_at = NOW()`,
		city,
	)
	if err != nil {
		return fmt.Errorf("update metadata: %w", err)
	}

	// Enable lazy DB queries and free in-memory StopTimes/Shapes
	d.DB = db
	d.City = city
	d.StopTimes = nil
	d.Shapes = nil

	log.Printf("GTFS DB: save complete for city %q (StopTimes/Shapes freed from memory)", city)
	return nil
}

// LoadFromDB reconstructs a Data struct from the database for the given city.
// StopTimes and Shapes are NOT loaded into memory — they are queried lazily via DB.
func (DBStore) LoadFromDB(ctx context.Context, db *pgxpool.Pool, city string) (*Data, error) {
	log.Printf("GTFS DB: loading city %q from database (lazy mode — StopTimes/Shapes via DB)", city)

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
		DB:               db,
		City:             city,
	}

	// --- Stops ---
	rows, err := db.Query(ctx,
		`SELECT stop_id, stop_code, name, lat, lon FROM transit.gtfs_stops WHERE city = $1`, city)
	if err != nil {
		return nil, fmt.Errorf("query stops: %w", err)
	}
	for rows.Next() {
		var s Stop
		if err := rows.Scan(&s.StopID, &s.StopCode, &s.Name, &s.Lat, &s.Lon); err != nil {
			rows.Close()
			return nil, fmt.Errorf("scan stop: %w", err)
		}
		d.Stops[s.StopID] = &s
		if s.StopCode != "" {
			d.StopsByCode[s.StopCode] = &s
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("stops rows err: %w", err)
	}
	log.Printf("GTFS DB: loaded %d stops", len(d.Stops))

	// --- Routes ---
	rows, err = db.Query(ctx,
		`SELECT route_id, short_name, long_name, color, text_color, fare_amount FROM transit.gtfs_routes WHERE city = $1`, city)
	if err != nil {
		return nil, fmt.Errorf("query routes: %w", err)
	}
	for rows.Next() {
		var routeID string
		var r Route
		if err := rows.Scan(&routeID, &r.ShortName, &r.LongName, &r.Color, &r.TextColor, &r.FareAmount); err != nil {
			rows.Close()
			return nil, fmt.Errorf("scan route: %w", err)
		}
		d.Routes[routeID] = &r
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("routes rows err: %w", err)
	}
	log.Printf("GTFS DB: loaded %d routes", len(d.Routes))

	// --- Trips ---
	rows, err = db.Query(ctx,
		`SELECT trip_id, route_id, service_id, headsign, shape_id FROM transit.gtfs_trips WHERE city = $1`, city)
	if err != nil {
		return nil, fmt.Errorf("query trips: %w", err)
	}
	for rows.Next() {
		var tripID string
		var t Trip
		if err := rows.Scan(&tripID, &t.RouteID, &t.ServiceID, &t.Headsign, &t.ShapeID); err != nil {
			rows.Close()
			return nil, fmt.Errorf("scan trip: %w", err)
		}
		d.Trips[tripID] = &t
		// Rebuild RouteByShortName
		if route, ok := d.Routes[t.RouteID]; ok && route.ShortName != "" {
			d.RouteByShortName[route.ShortName] = t.RouteID
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("trips rows err: %w", err)
	}
	log.Printf("GTFS DB: loaded %d trips", len(d.Trips))

	// --- Stop times: lazy-loaded via DB queries (not kept in memory) ---
	var totalST int
	err = db.QueryRow(ctx,
		`SELECT COUNT(*) FROM transit.gtfs_stop_times WHERE city = $1`, city).Scan(&totalST)
	if err != nil {
		log.Printf("GTFS DB: could not count stop_times: %v", err)
	}
	log.Printf("GTFS DB: %d stop_times available via DB (not loaded into memory)", totalST)

	// --- Calendar ---
	rows, err = db.Query(ctx,
		`SELECT service_id, mon, tue, wed, thu, fri, sat, sun, start_date, end_date
		 FROM transit.gtfs_calendar WHERE city = $1`, city)
	if err != nil {
		return nil, fmt.Errorf("query calendar: %w", err)
	}
	for rows.Next() {
		var sid string
		var rule calendarRule
		if err := rows.Scan(
			&sid,
			&rule.Weekdays[0], &rule.Weekdays[1], &rule.Weekdays[2], &rule.Weekdays[3],
			&rule.Weekdays[4], &rule.Weekdays[5], &rule.Weekdays[6],
			&rule.StartDate, &rule.EndDate,
		); err != nil {
			rows.Close()
			return nil, fmt.Errorf("scan calendar: %w", err)
		}
		d.calendar[sid] = rule
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("calendar rows err: %w", err)
	}
	log.Printf("GTFS DB: loaded %d calendar rules", len(d.calendar))

	// --- Calendar dates ---
	rows, err = db.Query(ctx,
		`SELECT service_id, date, exception_type FROM transit.gtfs_calendar_dates WHERE city = $1`, city)
	if err != nil {
		return nil, fmt.Errorf("query calendar_dates: %w", err)
	}
	for rows.Next() {
		var sid string
		var ex calendarException
		if err := rows.Scan(&sid, &ex.Date, &ex.ExceptionType); err != nil {
			rows.Close()
			return nil, fmt.Errorf("scan calendar_date: %w", err)
		}
		d.calendarDates[sid] = append(d.calendarDates[sid], ex)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("calendar_dates rows err: %w", err)
	}

	// --- Shapes: lazy-loaded via DB queries (not kept in memory) ---
	var totalPts int
	err = db.QueryRow(ctx,
		`SELECT COUNT(*) FROM transit.gtfs_shapes WHERE city = $1`, city).Scan(&totalPts)
	if err != nil {
		log.Printf("GTFS DB: could not count shapes: %v", err)
	}
	log.Printf("GTFS DB: %d shape points available via DB (not loaded into memory)", totalPts)

	log.Printf("GTFS DB: load complete for city %q — %d stops, %d trips, %d routes (StopTimes+Shapes via DB)",
		city, len(d.Stops), len(d.Trips), len(d.Routes))
	return d, nil
}

// LiveStation represents a cached station from the live API.
type LiveStation struct {
	City      string
	StationID string
	UID       int
	Name      string
	Lat       string
	Lon       string
}

// SaveLiveStations saves live API station data to the database for a city.
func (DBStore) SaveLiveStations(ctx context.Context, db *pgxpool.Pool, city string, stations []LiveStation) error {
	tx, err := db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if _, err := tx.Exec(ctx, "DELETE FROM transit.live_stations WHERE city = $1", city); err != nil {
		return fmt.Errorf("delete live_stations: %w", err)
	}

	rows := make([][]interface{}, 0, len(stations))
	for _, s := range stations {
		rows = append(rows, []interface{}{city, s.StationID, s.UID, s.Name, s.Lat, s.Lon})
	}

	n, err := tx.CopyFrom(ctx,
		pgx.Identifier{"transit", "live_stations"},
		[]string{"city", "station_id", "uid", "name", "lat", "lon"},
		pgx.CopyFromRows(rows),
	)
	if err != nil {
		return fmt.Errorf("copy live_stations: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}

	_, err = db.Exec(ctx,
		`INSERT INTO transit.live_stations_metadata (city, loaded_at)
		 VALUES ($1, NOW())
		 ON CONFLICT (city) DO UPDATE SET loaded_at = NOW()`,
		city,
	)
	if err != nil {
		return fmt.Errorf("update live_stations_metadata: %w", err)
	}

	log.Printf("LiveStations DB: saved %d stations for %q", n, city)
	return nil
}

// LoadLiveStations loads cached live API stations from the database.
func (DBStore) LoadLiveStations(ctx context.Context, db *pgxpool.Pool, city string) ([]LiveStation, error) {
	rows, err := db.Query(ctx,
		`SELECT station_id, uid, name, lat, lon FROM transit.live_stations WHERE city = $1`, city)
	if err != nil {
		return nil, fmt.Errorf("query live_stations: %w", err)
	}
	defer rows.Close()

	var result []LiveStation
	for rows.Next() {
		var s LiveStation
		s.City = city
		if err := rows.Scan(&s.StationID, &s.UID, &s.Name, &s.Lat, &s.Lon); err != nil {
			return nil, fmt.Errorf("scan live_station: %w", err)
		}
		result = append(result, s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("live_stations rows err: %w", err)
	}

	log.Printf("LiveStations DB: loaded %d stations for %q", len(result), city)
	return result, nil
}

// AreLiveStationsFresh returns true if live station data for city is < maxAge old.
func (DBStore) AreLiveStationsFresh(ctx context.Context, db *pgxpool.Pool, city string, maxAge time.Duration) bool {
	var loadedAt time.Time
	err := db.QueryRow(ctx,
		`SELECT loaded_at FROM transit.live_stations_metadata WHERE city = $1`, city,
	).Scan(&loadedAt)
	if err != nil {
		return false
	}
	age := time.Since(loadedAt)
	fresh := age < maxAge
	log.Printf("LiveStations DB: %q loaded_at=%s age=%s fresh=%v", city, loadedAt.Format(time.RFC3339), age.Round(time.Second), fresh)
	return fresh
}

// IsDataFresh returns true if the city's GTFS data was loaded within maxAge.
func (DBStore) IsDataFresh(ctx context.Context, db *pgxpool.Pool, city string, maxAge time.Duration) bool {
	var loadedAt time.Time
	err := db.QueryRow(ctx,
		`SELECT loaded_at FROM transit.gtfs_metadata WHERE city = $1`, city,
	).Scan(&loadedAt)
	if err != nil {
		// No row or DB error — data is not fresh
		return false
	}
	age := time.Since(loadedAt)
	fresh := age < maxAge
	log.Printf("GTFS DB: metadata for %q: loaded_at=%s age=%s fresh=%v", city, loadedAt.Format(time.RFC3339), age.Round(time.Second), fresh)
	return fresh
}
