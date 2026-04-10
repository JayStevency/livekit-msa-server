# 작업 브리핑

현재 작업 컨텍스트를 요약합니다.

## 체크리스트

```bash
# 1. Git 상태
git branch --show-current
git status --short
git log --oneline -5

# 2. Docker 상태
docker compose ps --format "table {{.Name}}\t{{.Status}}"
```

## 보고 형식

```markdown
## 작업 브리핑

### Git 상태
- **브랜치**: `현재 브랜치명`
- **변경 파일**: X개 (modified: Y, untracked: Z)
- **최근 커밋**: 커밋 메시지

### 시스템 상태
- **Docker**: 전체 서비스 정상 / N개 서비스 이상
- **최근 에러**: 없음 / X건 발견

### 다음 작업 제안
- [ ] 작업 항목 1
- [ ] 작업 항목 2
```
