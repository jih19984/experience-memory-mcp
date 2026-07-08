# Experience Memory MCP

사진과 짧은 메모를 하나의 경험 기억으로 저장하고, 나중에 자연어로 다시 찾는 MCP 서버입니다.

이 MVP는 호출 LLM 위임형입니다. 카카오톡/ChatGPT/Claude 같은 대화 중인 LLM이 사진과 메모를 보고 제목, 요약, 태그, 감정을 정리한 뒤 MCP tool을 호출합니다. MCP 서버는 AI API를 다시 호출하지 않고, 사진 원본과 Markdown 메모를 Google Drive에 저장하고 메타데이터를 PostgreSQL에 저장합니다.

## Tools

- `saveExperienceMemory`: 사진과 사용자 메모 저장
- `searchExperienceMemories`: 자연어로 경험 검색

## Setup

```bash
npm install
cp .env.example .env
npm run db:init
npm run db:check
```

`.env`에 PostgreSQL, Google Drive OAuth 값을 설정합니다.

```env
DATABASE_URL=
TOKEN_ENCRYPTION_KEY=
PORT=3000
MCP_HTTP_PATH=/mcp
HEALTH_PATH=/healthz
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:53682/oauth2callback
GOOGLE_REFRESH_TOKEN=
GOOGLE_DRIVE_ROOT_FOLDER_ID=
```

Google Drive 연동은 단일 사용자 `.env` 방식과 다중 사용자 actor 방식 둘 다 지원합니다. 단일 사용자 방식에서는 `GOOGLE_REFRESH_TOKEN`에 들어간 계정의 Drive에 저장됩니다. 다중 사용자 방식에서는 actor별 Google refresh token을 암호화해서 PostgreSQL에 저장합니다.

Google Drive 또는 PostgreSQL 설정이 없으면 MCP는 local storage로 대체 저장하지 않고 명확한 설정 오류를 반환합니다.

## Google Drive 연결

Google Cloud Console에서 OAuth Client를 만들고 Google Drive API를 활성화합니다. Authorized redirect URI에는 아래 값을 추가합니다.

```text
http://localhost:53682/oauth2callback
```

`.env`에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`를 채운 뒤 아래 명령을 실행합니다.

```bash
npm run google:auth
```

브라우저에서 Google Drive 접근을 허용하면 터미널에 아래 값이 출력됩니다.

```env
GOOGLE_REFRESH_TOKEN=...
GOOGLE_DRIVE_ROOT_FOLDER_ID=...
```

이 값을 `.env`에 추가하면 MCP가 해당 Google 계정의 Drive에 사진과 Markdown 메모를 저장합니다. 권한은 전체 Drive 접근이 아니라 앱이 만든 파일 중심의 `drive.file` scope를 사용합니다.

### 다중 사용자 연결

actor별 Google Drive 연결을 저장하려면 `.env`에 `DATABASE_URL`, `TOKEN_ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`을 설정한 뒤 아래처럼 실행합니다.

```bash
npm run google:auth -- --actor-provider kakao --actor-id kakao-user-id
```

연결이 완료되면 refresh token과 Drive root folder id가 PostgreSQL에 암호화 저장됩니다. MCP를 해당 actor로 실행할 때는 아래 환경변수를 지정합니다.

```env
EXPERIENCE_MEMORY_ACTOR_PROVIDER=kakao
EXPERIENCE_MEMORY_ACTOR_ID=kakao-user-id
```

PlayMCP 같은 HTTP MCP host에서 사용자 식별값을 헤더로 전달하면 MCP 서버가 actor별 Drive 연결을 선택합니다. 기본 후보 헤더는 `x-playmcp-user-id`, `x-kakao-user-id`, `x-mcp-user-id`, `x-user-id`, `mcp-user-id`입니다. 실제 헤더명이 다르면 아래처럼 지정합니다.

```env
EXPERIENCE_MEMORY_ACTOR_PROVIDER=kakao
EXPERIENCE_MEMORY_ACTOR_HEADER=x-playmcp-user-id
```

## Run

```bash
npm run db:check
npm run dev
npm run build
npm start
```

기본 실행은 PlayMCP in KC 배포용 HTTP transport입니다.

```text
GET  /healthz
POST /mcp
```

로컬 Codex/Claude Desktop처럼 stdio transport가 필요하면 아래 명령을 사용합니다.

```bash
npm run dev:stdio
npm run start:stdio
```

## PlayMCP in KC 배포

PlayMCP in KC의 "Git 소스 빌드" 방식으로 등록할 수 있습니다.

- Git URL: 이 저장소 URL
- 브랜치 / ref: 배포할 브랜치
- Dockerfile 경로: `Dockerfile`
- Endpoint path: 발급된 Endpoint URL 뒤의 `/mcp`
- Health check path: `/healthz`

Docker 컨테이너는 기본적으로 `PORT=3000`에서 HTTP MCP endpoint를 엽니다. Kakao Cloud가 `PORT` 환경변수를 주입하면 그 값을 우선 사용합니다.

## MCP 설정 예시

stdio transport를 사용하는 MCP host에서는 아래처럼 설정합니다.

```json
{
  "mcpServers": {
    "experience-memory": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "DATABASE_URL": "...",
        "GOOGLE_CLIENT_ID": "...",
        "GOOGLE_CLIENT_SECRET": "...",
        "GOOGLE_REFRESH_TOKEN": "...",
        "GOOGLE_DRIVE_ROOT_FOLDER_ID": "..."
      }
    }
  }
}
```

## Example

```json
{
  "imagePath": "/Users/me/Pictures/han-river.jpg",
  "userNote": "오늘 한강에서 뛰었는데 힘들었지만 야경이 좋아서 버텼어.",
  "title": "한강 야경 러닝",
  "summary": "힘들었지만 한강 야경 덕분에 끝까지 버틴 러닝 경험.",
  "tags": ["한강", "러닝", "야경"],
  "mood": ["힘듦", "만족", "개운함"],
  "occurredAt": "2026-07-08",
  "locationHint": "한강"
}
```

응답:

```json
{
  "memoryId": "...",
  "title": "한강 야경 러닝",
  "summary": "힘들었지만 한강 야경 덕분에 끝까지 버틴 러닝 경험.",
  "tags": ["한강", "러닝", "야경"],
  "mood": ["힘듦", "만족", "개운함"],
  "driveUrl": "https://drive.google.com/..."
}
```

## Notes

- 클라우드 환경에서는 `imagePath`보다 `imageUrl` 또는 `imageBase64` 입력이 안전합니다.
- 사진 원본을 Drive에 저장하려면 MCP 서버가 실제 이미지 bytes에 접근할 수 있어야 합니다.
- DB 저장 실패 시 업로드된 Drive 파일 삭제를 시도합니다.
