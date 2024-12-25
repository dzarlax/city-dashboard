# City Dashboard
City Dashboard is a web application that provides real-time transport information and weather forecasts for various cities. The application is built using React for the frontend and Go for the backend.

## Features

- Real-time transport information for multiple cities
- Weather forecast for the next 12 hours
- Responsive design for both desktop and mobile devices
- Caching mechanism to reduce API calls and improve performance

## Technologies Used

- **Frontend**: React, Tailwind CSS, Vite
- **Backend**: Go, Gin, Axios
- **Build Tools**: Docker, GitHub Actions

## Getting Started

### Prerequisites

- Node.js (v20 or later)
- Docker
- Go (v1.21 or later)

### Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/your-username/city-dashboard.git
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
    REACT_APP_WEATHER_API_KEY=your_openweathermap_api_key
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
      WEATHER_API_KEY: "openweather_ali_key"
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
    command: /app/server
```

To start the backend service, run:

```sh
docker-compose up backend
```

## Credits

- Special thanks to [MikMik1011](https://github.com/MikMik1011/bgpp) for providing additional resources that helped shape this project.

