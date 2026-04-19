> **On-demand reference — not read by default.** Consult when modifying GradSale's NestJS backend or designing MCP servers that call into it.

# GradSale Backend — Technical Documentation

## Overview

The backend is a **NestJS** REST API server built on **Node.js** with **TypeScript**. It serves as the single source of truth for all business logic, data persistence, real-time communication, payment processing, push notifications, and file storage.

**Base URL (production):** `https://api.gradsale.com` (configured via `BACKEND_URL` env var)  
**Base URL (development):** `http://localhost:3000`  
**All API routes are prefixed:** `/api/` (set in `main.ts` global prefix)

---

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | ≥ 18 |
| Framework | NestJS | ^11 |
| Language | TypeScript | ^5.7 |
| ORM | Prisma | ^6 |
| Database | PostgreSQL | — |
| Auth | JWT (passport-jwt) | — |
| Real-time | Socket.IO | ^4.8 |
| Payments | Stripe | ^19 |
| Push Notifications | Firebase Admin (FCM) | ^13 |
| File Storage | Google Cloud Storage | ^7 |
| Email | Nodemailer + Handlebars | — |
| Job Scheduling | @nestjs/schedule | ^6 |
| Cache | Redis (ioredis) | ^5 |
| Image Processing | Sharp | ^0.34 |
| Geocoding | Google Maps API (via axios) | — |

---

## Module Architecture

The application is decomposed into feature modules, each encapsulating its own controller, service, and DTOs:

```
src/
├── app.module.ts           # Root module – imports all feature modules
├── main.ts                 # Bootstrap: global prefix, CORS, validation pipe
├── auth/                   # Authentication & authorization
├── users/                  # User profiles & verification
├── listings/               # Marketplace listings
├── messages/               # Messaging (REST + WebSocket)
├── transactions/           # Orders & payment flow
├── stripe/                 # Stripe payment integration
├── cart/                   # Wishlist / cart management
├── saved-items/            # Bookmarked listings
├── ratings/                # Buyer/seller rating system
├── disputes/               # Transaction disputes
├── reports/                # User-generated content reports
├── notifications/          # Push notification management
├── support/                # Customer support threads
├── upload/                 # File uploads (GCP Storage)
├── universities/           # University lookup
├── waitlist/               # Pre-launch email waitlist
├── email/                  # Transactional email service
├── firebase/               # Firebase Admin SDK wrapper
├── prisma/                 # Prisma client provider
└── common/
    ├── controllers/
    │   └── geocoding.controller.ts
    └── services/
        └── geocoding.service.ts
```

---

## Authentication & Authorization

### Strategy
- **JWT Bearer tokens** issued at login / registration / Google OAuth.
- Tokens are stateless; the JWT secret is sourced from `JWT_SECRET` env var.
- Each authenticated request must include `Authorization: Bearer <accessToken>`.

### Guards
| Guard | File | Purpose |
|---|---|---|
| `JwtAuthGuard` | `auth/guards/jwt-auth.guard.ts` | Validates JWT and populates `req.user` |
| `OptionalJwtAuthGuard` | `auth/guards/optional-jwt-auth.guard.ts` | Allows unauthenticated requests; sets `req.user` only when token is present |
| `AdminGuard` | `auth/guards/admin.guard.ts` | Checks `req.user.role === 'admin'` for admin-only endpoints |

### `@Public()` Decorator
Applied to routes that intentionally bypass `JwtAuthGuard` (e.g., `GET /users/:id`).

### Admin Authentication
Admin users (`AdminUser` table) authenticate via `POST /api/auth/admin/login`. The returned token carries `role: 'admin'` in the JWT payload, which is checked by `AdminGuard`.

---

## Auth Module

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register a new user. Sends verification email. |
| POST | `/api/auth/login` | Public | Login with email/username + password. Returns JWT. |
| POST | `/api/auth/google` | Public | Login/register via Google ID token. |
| GET | `/api/auth/me` | JWT | Get the authenticated user's full profile. |
| POST | `/api/auth/logout` | JWT | Client-side token removal (server acknowledges). |
| POST | `/api/auth/verify-email` | Public | Verify email with 6-digit code. |
| POST | `/api/auth/resend-verification` | Public | Resend email verification code. |
| POST | `/api/auth/forgot-password` | Public | Send password reset code to email. |
| POST | `/api/auth/reset-password` | Public | Reset password with code. |
| PATCH | `/api/auth/change-password` | JWT | Change password (requires current password). |
| POST | `/api/auth/admin/login` | Public | Admin panel login. |
| GET | `/api/auth/admin/pending-email-verifications` | JWT | (Admin) List pending email verifications. |

### DTOs

**RegisterDto:**
```typescript
{
  username: string;
  email: string;
  password: string;
  phoneNumber?: string;
  university: string;
  graduationYear: number;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}
```

**LoginDto:**
```typescript
{
  emailOrUsername: string;
  password: string;
  deviceId?: string;
}
```

**GoogleAuthDto:**
```typescript
{
  idToken: string;
  username?: string;
  password?: string;
  university?: string;
  graduationYear?: number;
  deviceId?: string;
}
```

**AuthResponse:**
```typescript
{
  user: { id, email, username, profilePicture, university, graduationYear, isEmailVerified, ... };
  accessToken: string;
  refreshToken: string;
}
```

---

## Users Module

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/users/profile` | JWT | Get own full profile |
| PUT | `/api/users/profile` | JWT | Update own profile |
| POST | `/api/users/profile/picture` | JWT | Upload profile picture (multipart/form-data, field: `image`) |
| POST | `/api/users/profile/cover` | JWT | Upload cover/banner image (multipart/form-data, field: `image`) |
| POST | `/api/users/block` | JWT | Block another user |
| DELETE | `/api/users/block/:userId` | JWT | Unblock a user |
| GET | `/api/users/blocked` | JWT | List blocked users |
| GET | `/api/users/is-blocked/:userId` | JWT | Check if a user is blocked |
| GET | `/api/users/:id` | Public | Get public user profile |
| GET | `/api/users/:id/ratings` | Public | Get user's received ratings |
| GET | `/api/users/:id/transaction-stats` | Public | Get user's transaction stats |
| POST | `/api/users/verification/submit` | JWT | Submit alumni verification documents |
| GET | `/api/users/verification/status` | JWT | Get own verification status |
| GET | `/api/users/verification/pending` | JWT | (Admin) List pending verifications |
| POST | `/api/users/verification/review/:userId` | JWT | (Admin) Approve or reject verification |

### Key DTOs

**UpdateProfileDto:**
```typescript
{
  username?: string;
  phoneNumber?: string;
  university?: string;
  graduationYear?: number;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}
```

**SubmitVerificationDto:**
```typescript
{
  idImageUrls: string[];      // Government ID images (max 2)
  proofImageUrls: string[];   // Alumni proof images (max 5)
}
```

---

## Listings Module

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/listings` | Optional JWT | Get all listings with filters & pagination |
| GET | `/api/listings/search` | Optional JWT | Full-text search listings |
| GET | `/api/listings/user/:userId` | Optional JWT | Get listings by a specific user |
| GET | `/api/listings/:id` | Optional JWT | Get single listing by ID |
| GET | `/api/listings/:id/similar` | Public | Get similar listings |
| POST | `/api/listings` | JWT | Create a new listing |
| POST | `/api/listings/batch` | JWT | Create multiple listings at once |
| PATCH | `/api/listings/:id` | JWT | Update a listing |
| DELETE | `/api/listings/:id` | JWT | Soft-delete a listing |
| PATCH | `/api/listings/:id/status` | JWT | Change listing status |
| POST | `/api/listings/:id/view` | Public | Increment view count |
| POST | `/api/listings/sync-expired` | JWT | Manually trigger expired listing sync |

### Query Parameters (GET /listings, /listings/search)

| Param | Type | Description |
|---|---|---|
| `q` | string | Search query |
| `category` | string | Filter by category |
| `university` | string | Filter by university |
| `minPrice` | number | Minimum price filter |
| `maxPrice` | number | Maximum price filter |
| `paymentOption` | string | `online`, `in-person`, `both` |
| `status` | string | `active`, `sold`, `hidden`, `draft`, `expired` |
| `sortBy` | string | `newest`, `price_low`, `price_high`, `distance` |
| `lat` / `lng` | number | User coordinates for distance sort |
| `page` | number | Pagination page |
| `limit` | number | Items per page |

### Listing Statuses
- `active` — Available for purchase
- `sold` — Transaction completed
- `hidden` — Hidden by seller
- `draft` — Not yet published
- `expired` — Past `sellByDate`

### Scheduler
`ListingsScheduler` runs on a cron schedule to automatically expire listings where `sellByDate` has passed.

---

## Messages Module

### REST Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/messages/threads` | JWT | List all threads for current user |
| GET | `/api/messages/threads/:id` | JWT | Get thread with messages |
| POST | `/api/messages/threads` | JWT | Create a new thread (with optional initial message) |
| POST | `/api/messages/threads/:id/messages` | JWT | Send a message in a thread |
| PATCH | `/api/messages/:id/read` | JWT | Mark a message as read |
| PATCH | `/api/messages/threads/:id/read` | JWT | Mark all messages in thread as read |
| POST | `/api/messages/:messageId/accept-reserve` | JWT | Seller accepts a reserve request |
| POST | `/api/messages/:messageId/decline-reserve` | JWT | Seller declines a reserve request |
| POST | `/api/messages/checkout/:messageId/complete` | JWT | Mark checkout as completed |
| POST | `/api/messages/:messageId/accept-price-proposal` | JWT | Seller accepts a price proposal |
| POST | `/api/messages/:messageId/decline-price-proposal` | JWT | Seller declines a price proposal |

### WebSocket Gateway

**Namespace:** `/api/messages`  
**Connection auth:** `socket.handshake.auth.userId`

#### Client → Server Events

| Event | Payload | Description |
|---|---|---|
| `join_thread` | `{ threadId: string }` | Join a thread room & mark messages as read |
| `leave_thread` | `{ threadId: string }` | Leave a thread room |
| `send_message` | `{ threadId, body, attachmentType?, attachmentUrl?, attachmentMetadata?, voiceDuration?, quotedMessageId? }` | Send a message |
| `typing` | `{ threadId: string, isTyping: boolean }` | Broadcast typing indicator |
| `mark_read` | `{ messageId: string, threadId: string }` | Mark specific message as read |

#### Server → Client Events

| Event | Payload | Description |
|---|---|---|
| `connected` | `{ message, userId }` | Connection established |
| `new_message` | `{ message, threadId }` | New message in a joined thread room |
| `new_thread_message` | `{ message, threadId, thread }` | New message from a non-joined thread |
| `message_updated` | `{ message, threadId }` | Message updated (e.g., reserve accepted/declined) |
| `message_read` | `{ messageId, threadId, readAt, userId }` | Message was read |
| `thread_read` | `{ threadId, userId, readAt }` | All messages in thread marked read |
| `user_typing` | `{ threadId, userId, username, isTyping }` | Typing indicator from other user |

### Attachment Types
| Value | Description |
|---|---|
| `media` | Images or videos |
| `voice` | Voice message |
| `listing` | Shared listing card |
| `location` | Shared location pin |
| `transaction` | Transaction summary card |
| `price_proposal` | Price negotiation request |
| `reserve_request` | Wishlist reserve request |
| `checkout` | Checkout link |
| `in_person_confirmation` | In-person meetup confirmation |

---

## Transactions Module

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/transactions/checkout` | JWT | Create a new online transaction |
| POST | `/api/transactions/bulk-checkout` | JWT | Checkout multiple cart items |
| POST | `/api/transactions/in-person-confirmation` | JWT | Create an in-person transaction confirmation |
| GET | `/api/transactions` | JWT | List transactions (buying/selling), or admin search |
| GET | `/api/transactions/history` | JWT | Get transaction history |
| GET | `/api/transactions/between-users/:otherUserId` | JWT | Get transactions between current user and another |
| GET | `/api/transactions/:id` | JWT | Get specific transaction |
| PATCH | `/api/transactions/:id/status` | JWT | Update transaction status |
| POST | `/api/transactions/:id/confirm` | JWT | Confirm payment |
| POST | `/api/transactions/:id/sync-payment` | JWT | Sync Stripe payment status |
| POST | `/api/transactions/:id/confirm-delivery` | JWT | Buyer confirms delivery received |
| POST | `/api/transactions/:id/cancel-payment` | JWT | Cancel a transaction |
| DELETE | `/api/transactions/:id` | JWT | Soft-delete from transaction history |
| PATCH | `/api/transactions/:id/pickup-address` | JWT | Update pickup address |
| POST | `/api/transactions/admin/trigger-auto-complete` | JWT + AdminGuard | Admin trigger for auto-complete |

### Transaction Statuses
- `pending` — Created, awaiting payment
- `payment_processing` — Stripe processing
- `paid` — Payment authorized (escrow)
- `completed` — Both parties confirmed; funds transferred
- `cancelled` — Cancelled by buyer or seller
- `refunded` — Refunded to buyer

### Payment Flow (Escrow)
1. Buyer initiates checkout → `paid` status, Stripe payment intent created
2. Both buyer and seller confirm pickup/delivery
3. On dual confirmation → `completed`; Stripe transfer to seller

---

## Stripe Module

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/stripe/connect/account` | JWT | Create Stripe Connect account for seller |
| GET | `/api/stripe/connect/account/status` | JWT | Get seller's Stripe account status |
| GET | `/api/stripe/connect/account/dashboard` | JWT | Get Stripe dashboard link |
| POST | `/api/stripe/connect/account/resume` | JWT | Resume onboarding |
| GET | `/api/stripe/connect/account/refresh` | Public | Stripe onboarding refresh redirect |
| GET | `/api/stripe/connect/account/return` | Public | Stripe onboarding success redirect |
| POST | `/api/stripe/payment-methods/setup-intent` | JWT | Create setup intent for saving card |
| GET | `/api/stripe/payment-methods` | JWT | List saved payment methods |
| PATCH | `/api/stripe/payment-methods/:id/default` | JWT | Set default payment method |
| DELETE | `/api/stripe/payment-methods/:id` | JWT | Remove saved payment method |
| POST | `/api/stripe/webhooks` | Public (signature-verified) | Receive Stripe webhook events |

### Webhook Events Handled
| Event | Action |
|---|---|
| `payment_intent.succeeded` | Mark transaction as `paid`, update listing quantity |
| `payment_intent.payment_failed` | Mark transaction as `cancelled` |
| `payment_intent.canceled` | Mark transaction as `cancelled` |
| `account.updated` | Log account update (status synced on demand) |

---

## Cart Module

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/cart` | JWT | Get wishlist items (`?filter=wishlist|reserved&sortBy=nearest|price_high|price_low|deadline`) |
| GET | `/api/cart/count` | JWT | Get wishlist item count |
| POST | `/api/cart` | JWT | Add item to wishlist |
| PUT | `/api/cart/:id` | JWT | Update item quantity |
| DELETE | `/api/cart/:id` | JWT | Remove item |
| DELETE | `/api/cart` | JWT | Clear entire cart |
| POST | `/api/cart/reserve-requests` | JWT | Send reserve requests for selected items |
| PUT | `/api/cart/:id/reservation-status` | JWT | Seller accepts/rejects reservation |

---

## Saved Items Module

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/saved-items` | JWT | Get all saved/bookmarked listings |
| GET | `/api/saved-items/count` | JWT | Get saved items count |
| GET | `/api/saved-items/:listingId/is-saved` | JWT | Check if listing is saved |
| POST | `/api/saved-items/:listingId` | JWT | Save/bookmark a listing |
| DELETE | `/api/saved-items/:listingId` | JWT | Remove saved listing |

---

## Ratings Module

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/ratings` | JWT | Create a new rating for a completed transaction |
| GET | `/api/ratings/user/:userId` | Public | Get paginated ratings for a user |
| GET | `/api/ratings/user/:userId/stats` | Public | Get rating stats (avg, count by score) |
| GET | `/api/ratings/can-rate/:transactionId` | JWT | Check if current user can rate this transaction |
| GET | `/api/ratings/transaction/:transactionId/all` | JWT | Get all ratings for a transaction |
| GET | `/api/ratings/transaction/:transactionId/my-rating` | JWT | Get my rating for a transaction |

### Rating Rules
- Both buyer and seller can rate each other after transaction completion.
- Each user can only submit one rating per transaction (`UNIQUE(transactionId, reviewerId)`).
- Score range: 1–5.

---

## Disputes Module

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/disputes` | JWT | Create a dispute for a completed transaction |
| GET | `/api/disputes` | JWT + AdminGuard | List all disputes (with optional `?status=` filter) |
| GET | `/api/disputes/my-disputes` | JWT | Get current user's disputes |
| GET | `/api/disputes/eligibility/:transactionId` | JWT | Check if transaction is eligible for dispute |
| GET | `/api/disputes/transaction/:transactionId` | JWT | Get dispute by transaction ID |
| GET | `/api/disputes/:id` | JWT | Get specific dispute |
| PATCH | `/api/disputes/:id/handle` | JWT + AdminGuard | Admin: approve or reject a dispute |

---

## Reports Module

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/reports` | JWT | Create a report (listing, user, or message) |
| GET | `/api/reports/my-reports` | JWT | Get own reports |
| GET | `/api/reports/stats` | JWT | Get report statistics (admin) |
| GET | `/api/reports` | JWT | List all reports (admin) |
| GET | `/api/reports/:id` | JWT | Get report by ID |
| PATCH | `/api/reports/:id` | JWT | Update report status (admin) |
| DELETE | `/api/reports/:id` | JWT | Delete report (admin) |

### Report Types
- `listing` — Inappropriate listing
- `user` — User behavior
- `message` — Inappropriate message

### Report Statuses
- `pending` → `under_review` → `resolved` | `dismissed`

---

## Notifications Module

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/notifications/register-device` | JWT | Register FCM device token |
| DELETE | `/api/notifications/unregister-device/:deviceId` | JWT | Unregister device |
| GET | `/api/notifications/preferences` | JWT | Get notification preferences |
| PATCH | `/api/notifications/preferences` | JWT | Update preferences |
| POST | `/api/notifications/test` | JWT | Send test push notification |
| GET | `/api/notifications/logs` | JWT | Get notification logs |
| GET | `/api/notifications` | JWT | Get notifications (`?type=...&limit=...`) |
| PATCH | `/api/notifications/:id/read` | JWT | Mark notification as read |
| PATCH | `/api/notifications/read-all` | JWT | Mark all as read |
| GET | `/api/notifications/unread/count` | JWT | Get unread notification count |
| GET | `/api/notifications/unread/total` | JWT | Get total unread (notifications + messages) |
| POST | `/api/notifications/mark-read-by-data` | JWT | Mark read by payload data |
| GET | `/api/notifications/debug/devices` | JWT | Debug: get device registration status |

### Notification Types
`message`, `transaction`, `listing`, `cart`, `request`, `offer`, `rating`, `report`, `system`, `message_action`

---

## Support Module

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/support/thread` | JWT | Get or create user's support thread |
| GET | `/api/support/admin/threads` | JWT (admin role) | List all support threads |
| GET | `/api/support/admin/threads/:threadId` | JWT (admin role) | Get specific support thread |
| PATCH | `/api/support/admin/threads/:threadId/status` | JWT (admin role) | Update thread status |
| POST | `/api/support/admin/threads/:threadId/messages` | JWT (admin role) | Send message as admin |
| GET | `/api/support/admin/system-user/exists` | JWT (admin role) | Check if support system user exists |
| POST | `/api/support/admin/system-user/create` | JWT (admin role) | Create support system user |

### Thread Statuses
`open` → `in_progress` → `resolved` | `closed`

---

## Upload Module

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/upload/image` | JWT | Upload single image (field: `image`) |
| POST | `/api/upload/images` | JWT | Upload up to 10 images (field: `images`) |
| POST | `/api/upload/profile-picture` | JWT | Upload profile picture |
| POST | `/api/upload/listing-images` | JWT | Upload listing images (max 10) |
| POST | `/api/upload/video` | JWT | Upload video (max 50 MB, field: `video`) |
| POST | `/api/upload/voice` | JWT | Upload voice message (max 10 MB, field: `file`) |
| DELETE | `/api/upload/file` | JWT | Delete a file by URL |
| DELETE | `/api/upload/files` | JWT | Delete multiple files by URLs |

**Storage provider:** Google Cloud Storage  
**Content types:** Images (JPEG, PNG, WebP, GIF), Videos (MP4), Audio (M4A, MP3, WAV, OGG)

---

## Universities Module

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/universities` | Public | List universities (`?search=query`) |

---

## Waitlist Module

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/waitlist` | Public | Add email to waitlist |
| GET | `/api/waitlist/check` | Public | Check if email is on waitlist (`?email=`) |
| GET | `/api/waitlist/admin/entries` | JWT (admin) | List all entries (paginated) |
| GET | `/api/waitlist/admin/stats` | JWT (admin) | Get waitlist statistics |
| GET | `/api/waitlist/admin/export` | JWT (admin) | Export all emails |
| DELETE | `/api/waitlist/admin/entries/:id` | JWT (admin) | Delete waitlist entry |

---

## Geocoding Module

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/geocoding/reverse` | Optional JWT | Reverse geocode coordinates to address (`?lat=&lng=`) |
| GET | `/api/geocoding/search` | Optional JWT | Search for places (`?query=&lat=&lng=`) |
| GET | `/api/geocoding/autocomplete` | Optional JWT | Autocomplete suggestions (`?query=&lat=&lng=`) |
| GET | `/api/geocoding/place` | Optional JWT | Get place details (`?placeId=`) |

---

## Scheduled Jobs

| Job | Module | Trigger | Action |
|---|---|---|---|
| Expire listings | `ListingsScheduler` | Cron | Sets status to `expired` where `sellByDate` has passed |
| Auto-complete transactions | `TransactionsService` | Cron | Auto-completes transactions after hold period |
| Cart expiry notifications | `CartScheduler` | Cron | Sends wishlist deadline warning notifications |
| Rating reminders | `TransactionsService` | Cron | Reminds users to rate completed transactions |

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret |
| `JWT_EXPIRES_IN` | JWT expiry (default: `7d`) |
| `FRONTEND_URL` | Web app URL (for CORS & Stripe redirects) |
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `GCP_PROJECT_ID` | Google Cloud project ID |
| `GCP_BUCKET_NAME` | GCS bucket name |
| `FIREBASE_PROJECT_ID` | Firebase project ID (FCM) |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key (geocoding) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Email SMTP configuration |
| `REDIS_URL` | Redis connection URL |

---

## Error Handling

All errors return standard NestJS HTTP exception format:
```json
{
  "statusCode": 400,
  "message": "Descriptive error message",
  "error": "Bad Request"
}
```

Common status codes:
- `400` — Bad Request / Validation error
- `401` — Unauthorized
- `403` — Forbidden (role check failed)
- `404` — Resource not found
- `409` — Conflict (e.g., duplicate email)
- `500` — Internal Server Error
