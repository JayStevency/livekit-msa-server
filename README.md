# LiveKit MSA Server

NestJS 기반 LiveKit 연동 MSA 서버

## 프로젝트 구조

```
livekit-msa-server/
├── apps/
│   ├── api-gateway/          # REST API 게이트웨이 (HTTP → RabbitMQ)
│   ├── livekit-service/      # LiveKit SDK 연동 마이크로서비스
│   └── room-service/         # Room 관리 마이크로서비스 (DB + LiveKit)
├── libs/
│   ├── core/                 # 공통 설정 (Config, Logger, Telemetry)
│   ├── shared/               # 공유 DTO, 인터페이스, 상수
│   ├── rabbitmq/             # RabbitMQ 모듈 및 RPC 헬퍼
│   ├── prisma/               # Prisma 데이터베이스 모듈
│   ├── telemetry/            # OpenTelemetry 모듈
│   └── livekit/              # LiveKit SDK 래퍼 모듈
└── prisma/
    └── schema.prisma         # 데이터베이스 스키마
```

## 요구사항

- Node.js >= 22
- Docker & Docker Compose
- npm

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. Prisma 클라이언트 생성

```bash
npm run prisma:generate
```

### 3. 개발 환경 실행 (Docker Compose)

```bash
# 모든 서비스 시작
npm run docker:up

# 로그 확인
npm run docker:logs

# 서비스 중지
npm run docker:down
```

### 4. 로컬 개발 (개별 서비스)

```bash
# API Gateway 실행
npm run start:api-gateway:dev

# LiveKit Service 실행
npm run start:livekit-service:dev

# Room Service 실행
npm run start:room-service:dev
```

## 환경 변수

`.env` 파일을 프로젝트 루트에 생성:

```env
# App
APP_PORT=3000

# PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=livekit

# Prisma
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/livekit?schema=public"

# LiveKit
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_WS_URL=ws://localhost:7880
```

## API 엔드포인트

### Rooms

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/rooms` | 새 방 생성 |
| GET | `/rooms` | 모든 방 조회 |
| GET | `/rooms/:name` | 특정 방 조회 |
| DELETE | `/rooms/:name` | 방 삭제 |
| POST | `/rooms/:name/join` | 방 입장 (토큰 발급) |
| GET | `/rooms/:name/participants` | 참가자 목록 |
| DELETE | `/rooms/:name/participants/:identity` | 참가자 강제 퇴장 |
| POST | `/rooms/:name/participants/:identity/mute` | 참가자 음소거 |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | 헬스 체크 |
| GET | `/health/liveness` | Liveness probe |
| GET | `/health/readiness` | Readiness probe |

## Swagger 문서

서버 실행 후 http://localhost:3000/api 에서 확인

## 서비스 포트

| Service | Port |
|---------|------|
| API Gateway | 3000 |
| LiveKit Server | 7880 |
| RabbitMQ | 5672 (AMQP), 15672 (UI) |
| PostgreSQL | 5432 |
| Redis | 6379 |
| Jaeger UI | 16686 |
| Grafana | 3001 |
| Loki | 3100 |

## 기술 스택

- **Framework**: NestJS 11
- **Database**: PostgreSQL + Prisma
- **Message Broker**: RabbitMQ
- **WebRTC**: LiveKit
- **Observability**: OpenTelemetry, Jaeger, Loki, Grafana
- **Logging**: Pino
