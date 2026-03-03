@echo off
:: JARVIS 서버 빠른 실행 스크립트 (Windows)
:: 사용법: start.bat

title JARVIS Orchestration OS - 개발 서버

echo.
echo  ============================================
echo   JARVIS Orchestration OS - 서버 시작
echo  ============================================
echo.

:: Node.js 확인
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo [오류] Node.js가 설치되지 않았습니다.
  echo        https://nodejs.org 에서 Node.js 20 이상을 설치하세요.
  pause
  exit /b 1
)

:: pnpm 확인
where pnpm >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo [오류] pnpm이 설치되지 않았습니다.
  echo        npm install -g pnpm 으로 설치하세요.
  pause
  exit /b 1
)

:: node_modules 확인
if not exist "node_modules" (
  echo [설치] 의존성 설치 중...
  call pnpm install
  if %ERRORLEVEL% neq 0 (
    echo [오류] pnpm install 실패
    pause
    exit /b 1
  )
)

:: 런처 실행
echo [시작] 서버 런처 실행...
echo.
node scripts/start.js

pause
