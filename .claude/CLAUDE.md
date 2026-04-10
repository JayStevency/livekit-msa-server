# livekit-msa-server 프로젝트 설정

## 코딩 규칙

### TypeScript 폴더 생성 시 index.ts 필수

TypeScript 폴더를 새로 생성할 때는 반드시 `index.ts` 파일을 함께 생성하세요.

```typescript
// index.ts - barrel export 파일
export * from './module-name.module';
export * from './module-name.service';
// ... 필요한 export 추가
```

이를 통해 import 경로를 깔끔하게 유지합니다:

```typescript
// Good
import { RoomService, RoomDto } from './room';

// Bad
import { RoomService } from './room/room.service';
import { RoomDto } from './room/dto/room.dto';
```
