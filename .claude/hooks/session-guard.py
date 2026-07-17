#!/usr/bin/env python3
"""session-guard — 컨텍스트 사용량 감시 훅 (UserPromptSubmit).

transcript에서 최신 토큰 사용량을 읽어, 임계치를 넘으면 Claude에게
세션 마무리 절차(daily-session-cadence §3~5)를 지시한다.
실패 시에는 조용히 통과한다(작업 방해 금지).
설치: 2026-07-17, 4개 워크스페이스 공통 (AJ_Proj / MyStudy / Pokemon_With / Acorn-E-Learning)
"""
import json
import os
import sys

CONTEXT_LIMIT = 200_000  # Claude 기본 컨텍스트 창(토큰)
WARN = 0.65              # 65%: 진행 블록 마무리 → 일지 → /clear 권고
URGENT = 0.80            # 80%: 새 작업 금지, 즉시 종료 절차


def latest_context_tokens(path):
    """transcript JSONL 꼬리에서 가장 최근 assistant 메시지의 usage 합계."""
    with open(path, "rb") as f:
        f.seek(0, 2)
        size = f.tell()
        f.seek(max(0, size - 2_000_000))  # 꼬리 2MB만
        tail = f.read().decode("utf-8", "ignore")
    for line in reversed(tail.splitlines()):
        try:
            e = json.loads(line)
        except Exception:
            continue
        if e.get("isSidechain"):
            continue
        u = (e.get("message") or {}).get("usage")
        if not u:
            continue
        return (
            u.get("input_tokens", 0)
            + u.get("cache_read_input_tokens", 0)
            + u.get("cache_creation_input_tokens", 0)
            + u.get("output_tokens", 0)
        )
    return 0


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return
    path = data.get("transcript_path") or ""
    if not path or not os.path.isfile(path):
        return
    try:
        used = latest_context_tokens(path)
    except Exception:
        return
    if not used:
        return
    pct = used / CONTEXT_LIMIT
    if pct >= URGENT:
        print(
            f"[session-guard] 컨텍스트 {pct:.0%} 사용(약 {used:,} tokens) — 한계 임박. "
            "새 작업 착수 금지. 지금 즉시 세션 종료 절차 실행: "
            "① 바뀐 파일 경로 + 확인 방법 제시 ② 프로젝트 규칙 위치에 작업일지 작성 "
            "③ 사용자에게 /clear 권고 + 다음 세션 첫 프롬프트 안내. "
            "(daily-session-cadence 스킬 §3~5)"
        )
    elif pct >= WARN:
        print(
            f"[session-guard] 컨텍스트 {pct:.0%} 사용(약 {used:,} tokens) — 성능 저하 구간. "
            "진행 중인 블록만 안전하게 마무리하고, 검증물 제시 → 작업일지 → /clear 권고 순서로 "
            "세션을 정리할 것. 새 블록 시작·대량 파일 읽기 금지. "
            "(daily-session-cadence 스킬 §3~5)"
        )


main()
