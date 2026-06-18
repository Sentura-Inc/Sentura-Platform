"use client";

const taskControllers = new Map<string, AbortController>();

export function createCbeEmployeeTaskAbortSignal(taskId: string) {
  const current = taskControllers.get(taskId);
  if (current && !current.signal.aborted) current.abort();
  const controller = new AbortController();
  taskControllers.set(taskId, controller);
  return controller.signal;
}

export function cancelCbeEmployeeRuntimeTask(taskId: string) {
  const controller = taskControllers.get(taskId);
  if (!controller) return false;
  if (!controller.signal.aborted) controller.abort();
  return true;
}

export function clearCbeEmployeeTaskAbortSignal(taskId: string) {
  taskControllers.delete(taskId);
}
