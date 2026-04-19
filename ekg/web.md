> **On-demand reference — not read by default.** Consult when working on GradSale's customer-facing web app or mapping web user journeys for agent skills.

# GradSale Web Application — Technical Documentation

## Overview

The web application is the primary browser-based interface for GradSale. It is built with **Next.js 14+ App Router** and provides functionality for buyers and sellers to browse listings, manage their accounts, send messages, process payments, and interact with the marketplace.

**Base URL (production):** `https://gradsale.com`  
**Framework:** Next.js (App Router)  
**Language:** TypeScript  
**Styling:** Tailwind CSS + Shadcn/UI + Radix UI  
**API Base URL:** `NEXT_PUBLIC_API_URL` env var

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Component Library | Shadcn/UI (Radix UI primitives) |
| HTTP Client | Axios |
| Real-time | Socket.IO Client |
| Google Auth | `@react-oauth/google` |
| Maps | Google Maps JS API |
| Payments | Stripe.js |
| State | React hooks (local state, `localStorage`) |

---

## Project Structure

```
web/src/
├── app/                         # Next.js App Router pages
│   ├── page.tsx                 # Home / landing page
│   ├── about/                   # About GradSale page
│   ├── login/                   # Login page
│   ├── signup/                  # Signup flow
│   │   ├── page.tsx             # Signup form
│   │   └── address/             # Address step
│   ├── verify-email/            # Email verification page
│   ├── forgot-password/         # Forgot password
│   ├── reset-password/          # Reset password
│   ├── listings/                # Marketplace
│   │   ├── page.tsx             # Browse listings
│   │   └── [id]/                # Listing detail
│   ├── create-listing/          # Create single listing
│   ├── create-batch-listing/    # Create multiple listings
│   ├── my-listings/             # Seller's own listings
│   ├── profile/
│   │   ├── page.tsx             # Own profile
│   │   └── [id]/                # Public user profile
│   │       └── listings/        # User's public listings
│   ├── edit-profile/            # Edit profile form
│   ├── messages/
│   │   ├── page.tsx             # Thread list
│   │   └── [id]/                # Individual chat
│   ├── cart/                    # Wishlist / cart
│   ├── checkout/                # Checkout flow
│   ├── saved-listings/          # Bookmarked listings
│   ├── transaction-history/
│   │   ├── page.tsx             # Transaction list
│   │   └── [id]/                # Transaction detail
│   ├── create-dispute/[transactionId]/  # Dispute filing
│   ├── notifications/           # Notification center
│   ├── verification/            # Alumni verification submission
│   ├── settings/
│   │   ├── page.tsx             # Settings hub
│   │   ├── payment/             # Payment methods & Stripe setup
│   │   ├── notifications/       # Notification preferences
│   │   ├── blocked-users/       # Manage blocked users
│   │   ├── addresses/           # Saved addresses
│   │   ├── change-password/     # Password change
│   │   └── reported-items/      # User's submitted reports
│   └── api-test/                # Development API test page
├── components/
│   ├── layout/
│   │   ├── Header.tsx           # Global nav header
│   │   └── Footer.tsx           # Global footer
│   ├── messages/                # Chat UI components
│   │   ├── AttachmentMenu.tsx
│   │   ├── ChatHeader.tsx
│   │   ├── ChatMoreMenu.tsx
│   │   ├── ListingSelectionModal.tsx
│   │   ├── LocationSelectionModal.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── MessageInput.tsx
│   │   ├── OrderConfirmationCard.tsx
│   │   ├── PriceProposalModal.tsx
│   │   ├── ThreadListItem.tsx
│   │   ├── TransactionSelectionModal.tsx
│   │   └── TypingIndicator.tsx
│   ├── common/                  # Shared modal components
│   │   ├── AddBatchItemModal.tsx
│   │   ├── BatchListingSuccessModal.tsx
│   │   ├── ConfirmCancelModal.tsx
│   │   ├── CreateListingTypeModal.tsx
│   │   ├── LocationPickerModal.tsx
│   │   ├── MapPreviewModal.tsx
│   │   ├── MultiListingShareModal.tsx
│   │   ├── ResultModal.tsx
│   │   ├── SelectDateModal.tsx
│   │   ├── SetPriceModal.tsx
│   │   ├── ShareModal.tsx
│   │   └── StripeOnboardingModal.tsx
│   ├── providers/
│   │   ├── GoogleAuthProvider.tsx   # Google OAuth context
│   │   └── SocketProvider.tsx       # Socket.IO context
│   ├── ui/                      # Shadcn/UI primitives
│   │   ├── alert.tsx
│   │   ├── avatar.tsx
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── form.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── select.tsx
│   │   ├── separator.tsx
│   │   ├── skeleton.tsx
│   │   └── textarea.tsx
│   ├── AuthRequiredModal.tsx
│   ├── FilterModal.tsx
│   ├── MapModal.tsx
│   ├── MapPreview.tsx
│   ├── RatingModal.tsx
│   ├── ReportModal.tsx
│   ├── ServiceFeeExplainModal.tsx
│   ├── ServiceFeeModal.tsx
│   ├── VerificationBadge.tsx
│   └── WaitlistModal.tsx
└── lib/
    └── api/
        ├── client.ts        # Axios instance with auth interceptors
        ├── auth.ts          # Auth API functions
        ├── cart.ts          # Cart/wishlist API functions
        ├── disputes.ts      # Disputes API functions
        ├── listings.ts      # Listings API functions
        ├── messages.ts      # Messages API functions
        ├── notifications.ts # Notifications API functions
        ├── ratings.ts       # Ratings API functions
        └── reports.ts       # Reports API functions
```

---

## Routing (App Router Pages)

### Public Pages (no authentication required)

| Route | Component | Description |
|---|---|---|
| `/` | `app/page.tsx` | Landing page with waitlist modal |
| `/about` | `app/about/page.tsx` | About GradSale |
| `/login` | `app/login/page.tsx` | Login form |
| `/signup` | `app/signup/page.tsx` | Registration form |
| `/signup/address` | `app/signup/address/page.tsx` | Address entry step |
| `/verify-email` | `app/verify-email/page.tsx` | Email verification with 6-digit code |
| `/forgot-password` | `app/forgot-password/page.tsx` | Request password reset |
| `/reset-password` | `app/reset-password/page.tsx` | Submit reset code |
| `/listings` | `app/listings/page.tsx` | Browse all listings |
| `/listings/[id]` | `app/listings/[id]/page.tsx` | Listing detail |
| `/profile/[id]` | `app/profile/[id]/page.tsx` | Public user profile |
| `/profile/[id]/listings` | `app/profile/[id]/listings/page.tsx` | User's public listings |

### Authenticated Pages (requires login)

| Route | Component | Description |
|---|---|---|
| `/profile` | `app/profile/page.tsx` | Own profile dashboard |
| `/edit-profile` | `app/edit-profile/page.tsx` | Edit profile fields & images |
| `/my-listings` | `app/my-listings/page.tsx` | Manage own listings |
| `/create-listing` | `app/create-listing/page.tsx` | Create a single listing |
| `/create-batch-listing` | `app/create-batch-listing/page.tsx` | Create multiple listings at once |
| `/cart` | `app/cart/page.tsx` | Wishlist management with filter/sort |
| `/checkout` | `app/checkout/page.tsx` | Stripe checkout flow |
| `/saved-listings` | `app/saved-listings/page.tsx` | Bookmarked listings |
| `/messages` | `app/messages/page.tsx` | All message threads |
| `/messages/[id]` | `app/messages/[id]/page.tsx` | Individual chat window |
| `/transaction-history` | `app/transaction-history/page.tsx` | Order history |
| `/transaction-history/[id]` | `app/transaction-history/[id]/page.tsx` | Transaction detail |
| `/create-dispute/[transactionId]` | `app/create-dispute/[transactionId]/page.tsx` | File dispute |
| `/notifications` | `app/notifications/page.tsx` | Notification inbox |
| `/verification` | `app/verification/page.tsx` | Submit alumni verification docs |
| `/settings` | `app/settings/page.tsx` | Settings hub |
| `/settings/payment` | `app/settings/payment/page.tsx` | Payment methods |
| `/settings/notifications` | `app/settings/notifications/page.tsx` | Push notification preferences |
| `/settings/blocked-users` | `app/settings/blocked-users/page.tsx` | Block/unblock users |
| `/settings/addresses` | `app/settings/addresses/page.tsx` | Manage delivery addresses |
| `/settings/change-password` | `app/settings/change-password/page.tsx` | Change password |
| `/settings/reported-items` | `app/settings/reported-items/page.tsx` | View submitted reports |

---

## API Client Architecture

### Base Client (`lib/api/client.ts`)

- **Axios instance** with `baseURL = NEXT_PUBLIC_API_URL`
- **Timeout:** 30,000 ms
- **Request interceptor:** Reads `accessToken` from `localStorage` and attaches `Authorization: Bearer <token>` header
- **Response interceptor (401 handling):**
  - On 401: attempts to refresh token via `POST /auth/refresh` using `refreshToken` from `localStorage`
  - On success: updates tokens and retries original request
  - On refresh failure: clears tokens; redirects to `/login` unless on a public page
  - Public page patterns (no redirect): `/`, `/about`, `/login`, `/signup`, `/listings`, `/profile/:id`

### Token Storage
| Key | Value |
|---|---|
| `localStorage.accessToken` | JWT access token |
| `localStorage.refreshToken` | JWT refresh token |

---

## API Layer (`lib/api/`)

### `auth.ts` — Authentication

| Function | Method | Path | Description |
|---|---|---|---|
| `authApi.login(data)` | POST | `/auth/login` | Email/username login |
| `authApi.googleAuth(data)` | POST | `/auth/google` | Google OAuth |
| `authApi.register(data)` | POST | `/auth/register` | Register new user |
| `authApi.verifyEmail(data)` | POST | `/auth/verify-email` | Verify email with code |
| `authApi.resendVerification(data)` | POST | `/auth/resend-verification` | Resend verification code |
| `authApi.forgotPassword(data)` | POST | `/auth/forgot-password` | Request reset code |
| `authApi.resetPassword(data)` | POST | `/auth/reset-password` | Submit new password |
| `authApi.logout()` | POST | `/auth/logout` | Server-side logout |

### `listings.ts` — Listings

| Function | Description |
|---|---|
| `listingsApi.getAll(params)` | GET all listings with filters |
| `listingsApi.search(query, params)` | Search listings |
| `listingsApi.getById(id)` | Get listing detail |
| `listingsApi.getUserListings(userId)` | Get user's listings |
| `listingsApi.getSimilar(id)` | Get similar listings |
| `listingsApi.create(data)` | Create listing |
| `listingsApi.createBatch(data[])` | Create multiple listings |
| `listingsApi.update(id, data)` | Update listing |
| `listingsApi.delete(id)` | Delete listing |
| `listingsApi.updateStatus(id, status)` | Change listing status |
| `listingsApi.incrementView(id)` | Increment view count |

### `cart.ts` — Wishlist/Cart

| Function | Description |
|---|---|
| `cartApi.getCart(filter?, sortBy?)` | Get wishlist items |
| `cartApi.getCount()` | Get item count |
| `cartApi.addItem(listingId, quantity?)` | Add to wishlist |
| `cartApi.updateItem(id, quantity)` | Update quantity |
| `cartApi.removeItem(id)` | Remove item |
| `cartApi.clearCart()` | Clear all items |
| `cartApi.sendReserveRequests(cartItemIds[])` | Send reserve requests |
| `cartApi.updateReservationStatus(id, status)` | Accept/reject reservation |

### `messages.ts` — Messaging

| Function | Description |
|---|---|
| `messagesApi.getThreads()` | List all threads |
| `messagesApi.getThread(threadId)` | Get thread + messages |
| `messagesApi.createThread(data)` | Start new thread |
| `messagesApi.sendMessage(threadId, data)` | Send message |
| `messagesApi.markMessageRead(messageId)` | Mark message read |
| `messagesApi.markThreadRead(threadId)` | Mark all read |
| `messagesApi.acceptReserve(messageId)` | Accept reserve |
| `messagesApi.declineReserve(messageId)` | Decline reserve |
| `messagesApi.acceptPriceProposal(messageId)` | Accept price |
| `messagesApi.declinePriceProposal(messageId)` | Decline price |
| `messagesApi.completeCheckout(messageId, transactionId)` | Complete checkout |

### `ratings.ts` — Ratings

| Function | Description |
|---|---|
| `ratingsApi.create(data)` | Create rating |
| `ratingsApi.getUserRatings(userId, page?, limit?)` | Get user ratings |
| `ratingsApi.getUserStats(userId)` | Get rating stats |
| `ratingsApi.canRate(transactionId)` | Check if can rate |
| `ratingsApi.getMyRating(transactionId)` | Get own rating |

### `disputes.ts` — Disputes

| Function | Description |
|---|---|
| `disputesApi.create(data)` | File a dispute |
| `disputesApi.getMyDisputes()` | Get own disputes |
| `disputesApi.getEligibility(transactionId)` | Check eligibility |
| `disputesApi.getByTransaction(transactionId)` | Get by transaction |

### `reports.ts` — Reports

| Function | Description |
|---|---|
| `reportsApi.create(data)` | Create a report |
| `reportsApi.getMyReports(type?)` | Get own reports |

### `notifications.ts` — Notifications

| Function | Description |
|---|---|
| `notificationsApi.getAll(type?, limit?)` | Get notifications |
| `notificationsApi.getUnreadCount(type?)` | Unread count |
| `notificationsApi.markRead(id)` | Mark one read |
| `notificationsApi.markAllRead(type?)` | Mark all read |
| `notificationsApi.getPreferences()` | Get preferences |
| `notificationsApi.updatePreferences(data)` | Update preferences |

---

## Real-time (Socket.IO)

### `SocketProvider` (`components/providers/SocketProvider.tsx`)

- Wraps the entire app in a React context
- Connects to `NEXT_PUBLIC_WS_URL/api/messages` namespace
- Auth payload: `{ userId: <currentUserId> }`
- Exposes socket instance via `useSocket()` hook
- Manages thread room joins/leaves

### Events Consumed by Web App

| Event | Handler |
|---|---|
| `new_message` | Append message to active thread |
| `new_thread_message` | Update thread list, show notification badge |
| `message_updated` | Update existing message (accept/decline outcome) |
| `message_read` | Update read indicators |
| `thread_read` | Mark thread unread count as 0 |
| `user_typing` | Show/hide typing indicator |

### Events Emitted by Web App

| Event | When |
|---|---|
| `join_thread` | Opening a chat thread |
| `leave_thread` | Closing a chat thread / navigating away |
| `send_message` | Sending a message via chat input |
| `typing` | User is typing (throttled) |
| `mark_read` | Viewing a message |

---

## Authentication Flow

1. **Login:** User submits email/password → `POST /auth/login` → tokens stored in `localStorage`
2. **Google:** Google ID token → `POST /auth/google` → tokens stored
3. **Email Verification:** After registration, user enters 6-digit code → `POST /auth/verify-email`
4. **Session persistence:** Access token read from `localStorage` on every API call
5. **Token refresh:** On 401, client attempts refresh via `POST /auth/refresh`; on failure, redirects to `/login`
6. **Logout:** Tokens cleared from `localStorage`

---

## Google Auth Provider (`components/providers/GoogleAuthProvider.tsx`)

- Wraps app with `GoogleOAuthProvider` from `@react-oauth/google`
- Client ID from `NEXT_PUBLIC_GOOGLE_CLIENT_ID` env var
- Provides `useGoogleLogin()` hook used on login and signup pages

---

## Listing Creation Flows

### Single Listing (`/create-listing`)
1. Fill title, description, price, category, payment option, images, location, sell-by date
2. `POST /api/listings` with `CreateListingDto`
3. Optional: Stripe onboarding modal if seller has no payment setup

### Batch Listing (`/create-batch-listing`)
1. Add multiple items via `AddBatchItemModal`
2. `POST /api/listings/batch` with array of listings
3. `BatchListingSuccessModal` displayed on success

---

## Checkout Flow (`/checkout`)

1. User selects listings from cart
2. Optionally inputs custom/offer price
3. Payment method selection (saved cards via Stripe)
4. `POST /api/transactions/checkout` or `/bulk-checkout`
5. Stripe payment intent confirmed client-side with Stripe.js
6. On success: redirect to transaction history

---

## Verification Flow (`/verification`)

1. User uploads government ID photos (max 2) and alumni proof (max 5) via `POST /api/upload/images`
2. Submits image URLs via `POST /api/users/verification/submit`
3. Admin reviews in admin panel

---

## Dispute Flow (`/create-dispute/:transactionId`)

1. User selects reason from predefined list
2. Adds description
3. `POST /api/disputes` with `{ transactionId, reason, description }`

---

## Key Components

### `Header` (`components/layout/Header.tsx`)
- Navigation links, search bar, auth state (login/signup or avatar dropdown)
- Cart count badge from `GET /api/cart/count`
- Unread notification badge from `GET /api/notifications/unread/total`

### `MessageBubble` (`components/messages/MessageBubble.tsx`)
- Renders text, media, voice, listing card, location, transaction, price proposal, reserve request, checkout, in-person confirmation attachment types
- Quote-reply rendering

### `MapModal` / `MapPreview` (`components/MapModal.tsx`, `MapPreview.tsx`)
- Google Maps integration for location picking and display

### `VerificationBadge` (`components/VerificationBadge.tsx`)
- Displays verified alumni badge next to usernames

### `WaitlistModal` (`components/WaitlistModal.tsx`)
- Email collection modal shown on the landing page
- `POST /api/waitlist`

---

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
| `NEXT_PUBLIC_WS_URL` | WebSocket server URL |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API key |

---

## Key User Journeys

### New User Registration
`/signup` → Email/Google → Address entry → Email verification → Onboard to marketplace

### Buying
Browse `/listings` → View `/listings/[id]` → Add to wishlist (`/cart`) or message seller → Checkout → Confirm delivery → Rate seller

### Selling
Create listing (`/create-listing`) → Stripe onboarding (`/settings/payment`) → Receive messages → Accept/decline proposals → In-person or online transaction → Rate buyer
