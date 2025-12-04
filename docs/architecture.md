# LiveKit MSA Server - 시스템 구조도

## 전체 아키텍처

```mermaid
flowchart TB
    subgraph clients["클라이언트 레이어"]
        WebClient["Web Client<br/>(Next.js)<br/>:3002"]
        MobileApp["Mobile App<br/>(Future)"]
    end

    subgraph gateway["API 게이트웨이 레이어"]
        APIGateway["API Gateway (NestJS)<br/>:3000"]

        subgraph controllers["Controllers"]
            RoomsCtrl["Rooms<br/>Controller"]
            HealthCtrl["Health<br/>Controller"]
            ChatCtrl["Chat<br/>Controller"]
        end
    end

    subgraph messaging["메시지 브로커 레이어"]
        RabbitMQ["RabbitMQ<br/>:5672 (AMQP)<br/>:15672 (UI)"]
        LiveKitQueue[["livekit_queue"]]
    end

    subgraph llm_layer["LLM 프로바이더 레이어"]
        Ollama["Ollama<br/>:11434<br/>(llama3.2, gemma2)"]
        OpenAI["OpenAI API<br/>(gpt-4, gpt-3.5)"]
        Claude["Claude API<br/>(claude-3-opus, sonnet)"]
        Gemini["Gemini API<br/>(gemini-pro, flash)"]
    end

    subgraph microservices["마이크로서비스 레이어"]
        LiveKitService["LiveKit Service<br/>(NestJS)"]
        LiveKitHandler["LiveKit Handler<br/>Service"]
    end

    subgraph realtime["실시간 통신 레이어"]
        LiveKitServer["LiveKit Server<br/>(WebRTC SFU)<br/>:7880 (HTTP API)<br/>:7881 (RTC)<br/>:7882/udp (UDP)"]

        subgraph room["Room"]
            User1["User<br/>Participant"]
            User2["User<br/>Participant"]
            VoiceAgentP["Voice Agent<br/>Participant"]
        end
    end

    subgraph voice_agent["Voice Agent 레이어"]
        VoiceAgent["Voice Agent (Python)"]

        subgraph pipeline["Audio Pipeline"]
            AudioIn["Audio<br/>Input"]
            VAD["VAD<br/>(Silero)"]
            STT["STT<br/>(Whisper)"]
            LLM["LLM<br/>Provider"]
            TTS["TTS<br/>(Edge TTS)"]
            AudioOut["Audio<br/>Output"]
        end
    end

    subgraph data["데이터 레이어"]
        PostgreSQL["PostgreSQL<br/>:5432"]
        Redis["Redis<br/>:6379"]
        OllamaModels["Ollama Models<br/>:11434"]

        subgraph tables["Tables"]
            rooms_table["rooms"]
            participants_table["participants"]
            recordings_table["recordings"]
        end
    end

    subgraph observability["Observability 레이어"]
        Jaeger["Jaeger<br/>:16686<br/>분산 트레이싱"]
        Loki["Loki<br/>:3100<br/>로그 수집"]
        Grafana["Grafana<br/>:3001<br/>대시보드"]
        Promtail["Promtail<br/>Docker 로그 수집"]
    end

    %% Client connections
    WebClient -->|HTTP/WebSocket| APIGateway
    MobileApp -->|HTTP/WebSocket| APIGateway

    %% Gateway to controllers
    APIGateway --> RoomsCtrl
    APIGateway --> HealthCtrl
    APIGateway --> ChatCtrl

    %% Controller connections
    RoomsCtrl -->|RabbitMQ RPC| RabbitMQ
    ChatCtrl -->|LLM Provider| Ollama

    %% RabbitMQ
    RabbitMQ --> LiveKitQueue
    LiveKitQueue --> LiveKitService

    %% Microservice to LiveKit
    LiveKitService --> LiveKitHandler
    LiveKitHandler --> LiveKitServer

    %% LiveKit Room
    LiveKitServer --> room
    User1 <-->|Audio/Video| User2
    User2 <-->|Audio/Video| VoiceAgentP

    %% Voice Agent
    VoiceAgentP -->|WebSocket| VoiceAgent
    AudioIn --> VAD
    VAD --> STT
    STT --> LLM
    LLM --> TTS
    TTS --> AudioOut

    %% LLM connections
    LLM -.->|default| Ollama
    LLM -.->|optional| OpenAI
    LLM -.->|optional| Claude
    LLM -.->|optional| Gemini

    %% Data connections
    LiveKitHandler --> PostgreSQL
    PostgreSQL --> tables
    APIGateway --> Redis

    %% Observability
    Promtail -->|Docker logs| Loki
    Loki --> Grafana
    Jaeger --> Grafana
```

## 서비스 연결 상세

```mermaid
flowchart LR
    subgraph external["외부"]
        Client["Client"]
    end

    subgraph docker["Docker Network"]
        AG["API Gateway<br/>:3000"]
        LS["LiveKit Service"]
        LK["LiveKit Server<br/>:7880"]
        VA["Voice Agent"]
        RMQ["RabbitMQ<br/>:5672"]
        PG["PostgreSQL<br/>:5432"]
        RD["Redis<br/>:6379"]
        OL["Ollama<br/>:11434"]
    end

    Client -->|REST API| AG
    Client -->|WebSocket| LK
    AG <-->|AMQP| RMQ
    RMQ <-->|AMQP| LS
    LS -->|HTTP| LK
    VA -->|WebSocket| LK
    VA -->|HTTP| OL
    AG -->|TCP| RD
    LS -->|TCP| PG
```

## 데이터 흐름

### 1. 방 생성 및 입장 플로우

```mermaid
sequenceDiagram
    participant C as Client
    participant AG as API Gateway
    participant RMQ as RabbitMQ
    participant LS as LiveKit Service
    participant LK as LiveKit Server
    participant PG as PostgreSQL

    C->>AG: POST /rooms (방 생성)
    AG->>RMQ: RPC Request
    RMQ->>LS: Consume Message
    LS->>LK: createRoom()
    LK-->>LS: Room Created
    LS->>PG: Save Room Info
    LS-->>RMQ: RPC Response
    RMQ-->>AG: Response
    AG-->>C: Room Info

    C->>AG: POST /rooms/:name/join
    AG->>RMQ: RPC Request
    RMQ->>LS: Consume Message
    LS->>LK: Generate JWT Token
    LK-->>LS: Token
    LS-->>RMQ: RPC Response
    RMQ-->>AG: Token + wsUrl
    AG-->>C: {token, wsUrl}

    C->>LK: WebSocket Connect (JWT)
    LK-->>C: Connected to Room
```

### 2. Voice Agent 대화 플로우

```mermaid
sequenceDiagram
    participant U as User
    participant LK as LiveKit Server
    participant VA as Voice Agent
    participant VAD as Silero VAD
    participant STT as Whisper
    participant LLM as LLM Provider
    participant TTS as Edge TTS

    U->>LK: Audio Stream
    LK->>VA: Forward Audio

    loop Audio Processing
        VA->>VAD: Audio Frame
        VAD-->>VA: Speech Detected
    end

    Note over VA: Speech End (Silence)

    VA->>STT: Audio Frames
    STT-->>VA: Transcribed Text

    VA->>LLM: User Message
    LLM-->>VA: AI Response

    VA->>TTS: Response Text
    TTS-->>VA: Audio Data

    VA->>LK: Audio Response
    LK->>U: Forward Audio
```

### 3. Voice Agent 오디오 파이프라인

```mermaid
flowchart LR
    subgraph input["입력"]
        AI["Audio Input<br/>(48kHz)"]
    end

    subgraph processing["처리"]
        VAD["VAD<br/>(Silero)"]
        STT["STT<br/>(Whisper)"]
        LLM["LLM<br/>(Ollama/OpenAI/Claude)"]
        TTS["TTS<br/>(Edge TTS)"]
    end

    subgraph output["출력"]
        AO["Audio Output<br/>(24kHz)"]
    end

    AI -->|"Speech Detection"| VAD
    VAD -->|"음성 구간"| STT
    STT -->|"텍스트"| LLM
    LLM -->|"응답 텍스트"| TTS
    TTS -->|"음성 합성"| AO
```

## 공유 라이브러리 (libs/)

```mermaid
graph TD
    subgraph apps["Applications"]
        AG["api-gateway"]
        LS["livekit-service"]
        RS["room-service"]
    end

    subgraph libs["Shared Libraries"]
        Core["@app/core<br/>공통 설정, Config"]
        Shared["@app/shared<br/>DTO, 인터페이스, 상수"]
        RabbitMQ["@app/rabbitmq<br/>RabbitMQ 연결, RPC"]
        Prisma["@app/prisma<br/>Prisma ORM"]
        LiveKit["@app/livekit<br/>LiveKit SDK"]
        LLMLib["@app/llm<br/>Multi-provider LLM"]
        RedisLib["@app/redis<br/>Redis 연결"]
        Telemetry["@app/telemetry<br/>OpenTelemetry"]
    end

    AG --> Core
    AG --> Shared
    AG --> RabbitMQ
    AG --> RedisLib
    AG --> LLMLib

    LS --> Core
    LS --> Shared
    LS --> RabbitMQ
    LS --> LiveKit
    LS --> Prisma

    RS --> Core
    RS --> Shared
    RS --> Prisma
```

## 포트 정보

| 서비스 | 포트 | 설명 |
|--------|------|------|
| API Gateway | 3000 | REST API 엔드포인트 |
| Web Client | 3002 | Next.js 웹 클라이언트 |
| LiveKit Server | 7880, 7881, 7882/udp | WebRTC SFU |
| PostgreSQL | 5432 | 데이터베이스 |
| Redis | 6379 | 캐시/세션 |
| RabbitMQ | 5672, 15672 | 메시지 브로커 |
| Ollama | 11434 | 로컬 LLM |
| Grafana | 3001 | 모니터링 대시보드 |
| Jaeger | 16686 | 분산 트레이싱 UI |
| Loki | 3100 | 로그 수집 |

## 환경 변수

### LLM Provider 설정

```env
# LLM Provider 선택 (ollama, openai, claude, gemini)
LLM_PROVIDER=ollama

# Ollama
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4

# Claude
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-3-sonnet-20240229

# Gemini
GOOGLE_API_KEY=...
GEMINI_MODEL=gemini-pro
```

### Voice Agent 설정

```env
# Whisper STT
WHISPER_MODEL_SIZE=base
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8

# TTS
TTS_VOICE=ko-KR-SunHiNeural

# Turn Detection
TURN_DETECTION_SILENCE_MS=800
TURN_DETECTION_MIN_SPEECH_MS=300
```
