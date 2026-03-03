#!/usr/bin/env node
// JARVIS 서버 런처 — API 서버(3001)와 프론트엔드(5173)를 동시에 시작한다

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ─── 색상 코드 ────────────────────────────────────────────────
const C = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  red:    "\x1b[31m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  blue:   "\x1b[34m",
  cyan:   "\x1b[36m",
  gray:   "\x1b[90m",
};

function log(prefix, color, msg) {
  const ts = new Date().toTimeString().slice(0, 8);
  process.stdout.write(`${C.gray}[${ts}]${C.reset} ${color}${C.bold}[${prefix}]${C.reset} ${msg}\n`);
}

function banner() {
  console.log(`
${C.cyan}${C.bold}╔══════════════════════════════════════════╗
║        JARVIS Orchestration OS           ║
║          개발 서버 런처 v0.1             ║
╚══════════════════════════════════════════╝${C.reset}

  ${C.green}●${C.reset} API 서버:   ${C.bold}http://localhost:3002${C.reset}
  ${C.blue}●${C.reset} 프론트엔드: ${C.bold}http://localhost:5173${C.reset}
  ${C.yellow}●${C.reset} Health:     ${C.bold}http://localhost:3002/health${C.reset}

  ${C.gray}Ctrl+C 로 종료${C.reset}
`);
}

// ─── 빌드 필요 여부 확인 ──────────────────────────────────────
function needsBuild() {
  const serverDist = resolve(ROOT, "packages/server/dist/index.js");
  return !existsSync(serverDist);
}

// ─── 자식 프로세스 생성 ───────────────────────────────────────
function spawnProcess(label, color, cmd, args, cwd, env = {}) {
  const proc = spawn(cmd, args, {
    cwd,
    stdio: ["inherit", "pipe", "pipe"],
    shell: true,
    env: { ...process.env, ...env },
  });

  proc.stdout?.on("data", (data) => {
    const lines = data.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      log(label, color, line);
    }
  });

  proc.stderr?.on("data", (data) => {
    const lines = data.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      // vite/tsc 경고는 gray로, 실제 에러는 red로
      const isWarning = line.includes("warn") || line.includes("WARN");
      log(label, isWarning ? C.yellow : C.red, line);
    }
  });

  proc.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      log(label, C.red, `프로세스 종료 (코드: ${code})`);
    }
  });

  return proc;
}

// ─── 메인 실행 ────────────────────────────────────────────────
async function main() {
  banner();

  // 서버 빌드가 없으면 먼저 빌드
  if (needsBuild()) {
    log("BUILD", C.yellow, "server 빌드 파일 없음 — pnpm build 실행 중...");
    await new Promise((resolve, reject) => {
      const build = spawn("pnpm", ["--filter", "@jarvis/server", "build"], {
        cwd: ROOT,
        stdio: "inherit",
        shell: true,
      });
      build.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`빌드 실패 (코드: ${code})`));
      });
    }).catch((err) => {
      log("BUILD", C.red, err.message);
      process.exit(1);
    });
    log("BUILD", C.green, "빌드 완료 ✓");
  }

  const processes = [];

  // ── API 서버 시작 (node --watch) ──────────────────────────
  log("SERVER", C.green, "API 서버 시작 (port 3002)...");
  const serverProc = spawnProcess(
    "SERVER", C.green,
    "node",
    ["--watch", "packages/server/dist/index.js"],
    ROOT,
    { PORT: "3002" },
  );
  processes.push(serverProc);

  // API 서버가 뜨기를 1.5초 기다린 뒤 Vite 시작
  await new Promise((r) => setTimeout(r, 1500));

  // ── Vite 프론트엔드 시작 ──────────────────────────────────
  log("WEB", C.blue, "Vite 개발 서버 시작 (port 5173)...");
  const webProc = spawnProcess(
    "WEB", C.blue,
    "pnpm",
    ["--filter", "@jarvis/web", "dev"],
    ROOT,
  );
  processes.push(webProc);

  // ── 종료 처리 ─────────────────────────────────────────────
  function shutdown(signal) {
    log("LAUNCHER", C.yellow, `${signal} 수신 — 프로세스 종료 중...`);
    for (const proc of processes) {
      try { proc.kill("SIGTERM"); } catch { /* 이미 종료됨 */ }
    }
    setTimeout(() => process.exit(0), 500);
  }

  process.on("SIGINT",  () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error(`${C.red}[LAUNCHER] 실행 오류:${C.reset}`, err.message);
  process.exit(1);
});
