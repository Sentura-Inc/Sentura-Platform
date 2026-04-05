# GradSale Admin Panel — Technical Documentation

## Overview

The admin panel is a dedicated **Next.js** web application used exclusively by GradSale's internal team and support staff. It provides tools for moderating disputes, handling user verifications, managing support tickets, reviewing reports, monitoring ratings, and managing the pre-launch waitlist.

**Base URL (production):** `https://admin.gradsale.com` (separate deployment)  
**Framework:** Next.js (App Router)  
**Language:** TypeScript  
**API Base URL:** `NEXT_PUBLIC_API_URL` env var (same backend)

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| HTTP Client | Axios |
| UI | Tailwind CSS + custom components |

---

## Project Structure

```
admin-panel/
├── app/
│   ├── layout.tsx               # Root layout with Providers
│   ├── page.tsx                 # Dashboard / home
│   ├── login/
│   │   └── page.tsx             # Admin login
│   ├── disputes/
│   │   ├── page.tsx             # Disputes list
│   │   └── [id]/page.tsx        # Dispute detail
│   ├── verifications/
│   │   ├── page.tsx             # Verification requests list
│   │   └── [id]/page.tsx        # Verification detail
│   ├── ratings/
│   │   ├── page.tsx             # Ratings overview
│   │   └── [id]/page.tsx        # Rating detail
│   ├── reports/
│   │   ├── page.tsx             # Reports list
│   │   └── [id]/page.tsx        # Report detail
│   ├── support/
│   │   ├── page.tsx             # Support threads list
│   │   └── [id]/page.tsx        # Support thread conversation
│   ├── waitlist/
│   │   └── page.tsx             # Waitlist management
│   ├── email-codes/
│   │   └── page.tsx             # Pending email verifications
│   └── providers.tsx            # Client-side providers wrapper
├── components/
│   ├── DisputeTable.tsx         # Dispute listing table
│   ├── Navbar.tsx               # Admin navigation sidebar/header
│   ├── ProtectedRoute.tsx       # Auth guard wrapper
│   └── StatusBadge.tsx          # Color-coded status display
├── lib/
│   ├── api.ts                   # Axios client with admin auth
│   ├── auth.ts                  # Admin login/logout helpers
│   ├── disputes-api.ts          # Dispute API calls
│   ├── email-verification-api.ts # Email verification API calls
│   ├── ratings-api.ts           # Ratings API calls
│   ├── reports-api.ts           # Reports API calls
│   ├── support-api.ts           # Support API calls
│   ├── waitlist-api.ts          # Waitlist API calls
│   └── utils.ts                 # Shared utilities
├── types/
│   ├── dispute.types.ts         # Dispute TypeScript types
│   └── rating.types.ts          # Rating TypeScript types
└── middleware.ts                 # Next.js middleware for route protection
```

---

## Authentication

### Login Flow
1. Admin navigates to `/login`
2. Submits email + password via `POST /api/auth/admin/login`
3. JWT token stored in `localStorage` under key `admin_token`
4. Subsequent API calls include `Authorization: Bearer <admin_token>` header
5. On 401 response: token cleared and redirected to `/login`

### Middleware (`middleware.ts`)
- Next.js edge middleware intercepts all requests
- Checks for `admin_token` cookie/header on protected routes
- Redirects unauthenticated users to `/login`

### Auth Library (`lib/auth.ts`)
```typescript
// Key functions
adminAuth.login(email, password)     // POST /api/auth/admin/login
adminAuth.logout()                   // Clears localStorage token
adminAuth.getToken()                 // Returns stored admin_token
adminAuth.isLoggedIn()               // Boolean check
```

### API Client (`lib/api.ts`)
- Axios instance with `baseURL = NEXT_PUBLIC_API_URL`
- Request interceptor: reads `admin_token` from `localStorage`
- Response interceptor: on 401, clears token and redirects to `/login`
- `withCredentials: true` for cookie support

---

## Pages & Functionality

### Dashboard (`app/page.tsx`)
- Summary overview of platform activity
- Quick navigation to main admin sections
- Requires admin authentication

### Login (`app/login/page.tsx`)
- Email + password form
- Calls `POST /api/auth/admin/login`
- On success: stores token, redirects to dashboard

---

## Admin Modules

### 1. Disputes (`app/disputes/`)

**Purpose:** Review and resolve buyer disputes on transactions.

#### List Page (`/disputes`)
- Displays all disputes in a table via `DisputeTable` component
- Filter by status: `pending`, `approved`, `rejected`
- Shows: dispute ID, buyer, transaction ID, reason, status, date created

**API Calls:**
```typescript
disputesApi.getAll(status?)   // GET /disputes?status=...
```

#### Detail Page (`/disputes/[id]`)
- Full dispute details: reason, description, transaction info, buyer info
- Admin notes field (free text)
- Action buttons: **Approve** / **Reject**
- On action: `PATCH /disputes/:id/handle`

**API Calls:**
```typescript
disputesApi.getById(id)                    // GET /disputes/:id
disputesApi.handle(disputeId, {            // PATCH /disputes/:id/handle
  action: 'approved' | 'rejected',
  adminNotes: string
})
```

**Dispute Actions:**
| Action | Backend Effect |
|---|---|
| `approved` | Triggers refund to buyer; marks dispute `approved` |
| `rejected` | Closes dispute in buyer's favor dismissed; marks `rejected` |

---

### 2. Verifications (`app/verifications/`)

**Purpose:** Manually review alumni verification submissions from users who cannot verify via `.edu` email.

#### List Page (`/verifications`)
- Shows users with `verificationStatus = 'pending'`
- Columns: user, university, submission date, status

**API Calls:**
```typescript
// GET /users/verification/pending
fetch('/api/users/verification/pending', { headers: { Authorization } })
```

#### Detail Page (`/verifications/[id]`)
- User's profile info, university, graduation year
- Uploaded government ID images (up to 2)
- Uploaded alumni proof images (up to 5)
- Decision buttons: **Approve** / **Reject** (with optional rejection reason)

**API Calls:**
```typescript
// GET /users/:id (public profile)
// POST /users/verification/review/:userId
fetch(`/api/users/verification/review/${userId}`, {
  method: 'POST',
  body: JSON.stringify({ decision: 'verified' | 'rejected', rejectionReason? })
})
```

**Verification Decision Effects:**
| Decision | `verificationStatus` | `isVerified` |
|---|---|---|
| `verified` | `verified` | `true` |
| `rejected` | `rejected` | `false` |

---

### 3. Ratings (`app/ratings/`)

**Purpose:** Monitor and audit user ratings on the platform.

#### List Page (`/ratings`)
- Overview of recent ratings across the platform
- Filter by score, date range, or role (buyer/seller)

**API Calls:**
```typescript
ratingsApi.getAll()             // GET /ratings (admin context)
ratingsApi.getByTransaction(transactionId)  // GET /ratings/transaction/:id/all
```

#### Detail Page (`/ratings/[id]`)
- Full rating: reviewer, reviewee, score (1–5), comment, transaction reference
- Ability to flag or remove problematic reviews

---

### 4. Reports (`app/reports/`)

**Purpose:** Review user-submitted reports for listings, users, and messages.

#### List Page (`/reports`)
- Filter by type (`listing`, `user`, `message`) and status
- Table columns: reporter, type, reason, target, status, date

**API Calls:**
```typescript
reportsApi.getAll(status?, type?)    // GET /reports?status=...&type=...
reportsApi.getStats()                // GET /reports/stats
```

#### Detail Page (`/reports/[id]`)
- Reporter details
- Target reference (listing link / user profile / message context)
- Admin notes field
- Status workflow buttons: **Under Review** → **Resolved** / **Dismissed**

**API Calls:**
```typescript
reportsApi.getById(id)               // GET /reports/:id
reportsApi.update(id, {              // PATCH /reports/:id
  status: 'under_review' | 'resolved' | 'dismissed',
  adminNotes: string
})
```

---

### 5. Support (`app/support/`)

**Purpose:** Respond to customer support tickets (each user has one support thread).

#### List Page (`/support`)
- All support threads with status and last message time
- Filter by status: `open`, `in_progress`, `resolved`, `closed`
- Shows user name, last message preview, status badge

**API Calls:**
```typescript
supportApi.getAllThreads()           // GET /support/admin/threads
```

#### Detail Page (`/support/[id]`)
- Full message history between user and support team
- Text input for admin reply
- Status change dropdown (open → in_progress → resolved → closed)

**API Calls:**
```typescript
supportApi.getThread(threadId)                         // GET /support/admin/threads/:id
supportApi.sendMessage(threadId, body)                 // POST /support/admin/threads/:id/messages
supportApi.updateThreadStatus(threadId, status)        // PATCH /support/admin/threads/:id/status
supportApi.checkSupportUserExists()                    // GET /support/admin/system-user/exists
supportApi.createSupportUser()                         // POST /support/admin/system-user/create
```

**Thread Statuses:**
| Status | Meaning |
|---|---|
| `open` | New, unread ticket |
| `in_progress` | Admin is actively working on it |
| `resolved` | Issue resolved |
| `closed` | Thread archived |

---

### 6. Waitlist (`app/waitlist/`)

**Purpose:** Manage pre-launch email signups.

#### Page (`/waitlist`)
- Total signup count and growth stats
- Paginated table of all emails with signup source and date
- Export CSV button
- Delete individual entries

**API Calls:**
```typescript
waitlistApi.getAll(page, limit)      // GET /waitlist/admin/entries
waitlistApi.getStats()               // GET /waitlist/admin/stats
waitlistApi.exportEmails()           // GET /waitlist/admin/export
waitlistApi.deleteEntry(id)          // DELETE /waitlist/admin/entries/:id
```

---

### 7. Email Verification Codes (`app/email-codes/`)

**Purpose:** View users with pending email verifications (for debugging and manual support).

**API Calls:**
```typescript
// GET /auth/admin/pending-email-verifications
fetch('/api/auth/admin/pending-email-verifications', { headers: { Authorization } })
```

---

## Shared Components

### `ProtectedRoute` (`components/ProtectedRoute.tsx`)
- HOC that wraps all authenticated pages
- Reads `admin_token` from `localStorage`
- Redirects to `/login` if missing

### `Navbar` (`components/Navbar.tsx`)
- Admin navigation with links to all sections:
  - Dashboard
  - Disputes
  - Verifications
  - Ratings
  - Reports
  - Support
  - Waitlist
  - Email Codes
- Logout button

### `StatusBadge` (`components/StatusBadge.tsx`)
- Color-coded badge for statuses across all modules
- `pending` → yellow, `approved`/`resolved`/`verified` → green, `rejected`/`dismissed` → red, `in_progress` → blue

### `DisputeTable` (`components/DisputeTable.tsx`)
- Reusable paginated table for dispute listings
- Sortable columns, clickable rows for detail navigation

---

## TypeScript Types

### `types/dispute.types.ts`
```typescript
interface Dispute {
  id: string;
  transactionId: string;
  buyerId: string;
  reason: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
  handledAt?: string;
  createdAt: string;
  updatedAt: string;
  transaction?: Transaction;
  buyer?: User;
}

interface HandleDisputeRequest {
  disputeId: string;
  action: 'approved' | 'rejected';
  adminNotes?: string;
}
```

### `types/rating.types.ts`
```typescript
interface Rating {
  id: string;
  transactionId: string;
  reviewerId: string;
  revieweeId: string;
  score: number; // 1-5
  comment?: string;
  role: 'buyer' | 'seller';
  createdAt: string;
}
```

---

## Admin Role System

| Role | `AdminUser.role` value | Access |
|---|---|---|
| Support Agent | `support` | Support threads, reports |
| Admin | `admin` | All modules |
| Super Admin | `super_admin` | All modules + admin user management |

---

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL (same as web) |

---

## Security Notes

- Admin tokens are stored in `localStorage` (key: `admin_token`) — separate from user `accessToken`
- All admin-sensitive backend endpoints are guarded by `AdminGuard` which checks JWT role claim
- The admin panel is intended to be deployed on a separate, access-controlled domain
- Support-level operations check `req.user.role === 'admin'` server-side
