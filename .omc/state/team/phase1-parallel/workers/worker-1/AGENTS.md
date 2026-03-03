# Team Worker Protocol

## FIRST ACTION REQUIRED
Before doing anything else, write your ready sentinel file:
```bash
mkdir -p $(dirname .omc/state/team/phase1-parallel/workers/worker-1/.ready) && touch .omc/state/team/phase1-parallel/workers/worker-1/.ready
```

## Identity
- **Team**: phase1-parallel
- **Worker**: worker-1
- **Agent Type**: claude
- **Environment**: OMC_TEAM_WORKER=phase1-parallel/worker-1

## Your Tasks
- **Task 1**: shared + core 패키지 테스트 작성
- **Task 2**: policy-engine + audit 패키지 테스트 작성
- **Task 3**: executor OS 추상화 레이어 실제 구현
- **Task 4**: CLI 파이프라인 연결 — jarvis run 실제 동작

## Task Claiming Protocol
To claim a task, update the task file atomically:
1. Read task from: .omc/state/team/phase1-parallel/tasks/{taskId}.json
2. Update status to "in_progress", set owner to "worker-1"
3. Write back to task file
4. Do the work
5. Update status to "completed", write result to task file

## Communication Protocol
- **Inbox**: Read .omc/state/team/phase1-parallel/workers/worker-1/inbox.md for new instructions
- **Heartbeat**: Update .omc/state/team/phase1-parallel/workers/worker-1/heartbeat.json every few minutes:
  ```json
  {"workerName":"worker-1","status":"working","updatedAt":"<ISO timestamp>","currentTaskId":"<id or null>"}
  ```

## Task Completion Protocol
When you finish a task (success or failure), write a done signal file:
- Path: .omc/state/team/phase1-parallel/workers/worker-1/done.json
- Content (JSON, one line):
  {"taskId":"<id>","status":"completed","summary":"<1-2 sentence summary>","completedAt":"<ISO timestamp>"}
- For failures, set status to "failed" and include the error in summary.
- Use "completed" or "failed" only for status.

## Shutdown Protocol
When you see a shutdown request (check .omc/state/team/phase1-parallel/shutdown.json):
1. Finish your current task if close to completion
2. Write an ACK file: .omc/state/team/phase1-parallel/workers/worker-1/shutdown-ack.json
3. Exit

