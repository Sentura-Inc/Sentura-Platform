export { GatewayClient, getGatewayClient } from "./client";
export {
  useGateway,
  useAgents,
  useAgent,
  useSessions,
  useTranscript,
  useApprovals,
  useGatewayEvent,
} from "./hooks";
export type {
  AgentConfig,
  ApprovalRequest,
  BindingConfig,
  ConnectParams,
  EventFrame,
  GatewayClientOptions,
  GatewayEvent,
  GatewayEventType,
  GatewayHealth,
  HelloOk,
  RequestFrame,
  ResponseFrame,
  RpcError,
  SessionSummary,
  TranscriptMessage,
} from "./types";
