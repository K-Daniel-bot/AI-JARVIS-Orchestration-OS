# WSL 환경 주의사항

## Vite/esbuild 바이너리 호환성 문제

WSL(Linux) 환경에서 `pnpm start` 실행 시 다음 에러가 발생할 수 있습니다:

```
Cannot start service: Host version "0.24.2" does not match binary version "0.21.5"
```

### 원인

- Vite 6.0.11은 esbuild 0.24.2를 필요로 함
- WSL의 node_modules에는 esbuild 0.21.5의 Linux 바이너리만 설치됨
- 0.24.2의 Linux x64 바이너리가 누락됨

### 해결 방법

#### 방법 1: Windows 네이티브 환경에서 실행 (권장)

```bash
# PowerShell / CMD에서 직접 실행 (WSL 아님)
pnpm start
```

#### 방법 2: WSL에서 웹팩 대신 사용

```bash
# WSL 환경에서
cd packages/web
pnpm dev --force
```

#### 방법 3: node_modules 재설치

```bash
# WSL 환경에서
cd /path/to/project
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### 권장사항

**Windows 네이티브에서 실행하세요.**

- Vite의 핫 모듈 리플로딩이 더 안정적
- esbuild 바이너리 호환성 문제 없음
- 성능 최적화됨

```bash
# Windows PowerShell / CMD
cd C:\Users\ejdnj\OneDrive\Desktop\GitHub\AI-JARVIS-Orchestration-OS
pnpm start
```

브라우저에서 열기: **http://localhost:5173** (또는 **5174**)
