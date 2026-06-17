"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  CustomerListItem,
  MemoryRecordItem,
} from "@/app/client-demos/cross-border/employee/_data/employee-data";
import {
  customerRows as seedCustomerRows,
  memoryRows as seedMemoryRows,
} from "@/app/client-demos/cross-border/employee/_data/employee-data";

export type CbeEmployeeTaskKind = "lead" | "screening" | "accio_memory";
export type CbeEmployeeTaskStatus = "queued" | "running" | "polling" | "completed" | "failed";

export interface CbeEmployeeTaskRecord {
  id: string;
  kind: CbeEmployeeTaskKind;
  title: string;
  status: CbeEmployeeTaskStatus;
  message: string;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  estimatedMs: number;
  timeoutMs: number;
  deadlineAt: number;
  sessionKey?: string;
  targetLabel?: string;
  resultCount?: number;
  error?: string;
  dismissed?: boolean;
  notificationRead?: boolean;
  metadata?: Record<string, unknown>;
}

type RowUpdater = CustomerListItem[] | ((current: CustomerListItem[]) => CustomerListItem[]);
type MemoryRowUpdater = MemoryRecordItem[] | ((current: MemoryRecordItem[]) => MemoryRecordItem[]);

interface StartTaskInput {
  id?: string;
  kind: CbeEmployeeTaskKind;
  title: string;
  message: string;
  estimatedMs: number;
  timeoutMs: number;
  sessionKey?: string;
  targetLabel?: string;
}

interface TaskProgressInput {
  status: Exclude<CbeEmployeeTaskStatus, "failed">;
  message: string;
  sessionKey?: string;
}

interface CbeEmployeeDraftCache {
  customerQuery?: string;
  memoryQuery?: string;
  updatedAt?: number;
}

interface CbeEmployeeState {
  rows: CustomerListItem[];
  memoryRows: MemoryRecordItem[];
  tasks: CbeEmployeeTaskRecord[];
  draftCache: CbeEmployeeDraftCache;
  setRows: (updater: RowUpdater) => void;
  upsertRows: (updates: CustomerListItem[]) => void;
  deleteRows: (customerIds: string[]) => void;
  setMemoryRows: (updater: MemoryRowUpdater) => void;
  upsertMemoryRows: (updates: MemoryRecordItem[]) => void;
  setTasks: (tasks: CbeEmployeeTaskRecord[]) => void;
  markTaskNotificationsRead: (taskIds: string[]) => void;
  setDraftCache: (draftCache: Partial<CbeEmployeeDraftCache>) => void;
  startTask: (input: StartTaskInput) => string;
  updateTaskProgress: (id: string, progress: TaskProgressInput) => void;
  completeTask: (id: string, resultCount: number, message: string, sessionKey?: string) => void;
  failTask: (id: string, error: string, sessionKey?: string) => void;
  dismissTask: (id: string) => void;
  recoverStaleTasks: (now?: number) => void;
}

const ACTIVE_TASK_STATUSES = new Set<CbeEmployeeTaskStatus>(["queued", "running", "polling"]);
const MAX_RETAINED_TASKS = 12;
const STALE_GRACE_MS = 30_000;
const DEMO_SEED_ENABLED =
  process.env.NEXT_PUBLIC_CBE_USE_DEMO_SEED === "1" || process.env.CBE_USE_DEMO_SEED === "1";

function createId(prefix: string) {
  const cryptoId = globalThis.crypto?.randomUUID?.();
  if (cryptoId) return `${prefix}-${cryptoId}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function taskSort(left: CbeEmployeeTaskRecord, right: CbeEmployeeTaskRecord) {
  if (ACTIVE_TASK_STATUSES.has(left.status) && !ACTIVE_TASK_STATUSES.has(right.status)) return -1;
  if (!ACTIVE_TASK_STATUSES.has(left.status) && ACTIVE_TASK_STATUSES.has(right.status)) return 1;
  return right.updatedAt - left.updatedAt;
}

function trimTasks(tasks: CbeEmployeeTaskRecord[]) {
  const sorted = [...tasks].sort(taskSort);
  const active = sorted.filter((task) => ACTIVE_TASK_STATUSES.has(task.status));
  const terminal = sorted.filter((task) => !ACTIVE_TASK_STATUSES.has(task.status)).slice(0, MAX_RETAINED_TASKS);
  return [...active, ...terminal].slice(0, MAX_RETAINED_TASKS + active.length);
}

function applyRowUpdater(current: CustomerListItem[], updater: RowUpdater) {
  return typeof updater === "function" ? updater(current) : updater;
}

function upsertCustomerRows(current: CustomerListItem[], updates: CustomerListItem[]) {
  const byId = new Map(current.map((item) => [item.customerId, item]));
  for (const update of updates) {
    byId.set(update.customerId, { ...byId.get(update.customerId), ...update });
  }
  return Array.from(byId.values());
}

function upsertMemoryRecordRows(current: MemoryRecordItem[], updates: MemoryRecordItem[]) {
  const byId = new Map(current.map((item) => [item.recordId, item]));
  for (const update of updates) {
    byId.set(update.recordId, { ...byId.get(update.recordId), ...update });
  }
  return Array.from(byId.values());
}

function applyMemoryRowUpdater(current: MemoryRecordItem[], updater: MemoryRowUpdater) {
  return typeof updater === "function" ? updater(current) : updater;
}

function initialCustomerRows() {
  return DEMO_SEED_ENABLED ? seedCustomerRows : [];
}

function initialMemoryRows() {
  return DEMO_SEED_ENABLED ? seedMemoryRows : [];
}

export function isCbeEmployeeTaskActive(task: CbeEmployeeTaskRecord) {
  return ACTIVE_TASK_STATUSES.has(task.status);
}

export function formatCbeTaskDuration(ms: number) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    return `${hours}小时${String(restMinutes).padStart(2, "0")}分`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getCbeTaskTiming(task: CbeEmployeeTaskRecord, now = Date.now()) {
  const endAt = isCbeEmployeeTaskActive(task) ? now : task.completedAt ?? task.updatedAt;
  const elapsedMs = Math.max(0, endAt - task.startedAt);
  const remainingMs = Math.max(0, task.estimatedMs - elapsedMs);
  const progressPercent = isCbeEmployeeTaskActive(task)
    ? Math.min(95, Math.max(5, Math.round((elapsedMs / Math.max(task.estimatedMs, 1)) * 100)))
    : 100;
  return { elapsedMs, remainingMs, progressPercent };
}

export const useCbeEmployeeStore = create<CbeEmployeeState>()(
  persist(
    (set) => ({
      rows: initialCustomerRows(),
      memoryRows: initialMemoryRows(),
      tasks: [],
      draftCache: {},
      setRows: (updater) =>
        set((state) => ({
          rows: applyRowUpdater(state.rows, updater),
        })),
      upsertRows: (updates) =>
        set((state) => ({
          rows: upsertCustomerRows(state.rows, updates),
        })),
      deleteRows: (customerIds) =>
        set((state) => {
          const deleteIds = new Set(customerIds);
          if (deleteIds.size === 0) return { rows: state.rows };
          return {
            rows: state.rows.filter((row) => !deleteIds.has(row.customerId)),
          };
        }),
      setMemoryRows: (updater) =>
        set((state) => ({
          memoryRows: applyMemoryRowUpdater(state.memoryRows, updater),
        })),
      upsertMemoryRows: (updates) =>
        set((state) => ({
          memoryRows: upsertMemoryRecordRows(state.memoryRows, updates),
        })),
      setTasks: (tasks) =>
        set(() => ({
          tasks: trimTasks(tasks),
        })),
      markTaskNotificationsRead: (taskIds) =>
        set((state) => {
          const readIds = new Set(taskIds);
          return {
            tasks: state.tasks.map((task) =>
              readIds.has(task.id) ? { ...task, notificationRead: true } : task,
            ),
          };
        }),
      setDraftCache: (draftCache) =>
        set((state) => ({
          draftCache: {
            ...state.draftCache,
            ...draftCache,
            updatedAt: Date.now(),
          },
        })),
      startTask: (input) => {
        const now = Date.now();
        const id = input.id ?? createId(`cbe-${input.kind}`);
        const task: CbeEmployeeTaskRecord = {
          id,
          kind: input.kind,
          title: input.title,
          status: "queued",
          message: input.message,
          startedAt: now,
          updatedAt: now,
          estimatedMs: input.estimatedMs,
          timeoutMs: input.timeoutMs,
          deadlineAt: now + input.timeoutMs,
          sessionKey: input.sessionKey,
          targetLabel: input.targetLabel,
        };
        set((state) => ({ tasks: trimTasks([task, ...state.tasks]) }));
        return id;
      },
      updateTaskProgress: (id, progress) =>
        set((state) => ({
          tasks: trimTasks(
            state.tasks.map((task) =>
              task.id === id
                ? {
                    ...task,
                    status: progress.status,
                    message: progress.message,
                    sessionKey: progress.sessionKey ?? task.sessionKey,
                    updatedAt: Date.now(),
                  }
                : task,
            ),
          ),
        })),
      completeTask: (id, resultCount, message, sessionKey) =>
        set((state) => ({
          tasks: trimTasks(
            state.tasks.map((task) => {
              if (task.id !== id) return task;
              const now = Date.now();
              return {
                ...task,
                status: "completed",
                message,
                sessionKey: sessionKey ?? task.sessionKey,
                resultCount,
                error: undefined,
                dismissed: false,
                completedAt: now,
                updatedAt: now,
              };
            }),
          ),
        })),
      failTask: (id, error, sessionKey) =>
        set((state) => ({
          tasks: trimTasks(
            state.tasks.map((task) =>
              task.id === id
                ? {
                    ...task,
                    status: "failed",
                    message: error,
                    sessionKey: sessionKey ?? task.sessionKey,
                    error,
                    dismissed: false,
                    updatedAt: Date.now(),
                  }
                : task,
            ),
          ),
        })),
      dismissTask: (id) =>
        set((state) => ({
          tasks: state.tasks.map((task) => (task.id === id ? { ...task, dismissed: true } : task)),
        })),
      recoverStaleTasks: (now = Date.now()) =>
        set((state) => ({
          tasks: trimTasks(
            state.tasks.map((task) => {
              if (!isCbeEmployeeTaskActive(task) || now <= task.deadlineAt + STALE_GRACE_MS) {
                return task;
              }
              return {
                ...task,
                status: "failed",
                message: "本地页面超过等待时间仍未收到结构化结果，请查看任务编号或重新提交。",
                error: "本地页面超过等待时间仍未收到结构化结果，请查看任务编号或重新提交。",
                updatedAt: now,
              };
            }),
          ),
        })),
    }),
    {
      name: "sentura-cbe-employee-draft-cache-v1",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        draftCache: state.draftCache,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<CbeEmployeeState> | undefined;
        return {
          ...currentState,
          rows: currentState.rows,
          memoryRows: currentState.memoryRows,
          tasks: currentState.tasks,
          draftCache:
            persisted?.draftCache && typeof persisted.draftCache === "object"
              ? persisted.draftCache
              : currentState.draftCache,
        };
      },
    },
  ),
);
