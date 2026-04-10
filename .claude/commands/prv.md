# PR 리뷰 확인

GitHub PR에 달린 리뷰 코멘트를 확인합니다.

## 사용법

```
/prv #123
/prv 123
```

## 절차

### 1. 인자 확인

- `$ARGUMENTS`에서 PR 번호 추출
- `#` 접두사가 있으면 제거
- PR 번호가 없으면 에러 메시지 출력 후 종료

### 2. PR 정보 조회

```bash
gh pr view <PR번호> --json title,state,author,url,reviewDecision
```

### 3. PR 리뷰 코멘트 조회

```bash
gh pr view <PR번호> --json reviews,comments
gh api repos/{owner}/{repo}/pulls/<PR번호>/comments
```

### 4. 리뷰 내용 정리

리뷰 정보:
- 리뷰어 이름
- 리뷰 상태 (APPROVED, CHANGES_REQUESTED, COMMENTED, PENDING)
- 리뷰 코멘트 내용
- 코멘트가 달린 파일 및 라인 정보

### 5. 인라인 코멘트 확인

```bash
gh api repos/{owner}/{repo}/pulls/<PR번호>/comments --jq '.[] | {path, line, body, user: .user.login}'
```

## 출력 형식

```markdown
## PR #123 리뷰 현황

**제목**: PR 제목
**상태**: Open / Merged / Closed
**작성자**: @username
**리뷰 결정**: APPROVED / CHANGES_REQUESTED / PENDING

---

### 리뷰 요약

| 리뷰어 | 상태 | 코멘트 수 |
|--------|------|-----------|
| @reviewer1 | APPROVED | 2 |
| @reviewer2 | CHANGES_REQUESTED | 5 |

---

### 리뷰 코멘트

#### @reviewer1 (APPROVED)
> 전체 코멘트 내용

#### @reviewer2 (CHANGES_REQUESTED)
> 전체 코멘트 내용

---

### 인라인 코멘트

#### `src/app/page.tsx` (Line 42)
**@reviewer2**: 이 부분 수정 필요합니다.

#### `src/lib/api.ts` (Line 15-20)
**@reviewer2**: 에러 처리 추가해주세요.

---

### 다음 단계

- [ ] `src/app/page.tsx:42` - 코멘트 내용 요약
- [ ] `src/lib/api.ts:15` - 코멘트 내용 요약
```

## 에러 처리

| 상황 | 메시지 |
|------|--------|
| PR 번호 없음 | "PR 번호를 입력해주세요. 예: `/prv #123` 또는 `/prv 123`" |
| PR 조회 실패 | "PR #123을 찾을 수 없습니다." |
| 리뷰 없음 | "아직 리뷰가 없습니다." |
