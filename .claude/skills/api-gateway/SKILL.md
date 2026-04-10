---
name: api-gateway
description: API Gateway 개발 가이드. GraphQL Resolver, Request DTO, Backend RPC 호출 패턴. api-gateway 폴더 작업 시 자동 활성화.
---

# API Gateway 개발 가이드

## 아키텍처

```
Client → API Gateway (GraphQL) → [RabbitMQ RPC] → Backend
```

## 디렉토리 구조

```
apps/api-gateway/src/{domain}/
├── {domain}.module.ts
├── {domain}.resolver.ts        # GraphQL Resolver
├── {domain}.service.ts         # Backend RPC 호출 (선택)
├── dto/
│   ├── {domain}.dto.ts         # Request DTO
│   └── index.ts
└── index.ts
```

## Backend DTO Import

`@backend/*` 경로로 Backend DTO import (tsconfig.json에 paths 설정됨):

```typescript
import { RoomDto } from '@backend/room/dto/room.dto';
```

## Request DTO 정의

Backend DTO를 상속받아 `PickType`으로 필요한 필드만 선택:

```typescript
// apps/api-gateway/src/room/dto/room.dto.ts
import { InputType, PickType } from '@nestjs/graphql';
import { RoomDto } from '@backend/room/dto/room.dto';

@InputType()
export class CreateRoomReqDto extends PickType(
  RoomDto,
  ['name'] as const,
  InputType,
) {}
```

**장점:** Backend DTO 필드 변경 시 컴파일 에러로 즉시 감지

## Resolver 구현

```typescript
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Inject, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { BACKEND_SERVICE } from '@app/shared';
import { firstValueFrom } from 'rxjs';
import { RoomDto } from '@backend/room/dto/room.dto';

@Resolver(() => RoomDto)
export class RoomResolver {
  constructor(
    @Inject(BACKEND_SERVICE) private readonly backendClient: ClientProxy,
  ) {}

  @Query(() => [RoomDto])
  async rooms(): Promise<RoomDto[]> {
    return firstValueFrom(
      this.backendClient.send('room.findAll', {}),
    );
  }

  @Mutation(() => RoomDto)
  async createRoom(
    @Args('input') input: CreateRoomReqDto,
  ): Promise<RoomDto> {
    return firstValueFrom(
      this.backendClient.send('room.create', { data: input }),
    );
  }
}
```

## Backend Client 등록 (최초 1회)

```typescript
// apps/api-gateway/src/app.module.ts
import { BACKEND_SERVICE, BACKEND_QUEUE } from '@app/shared';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: BACKEND_SERVICE,
        // RabbitMQ or TCP transport 설정
      },
    ]),
  ],
})
export class AppModule {}
```

## 테스트

```bash
# E2E Test
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/livekit_msa?schema=public" \
  pnpm run test:e2e:api-gateway
```

## 체크리스트

- [ ] Request DTO 정의 (`PickType`으로 Backend DTO 상속)
- [ ] Resolver 구현 (Backend RPC 호출)
- [ ] Module 등록
- [ ] 인증 Guard 적용 (필요시)
- [ ] Backend Client 등록 (새 서비스인 경우)
