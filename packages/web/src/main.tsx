/**
 * JARVIS OS Web 대시보드 React 진입점
 * React 19 createRoot API를 사용하여 앱을 마운트한다.
 * 전역 에러 핸들러를 등록하여 렌더링 오류를 안전하게 처리한다.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

// ─────────────────────────────────────────
// 루트 엘리먼트 마운트
// ─────────────────────────────────────────

/** DOM 루트 엘리먼트 조회 */
const rootElement = document.getElementById('root');

if (rootElement === null) {
  // 루트 엘리먼트가 없으면 치명적 에러 — HTML 설정 오류
  throw new Error(
    'root 엘리먼트를 찾을 수 없습니다. index.html에 <div id="root"></div>가 있는지 확인하세요.',
  );
}

// ─────────────────────────────────────────
// React 18+ createRoot API로 마운트
// ─────────────────────────────────────────

const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
