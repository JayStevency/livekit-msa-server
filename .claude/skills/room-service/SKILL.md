---
name: room-service
description: Room Service 개발 가이드. 룸 생성/관리, 참가자 관리, LiveKit 룸 상태 동기화. room-service 폴더 작업 시 자동 활성화.
---

# Room Service 개발 가이드

## 역할

룸 생명주기와 참가자를 관리하는 마이크로서비스:
- 룸 생성/삭제/조회
- 참가자 입장/퇴장 관리
- LiveKit 룸 상태와 DB 동기화

## 디렉토리 구조

```
apps/room-service/src/
├── room-service.module.ts
├── room/
│   ├── room.module.ts
│   ├── room.controller.ts          # RPC Handler
│   ├── room.service.ts             # 룸 비즈니스 로직
│   ├── entities/
│   ├── repositories/
│   └── dto/
├── participant/
│   ├── participant.module.ts
│   ├── participant.controller.ts   # RPC Handler
│   ├── participant.service.ts      # 참가자 비즈니스 로직
│   ├── entities/
│   ├── repositories/
│   └── dto/
└── main.ts
```

## 체크리스트

- [ ] 룸 상태 관리 (ACTIVE, CLOSED 등)
- [ ] 참가자 수 제한 로직
- [ ] LiveKit 룸과 DB 동기화
- [ ] 룸 종료 시 정리 로직
