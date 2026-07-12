# Experience Memory MCP

사진이나 짧은 메모를 하나의 경험 기억으로 저장하고, 나중에 자연어로 다시 찾는 MCP 서버입니다.

이 MVP는 호출 LLM 위임형입니다. 카카오톡/ChatGPT/Claude 같은 대화 중인 LLM이 사진이나 메모를 보고 제목, 요약, 태그, 감정을 정리한 뒤 MCP tool을 호출합니다. MCP 서버는 AI API를 다시 호출하지 않고, 사진이 있으면 원본을 Google Drive에 저장하고 항상 Markdown 메모와 검색용 메타데이터를 저장합니다.

## Tools

- `connectGoogleDrive`: 수동 Google Drive 연결 URL 생성. PlayMCP OAuth 방식에서는 보통 사용하지 않습니다.
- `saveExperienceMemory`: 사진, 메모, 또는 사진+메모 경험 저장
- `searchExperienceMemories`: 자연어로 경험 검색
- `updateExperienceMemory`: 저장된 경험의 제목, 요약, 메모, 태그, 감정, 날짜, 활동, 장소 수정
- `deleteExperienceMemory`: 저장된 경험과 연결된 Google Drive 사진/Markdown 메모 삭제

## Setup

```bash
npm install
cp .env.example .env
```

`.env`에 Google Drive OAuth 값을 설정합니다. `DATABASE_URL`이 있으면 PostgreSQL을 사용하고, 없으면 PlayMCP in KC 제출용 local JSON 저장소를 사용합니다.

```env
TOKEN_ENCRYPTION_KEY=
PORT=8000
MCP_HTTP_PATH=/mcp
HEALTH_PATH=/healthz
GOOGLE_OAUTH_CALLBACK_PATH=/oauth/google/callback
EXPERIENCE_MEMORY_DATA_DIR=/tmp/experience-memory
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

PlayMCP 제출용 권장 방식은 PlayMCP 등록 화면의 OAuth 인증을 Google OAuth로 설정하는 것입니다. 그러면 PlayMCP가 tool call에 `Authorization: Bearer ...` access token을 전달하고, MCP 서버는 그 token으로 Google 사용자 id를 확인해 사용자별 저장소와 Google Drive 폴더를 선택합니다.

PlayMCP OAuth 입력값:

```text
Client ID: GOOGLE_CLIENT_ID 값
Client Secret: GOOGLE_CLIENT_SECRET 값
Authorization Endpoint URL: https://accounts.google.com/o/oauth2/v2/auth
Token Endpoint URL: https://oauth2.googleapis.com/token
Scope: openid email profile https://www.googleapis.com/auth/drive.file
Grant Type: AUTHORIZATION_CODE
```

PlayMCP가 이메일로 보내는 Redirect URI는 Google Cloud Console의 OAuth Client에 Authorized redirect URI로 추가해야 합니다.

수동 Google Drive 연결도 fallback으로 지원합니다. 각 사용자가 `connectGoogleDrive` tool이 반환하는 Google OAuth URL을 열어 로그인하면, actor별 refresh token과 Drive root folder id가 암호화 저장됩니다.

단일 사용자 `.env` 방식도 로컬 테스트용으로만 지원합니다. 이 경우 `GOOGLE_REFRESH_TOKEN`, `GOOGLE_DRIVE_ROOT_FOLDER_ID`에 들어간 계정의 Drive에 저장되므로 public/multi-user 배포에는 사용하지 않습니다.

Google Drive 연결 전에는 `connectGoogleDrive`로 사용자 개인 Drive를 먼저 연결해야 합니다.

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

이 값을 `.env`에 추가하면 MCP가 해당 Google 계정의 Drive에 사진과 Markdown 메모를 저장합니다. 텍스트만 있는 경험은 Markdown 메모만 저장합니다. 권한은 전체 Drive 접근이 아니라 앱이 만든 파일 중심의 `drive.file` scope를 사용합니다.

### 다중 사용자 연결

actor별 Google Drive 연결을 로컬에서 저장하려면 `.env`에 `TOKEN_ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`을 설정한 뒤 아래처럼 실행합니다.

```bash
npm run google:auth -- --actor-provider kakao --actor-id kakao-user-id
```

연결이 완료되면 refresh token과 Drive root folder id가 저장소에 암호화 저장됩니다. MCP를 stdio로 해당 actor에 고정 실행할 때는 아래 환경변수를 지정합니다.

```env
EXPERIENCE_MEMORY_ACTOR_PROVIDER=kakao
EXPERIENCE_MEMORY_ACTOR_ID=kakao-user-id
```

PlayMCP 같은 HTTP MCP host에서 사용자 식별값을 헤더로 전달하면 MCP 서버가 actor별 Drive 연결을 선택합니다. 기본 후보 헤더는 `x-playmcp-user-id`, `x-kakao-user-id`, `x-mcp-user-id`, `x-user-id`, `mcp-user-id`입니다. 실제 헤더명이 다르면 아래처럼 지정합니다. 단, PlayMCP OAuth의 Bearer token이 전달되면 Google OAuth 사용자 id를 우선 사용합니다.

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
GET  /
GET  /healthz
POST /
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

Docker 컨테이너는 기본적으로 `PORT=8000`에서 HTTP MCP endpoint를 엽니다. PlayMCP in KC 등록 화면의 `container_port`도 `8000`으로 둡니다.

공모전 제출용 Docker 이미지는 외부 DB 없이 뜰 수 있도록 local JSON 저장소를 사용합니다.

```env
EXPERIENCE_MEMORY_DATA_DIR=/tmp/experience-memory
EXPERIENCE_MEMORY_DEFAULT_ACTOR_ID=playmcp-demo
```

이 모드는 컨테이너 재시작/재배포 시 데이터가 유지된다는 보장이 없습니다. 실제 운영 또는 장기 유지 단계에서는 외부 PostgreSQL을 만들고 아래처럼 전환합니다.

```env
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/experience_memory
```

### PlayMCP in KC 입력 예시

기본 정보:

- MCP 서버 이름: `experience-memory-mcp`
- 설명: `사진과 메모를 Google Drive에 저장하고 자연어로 경험 기억을 검색하는 MCP 서버`
- Git URL: `https://github.com/jih19984/experience-memory-mcp.git`
- 브랜치 / ref: `main`
- Dockerfile 경로: `Dockerfile`
- PAT: public repo라 비움
- container_port: `8000`

환경변수:

```env
MCP_HTTP_PATH=/mcp
HEALTH_PATH=/healthz
GOOGLE_OAUTH_CALLBACK_PATH=/oauth/google/callback
EXPERIENCE_MEMORY_DATA_DIR=/tmp/experience-memory
```

시크릿:

```env
TOKEN_ENCRYPTION_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

중요: `GOOGLE_REFRESH_TOKEN`과 `GOOGLE_DRIVE_ROOT_FOLDER_ID`는 PlayMCP in KC 등록 화면에 넣지 않습니다. PlayMCP OAuth 방식에서는 사용자의 access token으로 Drive에 접근하고, root folder는 사용자 Drive 안에 자동 생성/재사용합니다.

Endpoint URL이 발급되면 Google Cloud Console의 OAuth Client에 아래 Authorized redirect URI도 추가할 수 있습니다. 이 URI는 수동 `connectGoogleDrive` fallback용입니다. PlayMCP OAuth 자체에는 PlayMCP가 이메일로 보내는 Redirect URI를 추가해야 합니다.

```text
https://<발급받은-endpoint-host>/oauth/google/callback
```

그 뒤 사용자가 처음 저장하려 할 때 `connectGoogleDrive` tool을 호출해 개인 Google Drive를 연결합니다.

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
  "driveUrl": "https://drive.google.com/...",
  "hasImage": true
}
```

수정 예시:

```json
{
  "id": "5b37c7bc-d845-40b0-ae66-95ed1d327732",
  "title": "엄마와 함께 먹은 치킨",
  "summary": "오늘 엄마와 함께 바삭한 치킨을 먹으며 남긴 식사 기억.",
  "tags": ["엄마", "치킨", "식사", "가족"],
  "mood": ["따뜻함", "만족"]
}
```

삭제 예시:

```json
{
  "id": "5b37c7bc-d845-40b0-ae66-95ed1d327732"
}
```

## Notes

- 클라우드 환경에서는 `imagePath`보다 `imageUrl` 또는 `imageBase64` 입력이 안전합니다.
- 사진 없이 `userNote`만으로도 저장할 수 있습니다.
- 사진 원본을 Drive에 저장하려면 MCP 서버가 실제 이미지 bytes에 접근할 수 있어야 합니다.
- DB 저장 실패 시 업로드된 Drive 파일 삭제를 시도합니다.
- `updateExperienceMemory`는 사진 교체를 하지 않습니다. 사진 교체가 필요하면 새 경험 저장 또는 별도 사진 교체 tool 추가를 권장합니다.
