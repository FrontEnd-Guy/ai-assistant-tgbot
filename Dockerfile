# Используем официальный образ Node.js версии 16 с Alpine Linux
FROM node:16-alpine

# Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

# Копируем файлы package.json и package-lock.json (или yarn.lock)
COPY package*.json ./

# Устанавливаем зависимости, используя npm ci для production build
RUN npm ci

# Копируем остальные файлы исходного кода приложения в контейнер
COPY . .

# Копируем конфигурационные файлы в контейнер
COPY config/default.json /app/config/default.json
COPY config/production.json /app/config/production.json

# Устанавливаем переменную окружения для порта и NODE_ENV
ENV PORT=3000
ENV NODE_ENV=production

# Открываем порт 3000 для доступа к приложению
EXPOSE $PORT

# Запускаем приложение
CMD ["npm", "start"]
