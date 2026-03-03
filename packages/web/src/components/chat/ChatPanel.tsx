// 채팅 패널 컴포넌트 — 좌측 패널, 사용자와 JARVIS 대화 인터페이스
import React, { useState, useRef, useEffect } from "react";
import type { ChatMessageDto, MessageContextBadge, SendMessageRequest } from "../../api/schema.js";
import type { TrustMode } from "@jarvis/shared";

// ChatPanel Props
export interface ChatPanelProps {
  readonly messages: readonly ChatMessageDto[];
  readonly trustMode: TrustMode;
  readonly onSendMessage: (req: SendMessageRequest) => void;
  readonly loading?: boolean;
}

// 컨텍스트 배지 → 표시 텍스트
const CONTEXT_BADGE_LABELS: Record<MessageContextBadge, string> = {
  OBSERVE_ONLY:          "관찰 모드 — 액션 없음",
  MAY_TRIGGER_ACTIONS:   "Semi-auto — 액션 발생 가능",
  EXECUTING:             "실행 중...",
  COMPLETED:             "완료됨",
  FAILED:                "실패",
};

// 컨텍스트 배지 → 배경색
const CONTEXT_BADGE_COLORS: Record<MessageContextBadge, string> = {
  OBSERVE_ONLY:          "#f0f0f0",
  MAY_TRIGGER_ACTIONS:   "#fff3bf",
  EXECUTING:             "#a5d8ff",
  COMPLETED:             "#d3f9d8",
  FAILED:                "#ffc9c9",
};

// 메시지 버블 컴포넌트
const MessageBubble: React.FC<{ message: ChatMessageDto }> = ({ message }) => {
  const isUser = message.role === "USER";
  const isSystem = message.role === "SYSTEM";

  if (isSystem) {
    return (
      <div
        style={{
          textAlign: "center",
          fontSize: "11px",
          color: "#9ca3af",
          padding: "4px 0",
          fontStyle: "italic",
        }}
      >
        {message.content}
      </div>
    );
  }

  const bubbleStyle: React.CSSProperties = {
    maxWidth: "85%",
    padding: "8px 12px",
    borderRadius: isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
    background: isUser ? "#4a9eed" : "#f3f4f6",
    color: isUser ? "#fff" : "#1e1e2e",
    fontSize: "13px",
    lineHeight: 1.5,
    alignSelf: isUser ? "flex-end" : "flex-start",
    wordBreak: "break-word",
  };

  const wrapperStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: isUser ? "flex-end" : "flex-start",
    gap: "3px",
  };

  const roleStyle: React.CSSProperties = {
    fontSize: "10px",
    color: "#9ca3af",
    paddingLeft: isUser ? 0 : "2px",
    paddingRight: isUser ? "2px" : 0,
  };

  const badgeBg = CONTEXT_BADGE_COLORS[message.contextBadge];
  const badgeLabel = CONTEXT_BADGE_LABELS[message.contextBadge];

  return (
    <div style={wrapperStyle}>
      <span style={roleStyle}>{isUser ? "You" : "JARVIS"}</span>
      <div style={bubbleStyle}>{message.content}</div>
      {/* 컨텍스트 배지 */}
      <span
        style={{
          fontSize: "10px",
          padding: "1px 6px",
          borderRadius: "4px",
          background: badgeBg,
          color: "#374151",
        }}
      >
        {badgeLabel}
        {message.isVoice && " 🎤"}
      </span>
    </div>
  );
};

// TrustMode → 표시 텍스트
const TRUST_MODE_LABELS: Record<TrustMode, string> = {
  "observe":   "관찰 모드",
  "suggest":   "제안 모드",
  "semi-auto": "반자동 모드",
  "full-auto": "자동 모드",
};

// ChatPanel 본체
export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  trustMode,
  onSendMessage,
  loading = false,
}) => {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // 새 메시지 시 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const content = input.trim();
    if (!content || loading) return;
    onSendMessage({ content, trustMode });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const panelStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "#ffffff",
    borderRight: "1px solid #e5e7eb",
  };

  const headerStyle: React.CSSProperties = {
    padding: "10px 14px",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "#f8f9fa",
  };

  const scrollStyle: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  };

  const inputAreaStyle: React.CSSProperties = {
    borderTop: "1px solid #e5e7eb",
    padding: "10px 12px",
    background: "#f8f9fa",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  };

  const textareaStyle: React.CSSProperties = {
    width: "100%",
    minHeight: "52px",
    maxHeight: "120px",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    padding: "8px 10px",
    fontSize: "13px",
    resize: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    outline: "none",
    lineHeight: 1.5,
  };

  const sendBtnStyle: React.CSSProperties = {
    alignSelf: "flex-end",
    padding: "6px 16px",
    background: loading ? "#9ca3af" : "#4a9eed",
    color: "#fff",
    border: "none",
    borderRadius: "7px",
    fontWeight: 600,
    fontSize: "13px",
    cursor: loading ? "not-allowed" : "pointer",
    transition: "background 0.12s",
  };

  // 빠른 액션 버튼들
  const quickActions = [
    { label: "계획만", context: "plan-only" },
    { label: "시뮬레이션", context: "simulation" },
    { label: "실행", context: "execute" },
  ];

  return (
    <div style={panelStyle} role="region" aria-label="채팅 패널">
      {/* 헤더 */}
      <div style={headerStyle}>
        <span style={{ fontSize: "16px" }}>💬</span>
        <span style={{ fontWeight: 700, fontSize: "13px", color: "#1e1e2e", flex: 1 }}>JARVIS</span>
        <span
          style={{
            fontSize: "11px",
            padding: "2px 8px",
            borderRadius: "12px",
            background:
              trustMode === "observe"   ? "#e5dbff"
              : trustMode === "suggest"   ? "#d0bfff"
              : trustMode === "semi-auto" ? "#fff3bf"
              : "#ffd8a8",
            color: "#374151",
            fontWeight: 600,
          }}
        >
          {TRUST_MODE_LABELS[trustMode]}
        </span>
      </div>

      {/* 메시지 스크롤 영역 */}
      <div
        style={scrollStyle}
        ref={scrollRef}
        role="log"
        aria-label="대화 내역"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div style={{ color: "#9ca3af", fontSize: "13px", textAlign: "center", marginTop: "40px" }}>
            JARVIS에게 작업을 요청하세요.
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.messageId} message={msg} />
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", color: "#9ca3af", fontSize: "13px", fontStyle: "italic" }}>
            JARVIS가 분석 중...
          </div>
        )}
      </div>

      {/* 입력 영역 */}
      <div style={inputAreaStyle}>
        {/* 빠른 액션 */}
        <div style={{ display: "flex", gap: "6px" }}>
          {quickActions.map((action) => (
            <button
              key={action.context}
              style={{
                padding: "3px 10px",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                background: "#fff",
                fontSize: "11px",
                color: "#374151",
                cursor: "pointer",
              }}
              onClick={() => {
                if (input.trim()) {
                  onSendMessage({ content: `[${action.label}] ${input.trim()}`, trustMode });
                  setInput("");
                }
              }}
              aria-label={`${action.label} 모드로 실행`}
            >
              {action.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
          <textarea
            style={textareaStyle}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="JARVIS에게 작업을 요청하세요... (Enter: 전송, Shift+Enter: 줄바꿈)"
            disabled={loading}
            aria-label="메시지 입력"
          />
          <button
            style={sendBtnStyle}
            onClick={handleSend}
            disabled={loading || !input.trim()}
            aria-label="메시지 전송"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
};
