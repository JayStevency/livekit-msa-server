# 작업 시작

GitHub Issue 번호를 받아 브랜치를 생성하고 체크아웃합니다.

## 사용법

```
/start #123
/start 123
```

## 절차

### 1. 인자 확인

- `$ARGUMENTS`에서 이슈 번호 추출
- `#` 접두사가 있으면 제거
- 이슈 번호가 없으면 에러 메시지 출력 후 종료

### 2. GitHub Issue 정보 조회

```bash
gh issue view <번호> --json title,labels,state
```

- 이슈의 `title` 필드를 가져옴
- 이슈가 없으면 에러 메시지 출력 후 종료

### 3. 브랜치명 생성

Title을 kebab-case로 변환:

```
브랜치명 = {이슈번호}-{title-kebab-case}

예시:
- Title: "Implement room CRUD API with tests"
- 브랜치명: 123-implement-room-crud-api-with-tests
```

변환 규칙:

- 소문자로 변환
- 공백/특수문자를 `-`로 대체
- 연속된 `-`는 하나로
- 앞뒤 `-` 제거
- 최대 60자로 제한 (이슈번호 포함)

### 4. 브랜치 생성 및 체크아웃

```bash
git fetch origin master
git checkout -b {브랜치명} origin/master
```

### 5. Issue 상태 업데이트

- GitHub Project에서 Status를 "In Progress"로 변경 (가능한 경우)

## 출력 형식

```markdown
## 작업 시작 완료

- **이슈**: #123 - 이슈 제목
- **브랜치**: `123-implement-room-crud-api-with-tests`
- **상태**: In Progress

다음 단계:

1. 코드 작업 진행
2. 완료 후 `/commit` 으로 커밋
```

## 에러 처리

| 상황             | 메시지                                                     |
| ---------------- | ---------------------------------------------------------- |
| 이슈 번호 없음   | "이슈 번호를 입력해주세요. 예: `/start #123` 또는 `/start 123`" |
| 이슈 조회 실패   | "이슈 #123을 찾을 수 없습니다."                             |
| 브랜치 이미 존재 | 기존 브랜치로 체크아웃 진행                                  |
