# Support Triage

## When to Use

When a new support thread arrives or a user sends a help request through any channel.

## Procedure

1. **Read the support thread** via `gradsale-admin` MCP:
   - `GET /api/admin/support` to list open threads
   - `GET /api/admin/support/:id` for specific thread details
   - Identify: user ID, issue description, category, priority

2. **Look up the user** via `gradsale-web` MCP:
   - `GET /api/users/:id` to get user profile
   - Check account status, university, join date
   - Check for previous support history and disputes

3. **Categorize the issue**:
   - **Dispute** (buyer/seller conflict) → route to dispute-resolution skill
   - **Account issue** (login, verification, suspension) → handle directly via admin API
   - **Listing issue** (inappropriate content, scam) → review and take action
   - **Payment issue** (refund, charge error) → check transaction via admin API
   - **Bug report** → document and escalate to Engineering
   - **Feature request** → acknowledge and log
   - **Fraud/safety** → escalate immediately to Admin Team

4. **Set priority**:
   - **Urgent**: Fraud, safety concerns, payment errors
   - **High**: Active disputes, account suspensions
   - **Medium**: General support questions, verification issues
   - **Low**: Feature requests, general feedback

5. **Update the support thread** via admin API:
   - Set status to `in_progress`
   - Add internal notes with triage assessment
   - Assign priority

6. **Respond to the user**:
   - Acknowledge their issue
   - Provide expected resolution timeline
   - If solution is straightforward, provide it immediately
   - If investigation needed, explain next steps

## Tools Needed

- `gradsale-admin` MCP — support thread management, user verification
- `gradsale-web` MCP — user profile lookup, listing details
- `message` — respond to user

## Safety

- NEVER share user data between different users' support threads
- NEVER close a thread without informing the user
- ALWAYS escalate fraud and safety reports immediately
- ALWAYS log every action taken on a support thread
