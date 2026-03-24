# City Dashboard
City Dashboard is a real-time public transit information display for Serbian cities (Belgrade, Novi Sad, Niš). It's a React-based PWA that shows nearby bus stops with live arrival times based on the user's geolocation. The backend is written in Go.

## Features

- Real-time transport information for Belgrade, Novi Sad, and Niš
- GTFS static schedule fallback — when live data is unavailable, the app displays scheduled arrivals from official GTFS feeds (auto-downloaded daily from data.gov.rs)
- Route details: route colors, full-day schedule view, and route map
- Maintenance mode overlay when a city's API is down
- Circuit breaker to gracefully handle unresponsive city APIs
- PostgreSQL persistence for GTFS data (optional — server runs without Postgres)
- Responsive design for both desktop and mobile devices (PWA with background geolocation)
- Multi-language support (English, Russian, Serbian)
- Dark / light theme
- Caching mechanism to reduce API calls and improve performance

## Technologies Used

- **Frontend**: React, Tailwind CSS, Vite
- **Backend**: Go, Gin
- **Database**: PostgreSQL (optional, for GTFS data persistence)
- **Build Tools**: Docker, GitHub Actions

## Getting Started

### Prerequisites

- Node.js (v20 or later)
- Go (v1.21 or later)
- Docker (optional)
- PostgreSQL (optional, for GTFS data persistence)

### Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/dzarlax/city-dashboard.git
    cd city-dashboard
    ```

2. Install frontend dependencies:
    ```sh
    npm install
    ```

3. Set up environment variables:
    Create a `.env` file in the root directory and add the following variables:
    ```env
    REACT_APP_BELGRADE_LAT=44.7866
    REACT_APP_BELGRADE_LON=20.4489
    REACT_APP_SEARCH_RAD=500
    ```

### Running the Application

#### Development

1. Start the frontend development server:
    ```sh
    npm run dev
    ```

2. Start the backend server:
    ```sh
    cd src/server_go
    go run cmd/server/main.go
    ```

#### Production

1. Build the frontend:
    ```sh
    npm run build
    ```

2. Build and run the Docker containers:
    ```sh
    docker-compose up --build
    ```

### Deployment

The application can be deployed using GitHub Actions. The workflows are defined in the `.github/workflows` directory.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgements

- [React](https://reactjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Vite](https://vitejs.dev/)
- [Gin](https://gin-gonic.com/)
- [OpenWeatherMap](https://openweathermap.org/)

## Docker Compose Example

To start the backend using Docker Compose, you can use the following example:

```yaml
version: '3.8'

services:
  backend:
    image: dzarlax/city_dashboard:latest
    container_name: city_dashboard
    ports:
      - "3001:3001"
    environment:
      WEATHER_API_KEY: "openweather_api_key"
      BELGRADE_LAT: "default coordinates"
      BELGRADE_LON: "default coordinates"
      SEARCH_RAD: "desired radius"
      BG_API_NAME: "Beograd"
      BG_API_URL: "xxx"
      BG_API_KEY: "xxx"
      BG_API_V2_KEY: "xxx"
      BG_API_V2_IV: "xxx"
      NS_API_NAME: "Novi Sad"
      NS_API_URL: "xxx"
      NS_API_KEY: "xxx"
      NIS_API_NAME: "Niš"
      NIS_API_URL: "xxx"
      NIS_API_KEY: "xxx"
      DATABASE_URL: "postgres://user:pass@db:5432/city_dashboard"  # optional
    command: /app/server
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: city_dashboard
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

To start the backend service, run:

```sh
docker-compose up backend
```

> **Note:** PostgreSQL is optional. If `DATABASE_URL` is not set or the database is unreachable, the server will still run and keep GTFS data in memory.

## GTFS Static Schedule

The backend automatically downloads GTFS feeds from [data.gov.rs](https://data.gov.rs) on startup and refreshes them daily. This provides:

- **Schedule fallback** — when live arrival data is unavailable (e.g. API outage), scheduled arrival times are shown instead, marked with a clock icon
- **Route colors** — each line is displayed in its official color from the GTFS feed
- **Full-day schedule** — users can open a modal to see all departures for a route at a given stop
- **Route map** — visual route shape rendered from GTFS shape data
- **Circuit breaker** — if a city API returns errors repeatedly, the backend stops calling it and relies on GTFS data

GTFS data can be persisted to PostgreSQL (see Docker Compose example above) or kept in memory.

## Updating Transport Line Data

When transport line data changes (new lines, modified routes, etc.), update the line mappings:

1. Download the latest `lines` file from BG Prevoz
2. Place it in the project root directory
3. Run the update script:
    ```sh
    npm run update-lines
    ```

This generates:
- `src/client/line_mapping.json` - Maps line numbers to BG Prevoz IDs (for clickable links)
- `src/client/line_details.json` - Contains detailed route information (streets, type, category)

For more details, see [scripts/README.md](scripts/README.md)

## Credits

- Special thanks to [MikMik1011](https://github.com/MikMik1011/bgpp) for providing additional resources that helped shape this project.

