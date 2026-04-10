---
name: livekit-service
description: LiveKit Service 개발 가이드. LiveKit 서버 연동, 토큰 발급, Webhook 처리. livekit-service 폴더 작업 시 자동 활성화.
---

# LiveKit Service 개발 가이드

## 역할

LiveKit 서버와의 직접 연동을 담당하는 마이크로서비스:
- LiveKit Access Token 발급
- LiveKit Webhook 수신/처리
- LiveKit Room/Participant 관리 API 래핑

## 디렉토리 구조

```
apps/livekit-service/src/
├── livekit-service.module.ts
├── livekit-service.controller.ts   # RPC Handler
├── livekit-service.service.ts      # LiveKit SDK 호출
├── token/
│   ├── token.service.ts            # Access Token 생성
│   └── token.module.ts
├── webhook/
│   ├── webhook.controller.ts       # Webhook HTTP endpoint
│   ├── webhook.service.ts          # Webhook 이벤트 처리
│   └── webhook.module.ts
└── main.ts
```

## 체크리스트

- [ ] LiveKit SDK 버전 확인
- [ ] Token 발급 시 권한(grants) 설정 확인
- [ ] Webhook signature 검증 구현
- [ ] 이벤트 타입별 핸들러 구현
