# 자체 QA

아래 체크리스트를 순서대로 수행합니다.

## 1. Docker 컨테이너 상태 확인

```bash
docker compose ps
```

- 모든 서비스가 `running` 상태인지 확인
- `unhealthy` 또는 `restarting` 상태 서비스 식별

## 2. 각 서비스 초기화 확인

```bash
# Backend 로그
docker logs livekit-msa-backend 2>&1 | grep -i "started\|listening\|error" | tail -10

# API Gateway 로그
docker logs livekit-msa-api-gateway 2>&1 | grep -i "started\|listening\|error" | tail -10

# LiveKit Service 로그
docker logs livekit-msa-livekit-service 2>&1 | grep -i "started\|listening\|error" | tail -10

# Room Service 로그
docker logs livekit-msa-room-service 2>&1 | grep -i "started\|listening\|error" | tail -10
```

## 3. Redis 상태 확인

```bash
docker exec livekit-msa-redis redis-cli PING
```

## 4. 최근 에러 로그 확인

```bash
# Backend 에러
docker logs livekit-msa-backend --since 5m 2>&1 | grep -i "error\|fail\|exception"

# API Gateway 에러
docker logs livekit-msa-api-gateway --since 5m 2>&1 | grep -i "error\|fail\|exception"

# LiveKit Service 에러
docker logs livekit-msa-livekit-service --since 5m 2>&1 | grep -i "error\|fail\|exception"

# Room Service 에러
docker logs livekit-msa-room-service --since 5m 2>&1 | grep -i "error\|fail\|exception"
```

## QA 결과 보고 형식

```
## QA 결과

| 항목 | 상태 | 비고 |
|------|------|------|
| Docker 컨테이너 | O/X | |
| Backend | O/X | |
| API Gateway | O/X | |
| LiveKit Service | O/X | |
| Room Service | O/X | |
| Redis | O/X | |
| 에러 로그 | O/X | |
```
