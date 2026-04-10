---
name: backend
description: Backend 비즈니스 로직 개발 가이드. Domain Module, Repository, Service, Controller, Entity/DTO 정의. backend 폴더 작업 시 자동 활성화.
---

# Backend 개발 가이드

## 아키텍처

```
Client → API Gateway (GraphQL) → [RabbitMQ RPC] → Backend → Prisma → PostgreSQL
```

## 디렉토리 구조

```
apps/backend/src/{domain}/
├── {domain}.module.ts
├── {domain}.controller.ts      # RPC MessagePattern 핸들러
├── {domain}.service.ts         # 비즈니스 로직
├── {domain}.service.spec.ts    # 단위 테스트
├── entities/
│   ├── {domain}.entity.ts      # Entity Interface 정의
│   └── index.ts
├── repositories/
│   ├── {domain}.repository.ts  # BaseRepository 상속
│   └── index.ts
├── dto/
│   ├── {domain}.dto.ts         # Entity/Request/Response DTO 모두 여기에
│   └── index.ts
└── index.ts
```

## 0. Prisma Schema 정의

새 모델 추가 시:

```prisma
// prisma/schema.prisma
model Room {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

```bash
# 마이그레이션 실행
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/livekit_msa?schema=public" \
  npx prisma migrate dev --name add_room_model

# Prisma Client 타입 생성 (마이그레이션 시 자동 실행)
pnpm prisma:generate
```

## 1. Entity Interface 정의

Prisma 모델 기반 인터페이스 + **컴파일 타임 동기화 검증**:

```typescript
// apps/backend/src/room/entities/room.entity.ts
import { Room } from '@prisma/client';

export interface IRoomEntity {
  id: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

// Prisma 스키마 동기화 검증
type RoomRelationFields = 'participants'; // relation 필드 제외
type PrismaRoomScalar = Omit<Room, RoomRelationFields>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ValidateRoomEntity = IRoomEntity extends PrismaRoomScalar
  ? PrismaRoomScalar extends IRoomEntity
    ? true
    : never
  : never;
```

## 2. Repository 구현

`BaseRepository<T>` 상속:

```typescript
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { BaseRepository, PrismaService } from '@app/prisma';

@Injectable()
export class RoomRepository extends BaseRepository<'Room'> {
  constructor(
    prisma: PrismaService,
    txHost: TransactionHost<TransactionalAdapterPrisma>,
    @InjectPinoLogger('prisma:query') logger: PinoLogger,
  ) {
    super(prisma, 'room', txHost, logger);
  }
}
```

**BaseRepository 메서드:**
- `create`, `createMany`, `findById`, `findFirst`, `findMany`
- `paginate`, `paginateCursor`, `count`
- `update`, `updateMany`, `delete`, `deleteMany`, `upsert`, `exists`

## 3. DTO 정의

Entity Interface implement + GraphQL 데코레이터:

```typescript
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { IRoomEntity } from '../entities';

@ObjectType()
export class RoomDto implements IRoomEntity {
  @Field(() => ID)
  id: number;

  @Field()
  name: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
```

**DTO 타입 참조 규칙:**
- DTO에서 Prisma 타입 직접 참조 금지
- Entity의 indexed type 참조 사용
- 의존성 흐름: `Prisma → Entity → DTO`

## 4. Service 구현

```typescript
@Injectable()
export class RoomService {
  constructor(private readonly roomRepository: RoomRepository) {}

  async findById(id: number): Promise<RoomDto | null> {
    const room = await this.roomRepository.findById(id);
    if (!room) return null;
    return RoomDto.fromEntity(room);
  }
}
```

## 5. Controller (RPC Handler)

```typescript
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller()
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @MessagePattern('room.findById')
  async findById(@Payload() payload: { id: number }): Promise<RoomDto | null> {
    return this.roomService.findById(payload.id);
  }
}
```

## 6. Module 등록

```typescript
// apps/backend/src/room/room.module.ts
@Module({
  controllers: [RoomController],
  providers: [RoomRepository, RoomService],
  exports: [RoomService],
})
export class RoomModule {}

// apps/backend/src/backend.module.ts
@Module({
  imports: [
    CoreModule.forRoot('backend'),
    PrismaModule,
    RoomModule,  // 추가
  ],
})
export class BackendModule {}
```

## 네이밍 컨벤션

### Message Pattern

```
{domain}.{action}
```

예: `room.create`, `room.findById`, `participant.join`, `participant.leave`

### DTO 네이밍

| 타입 | 패턴 | 예시 |
|------|------|------|
| Entity DTO | `{Domain}Dto` | `RoomDto`, `ParticipantDto` |
| Request DTO | `{Action}{Domain}ReqDto` | `CreateRoomReqDto` |
| Response DTO | `{Action}{Domain}ResDto` | `CreateRoomResDto` |

**주의사항:**
- DTO는 반드시 `class`로 정의 (`interface` 사용 금지)
- Service 파일에서 DTO 정의 금지 (반드시 `dto/` 폴더에)
- Entity/Request/Response DTO 모두 `{domain}.dto.ts`에 함께 정의

## 테스트

```bash
# Unit Test
pnpm run test:backend

# E2E Test
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/livekit_msa?schema=public" \
  pnpm run test:e2e:backend
```

## 체크리스트

- [ ] Prisma Schema 모델 추가 및 마이그레이션
- [ ] Entity Interface 정의 (`entities/`, Prisma 동기화 검증 타입 추가)
- [ ] Repository 구현 (`repositories/`, BaseRepository 상속)
- [ ] DTO 정의 (`dto/`, `implements`, `@ObjectType`, `fromEntity`)
- [ ] Service 구현 (Repository 주입)
- [ ] Controller 구현 (MessagePattern)
- [ ] Module 등록 + BackendModule에 import
- [ ] 단위 테스트 작성
