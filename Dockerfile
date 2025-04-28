# Node.js 18-alpine 베이스
FROM node:18-alpine

WORKDIR /app

# 의존성만 먼저 설치 (cache 활용)
COPY package*.json ./
RUN npm install --production

# 앱 소스 복사
COPY . .

EXPOSE 8080
CMD ["node", "server.js"]
