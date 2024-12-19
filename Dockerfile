# Stage 1: Build
FROM node:20 AS build

WORKDIR /app

# Установите зависимости
COPY package*.json ./
RUN npm install

# Сборка клиента
COPY . .
RUN npm run build

# Stage 2: Run
FROM node:20

WORKDIR /app

# Копируем собранные файлы
COPY --from=build /app/dist /app/dist
COPY package*.json ./

# Установите зависимости для запуска
RUN npm install --production

# Указание портов
EXPOSE 3001 3000

# Запуск сервера и клиента
CMD ["npx", "concurrently", "npm run start:client", "npm run start:server"]