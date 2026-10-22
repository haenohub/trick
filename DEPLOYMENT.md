# 리프테일 배포

## GitHub Pages

저장소 Pages의 Source는 GitHub Actions입니다. `main`에 push하면 자동으로:

1. Node.js 24에서 고정된 lockfile로 설치.
2. 정적 게임 빌드.
3. 콘텐츠/전투/경제/서버 테스트.
4. `dist`만 Pages 아티팩트로 업로드.
5. `github-pages` 환경으로 배포.
6. 공개 주소의 배포 메타데이터가 이번 커밋 SHA와 일치하는지 확인.
7. HTML·CSS·JavaScript·콘텐츠·렌더러·최종 보스 이미지 요청 확인.

PR은 빌드/테스트만 수행하며 배포하지 않습니다. 수동 workflow_dispatch도 지원합니다.

기본 주소: https://haenohub.github.io/trick/

정적 에셋 경로는 상대 경로여서 `/trick/` 프로젝트 경로에서 작동합니다. 공개 아티팩트에는 서버 코드·세션 파일·node_modules를 포함하지 않습니다.

## 로컬 재현

```sh
cd /workspace/trick
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm test
npm start
```

Node.js 24가 필요합니다. 기본 npm 캐시 디렉터리를 쓸 수 없을 때는 npm 명령에 `--cache /workspace/.cache/leaftale-npm`을 추가합니다. 기본 서버 포트는 8080이며 `/health`는 JSON `status: ok`를 반환합니다.

## 공개 온라인 기능

GitHub Pages는 브라우저 게임을 제공하며 온라인 백엔드를 호스팅하지 않습니다. 실시간 멀티플레이를 공개하려면 `server/index.mjs`를 Node.js 24와 영속 저장 경로를 제공하는 호스팅에 따로 배포해야 합니다. 공개 서버는 HTTPS/WSS로 제공하세요.

백엔드 호스팅 계정, 도메인, 영속 볼륨은 이 저장소가 자동으로 생성하지 않습니다. 호스팅을 정하면 서버 실행 명령과 아래 환경 변수를 적용하고 `/health`와 실제 두 브라우저의 `/ws` 연결을 검증해야 합니다. 서버의 외부 배포는 별도 절차입니다.

외부 서비스로 요청을 보내거나 계정을 새로 만들지 않습니다. 서버 주소는 게임 설정에서 입력할 수 있습니다.

## 클라우드 환경 네트워크

배포 상태와 공개 페이지를 직접 확인하려면 `api.github.com` 및 `haenohub.github.io` 접속이 필요합니다. 설치에는 npm 레지스트리 접근이 필요합니다. 프로세스는 새 클라우드 작업에서 다시 시작해야 하며 게시된 파일과 실행 중인 서버는 별개입니다.
