# Node.js 18 버전 기반
FROM node:18

# 작업 디렉토리 생성
WORKDIR /app

# package.json 복사 후 의존성 설치
COPY package*.json ./
RUN npm install

# 나머지 코드 복사
COPY . .

# 컨테이너 안에서 열 포트
EXPOSE 8080

# 서버 실행 명령어
CMD ["node", "server.js"]
