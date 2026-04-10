# Git 커밋

Conventional Commits 스펙에 따라 커밋을 생성합니다.

## 사용법

```
/commit
```

## 절차

### 1. 변경 사항 확인

```bash
git diff --staged --stat
```

- 스테이징된 파일만 확인 (unstaged diff 생략)
- 스테이징된 변경이 없으면 `git status --short`로 unstaged 파일 목록만 보여주고 "스테이징된 변경 사항이 없습니다. `git add`로 파일을 스테이징해주세요." 출력 후 종료

### 2. 스테이징된 변경 내용 확인

```bash
git diff --staged
```

- 바이너리 파일은 diff 생략

### 3. 커밋 메시지 작성

**타입:**

| 타입       | 설명                                                   |
| ---------- | ------------------------------------------------------ |
| `feat`     | 새 API 엔드포인트 또는 새 sub application 추가         |
| `fix`      | 버그 수정                                              |
| `refactor` | 기존 기능 개선/변경, validation 추가, 로직 개선        |
| `test`     | 테스트 추가/수정                                       |
| `docs`     | 문서 추가/수정                                         |
| `build`    | Dockerfile, docker-compose, 빌드 스크립트              |
| `ci`       | GitHub Actions, workflows                              |
| `style`    | 코드 스타일 (동작 변경 없음)                           |
| `chore`    | 기타 잡다한 작업, 패키지 추가, 린트 설정               |

**스코프:**

- apps 하위 변경 → 해당 앱 이름 (예: `api-gateway`, `backend`, `livekit-service`, `room-service`)
- libs 하위 변경 → 해당 라이브러리 이름 (예: `core`, `redis`, `prisma`, `shared`, `agent-rpc`, `metrics`)
- infra/설정 변경 → `docker`, `prisma`, `deps` 등
- 여러 앱/라이브러리에 걸친 변경 → 스코프 생략

**형식:**
```
<type>(<scope>): <subject>
```

**규칙:**
- subject는 영문 소문자로 시작, 마침표 없음, 명령형 사용

### 4. 커밋 실행

```bash
git commit -m "$(cat <<'EOF'
<커밋 메시지>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

- 논리적으로 독립적인 변경(docs, build 등)은 별도 커밋으로 분리

## 출력 형식

```markdown
## 커밋 완료

- **메시지**: `feat(backend): add memory CRUD API`
- **변경 파일**: 5개
```

## 에러 처리

| 상황 | 대응 |
|------|------|
| 스테이징된 변경 없음 | unstaged 파일 목록 보여주고 종료 |
| pre-commit hook 실패 | 에러 수정 후 새 커밋 생성 (amend 금지) |
