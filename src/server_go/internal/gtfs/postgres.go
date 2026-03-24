package gtfs

import (
	"context"
	"fmt"
	"log"
	"sort"
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

	log.Printf("GTFS DB: save complete for city %q", city)
	return nil
}

// LoadFromDB reconstructs a full Data struct from the database for the given city.
func (DBStore) LoadFromDB(ctx context.Context, db *pgxpool.Pool, city string) (*Data, error) {
	log.Printf("GTFS DB: loading city %q from database", city)

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

	// --- Stop times ---
	rows, err = db.Query(ctx,
		`SELECT stop_id, trip_id, departure_seconds FROM transit.gtfs_stop_times WHERE city = $1`, city)
	if err != nil {
		return nil, fmt.Errorf("query stop_times: %w", err)
	}
	totalST := 0
	for rows.Next() {
		var stopID string
		var st StopTime
		if err := rows.Scan(&stopID, &st.TripID, &st.DepartureTime); err != nil {
			rows.Close()
			return nil, fmt.Errorf("scan stop_time: %w", err)
		}
		d.StopTimes[stopID] = append(d.StopTimes[stopID], st)
		totalST++
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("stop_times rows err: %w", err)
	}
	// Sort by DepartureTime per stop (mirroring the Load() behaviour)
	for stopID, times := range d.StopTimes {
		sort.Slice(times, func(i, j int) bool {
			return times[i].DepartureTime < times[j].DepartureTime
		})
		d.StopTimes[stopID] = times
	}
	log.Printf("GTFS DB: loaded %d stop_times across %d stops", totalST, len(d.StopTimes))

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

	// --- Shapes ---
	rows, err = db.Query(ctx,
		`SELECT shape_id, lat, lon FROM transit.gtfs_shapes WHERE city = $1 ORDER BY shape_id, sequence`, city)
	if err != nil {
		return nil, fmt.Errorf("query shapes: %w", err)
	}
	totalPts := 0
	for rows.Next() {
		var shapeID string
		var pt ShapePoint
		if err := rows.Scan(&shapeID, &pt.Lat, &pt.Lon); err != nil {
			rows.Close()
			return nil, fmt.Errorf("scan shape: %w", err)
		}
		d.Shapes[shapeID] = append(d.Shapes[shapeID], pt)
		totalPts++
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("shapes rows err: %w", err)
	}
	log.Printf("GTFS DB: loaded %d shape points across %d shapes", totalPts, len(d.Shapes))

	log.Printf("GTFS DB: load complete for city %q — %d stops, %d trips, %d routes, %d shapes",
		city, len(d.Stops), len(d.Trips), len(d.Routes), len(d.Shapes))
	return d, nil
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
