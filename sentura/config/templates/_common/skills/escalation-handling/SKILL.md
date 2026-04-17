# Escalation Handling

## When to Use

Any time during a session when one or more escalation conditions is met. This skill is invoked automatically by the agent's own judgment; it is not a user-invoked skill.

Core triggers:

- Explicit user request: "I want to talk to a human" / "escalate this" / "manager"
- Emotion signals: sustained frustration, profanity at the bot, threats of churn/cancellation/legal action
- Complexity: question outside this agent's skills or tools
- Policy: rule in RULES.md requires approval (e.g., refund above threshold, discount above cap, action against a flagged account)
- Risk: mention of self-harm, fraud, regulated behavior (HIPAA, SEC, GDPR data subject request)
- Uncertainty: agent confidence is low (< 70%) on a factual or consequential answer

## Procedure

1. **Detect the trigger**. State explicitly in the internal trace WHICH trigger fired (for audit).

2. **Do NOT continue to act on the risky/out-of-scope item**. Pause action immediately.

3. **Classify severity**:
   - P0 (Critical, <15min): self-harm, active fraud, regulatory breach, enterprise-wide outage
   - P1 (High, <1hr): angry customer about to churn, blocking production issue, compliance edge case
   - P2 (Normal, <1 business day): out-of-scope question, policy clarification
   - P3 (Low, next business day): informational, non-blocking

4. **Select the handoff target** based on CONTEXT.md escalation table + trigger type:
   - Finance/payment issues → finance manager
   - HR/employment → HR lead
   - Legal/contracts → legal contact
   - Tech blocker → on-call engineer (via PagerDuty if available)
   - Customer anger → shift supervisor or manager on duty
   - Default: `{escalation_target}`

5. **Compose the handoff message** with this structure:

   ```
   🚨 Escalation — {P0/P1/P2/P3}

   **From**: {agent-id} ({role})
   **User/Session**: {user display name or userToken + session link}
   **Trigger**: {explicit trigger that fired}

   **Context**:
   {1-3 sentence summary of the conversation}

   **What the user needs**:
   {their request in their own words if possible}

   **What I've done so far**:
   - ...

   **Why I'm escalating (not handling directly)**:
   {cite the RULES.md rule or skill gap}

   **Suggested next action**:
   {recommendation if confident}

   **Session link**: {deep link to conversation}
   ```

6. **Route to the handoff channel**:
   - Slack DM to the individual AND a #escalations channel for visibility.
   - If P0/P1: also send SMS/page via the ops channel.
   - If the escalation target is offline (outside business hours per CONTEXT.md), escalate one level up.

7. **Inform the user clearly**:

   > "I'm connecting you with {target name} who can help with this directly. They'll reach out shortly. Is there anything urgent I should flag to them?"

   Do NOT make promises about response time unless CONTEXT.md defines an SLA.

8. **Stay in the loop (optional)**. If the channel supports it, leave the session open so the human can pick up mid-thread rather than starting over.

9. **Log the escalation** to the audit trail with:
   - Timestamp (UTC)
   - Trigger
   - Severity
   - Target
   - Outcome (pending until resolution)

   Use `sentura.audit.append` with event type `escalation.raised`.

10. **Follow up**. If no acknowledgment within the SLA for that severity, escalate one level up. Do NOT let escalations die silently.

## Tools Needed

- `slack` / `teams` — notify escalation target
- `sms` / `pagerduty` — for P0/P1 out-of-hours
- `sentura.audit.append` — audit log
- `fs_read` — consult CONTEXT.md escalation table

## Safety

- NEVER attempt to resolve an issue that triggered an escalation on your own after the escalation is sent
- NEVER expose PII or T3/T4 data in the escalation message to out-of-scope channels
- NEVER promise resolution timeframes not in CONTEXT.md SLAs
- ALWAYS cite the specific RULES.md rule or skill gap that caused the escalation (for audit)
- ALWAYS include a session deep link so the human has full context
- ALWAYS apply the data-classification tag to the escalation message
- ALWAYS record the escalation in the audit log — no silent handoffs
