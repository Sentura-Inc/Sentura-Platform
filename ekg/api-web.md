> **On-demand reference — not read by default.** Consult when generating storefront/web MCP tools for GradSale or testing customer-facing workflows.

# GradSale Web Application — API Reference

## Overview

This document covers every backend API endpoint consumed by the GradSale **web application** (`/web`). All requests go to the backend at `NEXT_PUBLIC_API_URL`. Authenticated endpoints require `Authorization: Bearer <accessToken>` in the header.

**Content-Type:** `application/json` (unless multipart/form-data for file uploads)  
**Authentication:** JWT Bearer token stored in `localStorage.accessToken`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Users](#2-users)
3. [Listings](#3-listings)
4. [Cart / Wishlist](#4-cart--wishlist)
5. [Saved Items](#5-saved-items)
6. [Messages](#6-messages)
7. [Transactions](#7-transactions)
8. [Stripe / Payments](#8-stripe--payments)
9. [Ratings](#9-ratings)
10. [Disputes](#10-disputes)
11. [Reports](#11-reports)
12. [Notifications](#12-notifications)
13. [Support](#13-support)
14. [File Upload](#14-file-upload)
15. [Universities](#15-universities)
16. [Waitlist](#16-waitlist)
17. [Geocoding](#17-geocoding)

---

## 1. Authentication

### POST `/api/auth/register`
Register a new user account.

**Auth:** None

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@university.edu",
  "password": "securePassword123",
  "phoneNumber": "+1234567890",
  "university": "Boston University",
  "graduationYear": 2024,
  "address": "123 Main St",
  "city": "Boston",
  "state": "MA",
  "zipCode": "02101"
}
```

**Response `201`:**
```json
{
  "message": "Registration successful. Please verify your email."
}
```

---

### POST `/api/auth/login`
Login with email/username and password.

**Auth:** None

**Request Body:**
```json
{
  "emailOrUsername": "john@university.edu",
  "password": "securePassword123",
  "deviceId": "device-uuid-optional"
}
```

**Response `200`:**
```json
{
  "user": {
    "id": "uuid",
    "email": "john@university.edu",
    "username": "johndoe",
    "profilePicture": "https://storage.url/image.jpg",
    "university": "Boston University",
    "graduationYear": 2024,
    "isEmailVerified": true
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

---

### POST `/api/auth/google`
Login or register via Google OAuth.

**Auth:** None

**Request Body:**
```json
{
  "idToken": "google_id_token_here",
  "username": "johndoe",
  "university": "Boston University",
  "graduationYear": 2024,
  "deviceId": "device-uuid-optional"
}
```

**Response `200`:** Same as login response.

---

### GET `/api/auth/me`
Get authenticated user's full profile.

**Auth:** Required

**Response `200`:**
```json
{
  "id": "uuid",
  "email": "john@university.edu",
  "username": "johndoe",
  "university": "Boston University",
  "graduationYear": 2024,
  "profilePicture": null,
  "coverImage": null,
  "isEmailVerified": true,
  "isVerified": false,
  "verificationStatus": "unverified",
  "stripeOnboardingComplete": false,
  "address": "123 Main St",
  "city": "Boston",
  "state": "MA",
  "zipCode": "02101"
}
```

---

### POST `/api/auth/logout`
Logout (server acknowledgment; client clears tokens).

**Auth:** Required  
**Response `200`:** `{ "message": "Logged out successfully" }`

---

### POST `/api/auth/verify-email`
Verify email address with 6-digit code.

**Auth:** None

**Request Body:**
```json
{ "email": "john@university.edu", "code": "123456" }
```

**Response `200`:** `{ "message": "Email verified successfully" }`

---

### POST `/api/auth/resend-verification`
Resend email verification code.

**Auth:** None

**Request Body:**
```json
{ "email": "john@university.edu" }
```

**Response `200`:** `{ "message": "Verification code sent" }`

---

### POST `/api/auth/forgot-password`
Request a password reset code.

**Auth:** None

**Request Body:**
```json
{ "email": "john@university.edu" }
```

**Response `200`:** `{ "message": "Reset code sent to your email" }`

---

### POST `/api/auth/reset-password`
Submit new password using reset code.

**Auth:** None

**Request Body:**
```json
{
  "email": "john@university.edu",
  "code": "123456",
  "newPassword": "newSecurePassword123"
}
```

**Response `200`:** AuthResponse (same as login).

---

### PATCH `/api/auth/change-password`
Change password while authenticated.

**Auth:** Required

**Request Body:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

**Response `200`:** `{ "message": "Password changed successfully" }`

---

## 2. Users

### GET `/api/users/profile`
Get own full profile.

**Auth:** Required

**Response `200`:** Full user object (same as `/auth/me`).

---

### PUT `/api/users/profile`
Update own profile.

**Auth:** Required

**Request Body:**
```json
{
  "username": "newUsername",
  "phoneNumber": "+1234567890",
  "university": "MIT",
  "graduationYear": 2025,
  "address": "456 New St",
  "city": "Cambridge",
  "state": "MA",
  "zipCode": "02139"
}
```

**Response `200`:** Updated user object.

---

### POST `/api/users/profile/picture`
Upload profile picture.

**Auth:** Required  
**Content-Type:** `multipart/form-data`  
**Field:** `image` (file)

**Response `200`:**
```json
{ "profilePicture": "https://storage.url/profile-pictures/uuid/image.jpg" }
```

---

### POST `/api/users/profile/cover`
Upload cover/banner image.

**Auth:** Required  
**Content-Type:** `multipart/form-data`  
**Field:** `image` (file)

**Response `200`:**
```json
{ "coverImage": "https://storage.url/cover-images/uuid/image.jpg" }
```

---

### GET `/api/users/:id`
Get public user profile.

**Auth:** None

**Response `200`:**
```json
{
  "id": "uuid",
  "username": "johndoe",
  "profilePicture": "...",
  "university": "Boston University",
  "graduationYear": 2024,
  "isVerified": true,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

---

### GET `/api/users/:id/ratings`
Get user's ratings.

**Auth:** None  
**Response `200`:** Array of rating objects.

---

### GET `/api/users/:id/transaction-stats`
Get user's transaction statistics.

**Auth:** None

**Response `200`:**
```json
{
  "totalSales": 15,
  "totalPurchases": 8,
  "completedTransactions": 22
}
```

---

### POST `/api/users/block`
Block a user.

**Auth:** Required

**Request Body:**
```json
{ "blockedUserId": "uuid" }
```

**Response `200`:** Block record.

---

### DELETE `/api/users/block/:userId`
Unblock a user.

**Auth:** Required  
**Response `200`:** `{ "message": "User unblocked" }`

---

### GET `/api/users/blocked`
List blocked users.

**Auth:** Required  
**Response `200`:** Array of user objects.

---

### GET `/api/users/is-blocked/:userId`
Check if a user is blocked by you.

**Auth:** Required  
**Response `200`:** `{ "isBlocked": true | false }`

---

### POST `/api/users/verification/submit`
Submit alumni verification documents.

**Auth:** Required

**Request Body:**
```json
{
  "idImageUrls": ["https://storage.url/image1.jpg", "https://storage.url/image2.jpg"],
  "proofImageUrls": ["https://storage.url/proof1.jpg"]
}
```

**Response `200`:** `{ "message": "Verification submitted" }`

---

### GET `/api/users/verification/status`
Get own verification status.

**Auth:** Required

**Response `200`:**
```json
{
  "isVerified": false,
  "verificationStatus": "pending",
  "verificationType": "manual_alumni",
  "submittedAt": "2024-01-01T00:00:00Z"
}
```

---

## 3. Listings

### GET `/api/listings`
Browse all marketplace listings.

**Auth:** Optional (enables distance calculation if provided)

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `q` | string | Search query |
| `category` | string | Category filter |
| `university` | string | University filter |
| `minPrice` | number | Minimum price |
| `maxPrice` | number | Maximum price |
| `paymentOption` | string | `online`, `in-person`, `both` |
| `status` | string | Default: `active` |
| `sortBy` | string | `newest`, `price_low`, `price_high`, `distance` |
| `lat` / `lng` | number | Coordinates for distance sort |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |

**Response `200`:**
```json
{
  "listings": [...],
  "total": 120,
  "page": 1,
  "limit": 20,
  "totalPages": 6
}
```

---

### GET `/api/listings/search`
Search listings by keyword.

**Auth:** Optional  
**Query Params:** Same as GET `/listings`, with `q` being the search term.

---

### GET `/api/listings/user/:userId`
Get listings from a specific user.

**Auth:** Optional

**Response `200`:** Array of listing objects.

---

### GET `/api/listings/:id`
Get a single listing's full detail.

**Auth:** Optional

**Response `200`:**
```json
{
  "id": "uuid",
  "title": "MacBook Pro 2021",
  "description": "Excellent condition...",
  "price": "899.99",
  "openToOffers": true,
  "lowestPrice": "750.00",
  "category": "Electronics",
  "paymentOption": "both",
  "university": "Boston University",
  "imageUrls": ["https://..."],
  "status": "active",
  "viewCount": 45,
  "inquiryCount": 3,
  "sellByDate": "2024-06-01T00:00:00Z",
  "location": { "latitude": 42.35, "longitude": -71.10, "address": "Boston, MA" },
  "user": {
    "id": "uuid",
    "username": "johndoe",
    "profilePicture": "...",
    "isVerified": true
  },
  "createdAt": "2024-01-15T00:00:00Z"
}
```

---

### GET `/api/listings/:id/similar`
Get similar listings.

**Auth:** None  
**Response `200`:** Array of listing objects.

---

### POST `/api/listings`
Create a new listing.

**Auth:** Required

**Request Body:**
```json
{
  "title": "MacBook Pro 2021",
  "description": "Excellent condition, barely used",
  "price": 899.99,
  "category": "Electronics",
  "paymentOption": "both",
  "imageUrls": ["https://storage.url/image1.jpg"],
  "university": "Boston University",
  "openToOffers": true,
  "lowestPrice": 750,
  "sellByDate": "2024-06-01T00:00:00Z",
  "location": {
    "latitude": 42.35,
    "longitude": -71.10,
    "address": "Boston, MA",
    "name": "Boston University Campus"
  }
}
```

**Response `201`:** Created listing object.

---

### POST `/api/listings/batch`
Create multiple listings at once.

**Auth:** Required  
**Request Body:** Array of `CreateListingDto` objects.  
**Response `201`:** Array of created listing objects.

---

### PATCH `/api/listings/:id`
Update a listing.

**Auth:** Required (must be listing owner)  
**Request Body:** Partial `CreateListingDto`.  
**Response `200`:** Updated listing object.

---

### DELETE `/api/listings/:id`
Soft-delete a listing.

**Auth:** Required (must be owner)  
**Response `200`:** `{ "message": "Listing deleted" }`

---

### PATCH `/api/listings/:id/status`
Update listing status.

**Auth:** Required (must be owner)

**Request Body:**
```json
{ "status": "hidden" }
```

**Allowed values:** `active`, `hidden`, `draft`  
**Response `200`:** Updated listing object.

---

### POST `/api/listings/:id/view`
Increment view count.

**Auth:** None  
**Response `200`:** `{ "viewCount": 46 }`

---

## 4. Cart / Wishlist

### GET `/api/cart`
Get wishlist items.

**Auth:** Required

**Query Parameters:**
| Param | Values | Description |
|---|---|---|
| `filter` | `wishlist`, `reserved` | Filter by reservation status |
| `sortBy` | `nearest`, `price_high`, `price_low`, `deadline` | Sort order |

**Response `200`:**
```json
[
  {
    "id": "cart-uuid",
    "listingId": "listing-uuid",
    "quantity": 1,
    "reservationStatus": "none",
    "addedAt": "2024-01-01T00:00:00Z",
    "listing": { ... }
  }
]
```

---

### GET `/api/cart/count`
Get wishlist item count (for badge).

**Auth:** Required  
**Response `200`:** `{ "count": 5 }`

---

### POST `/api/cart`
Add listing to wishlist.

**Auth:** Required

**Request Body:**
```json
{ "listingId": "uuid", "quantity": 1 }
```

**Response `201`:** CartItem object.

---

### PUT `/api/cart/:id`
Update cart item quantity.

**Auth:** Required  
**Request Body:** `{ "quantity": 2 }`  
**Response `200`:** Updated CartItem.

---

### DELETE `/api/cart/:id`
Remove item from cart.

**Auth:** Required  
**Response `200`:** `{ "message": "Item removed" }`

---

### DELETE `/api/cart`
Clear entire cart.

**Auth:** Required  
**Response `200`:** `{ "message": "Cart cleared" }`

---

### POST `/api/cart/reserve-requests`
Send reserve requests for selected items (creates reserve messages).

**Auth:** Required

**Request Body:**
```json
{ "cartItemIds": ["cart-uuid-1", "cart-uuid-2"] }
```

**Response `200`:** Array of created message threads.

---

### PUT `/api/cart/:id/reservation-status`
Seller accepts or rejects a reservation.

**Auth:** Required (must be seller)

**Request Body:**
```json
{ "status": "accepted" | "rejected" }
```

**Response `200`:** Updated CartItem.

---

## 5. Saved Items

### GET `/api/saved-items`
Get all bookmarked listings.

**Auth:** Required  
**Response `200`:** Array of `{ id, listingId, savedAt, listing: {...} }`.

---

### GET `/api/saved-items/count`
Get saved items count.

**Auth:** Required  
**Response `200`:** `{ "count": 3 }`

---

### GET `/api/saved-items/:listingId/is-saved`
Check if listing is bookmarked.

**Auth:** Required  
**Response `200`:** `{ "isSaved": true }`

---

### POST `/api/saved-items/:listingId`
Bookmark a listing.

**Auth:** Required  
**Response `201`:** SavedItem object.

---

### DELETE `/api/saved-items/:listingId`
Remove bookmark.

**Auth:** Required  
**Response `200`:** `{ "message": "Removed from saved" }`

---

## 6. Messages

### GET `/api/messages/threads`
List all message threads for current user.

**Auth:** Required

**Response `200`:**
```json
[
  {
    "id": "thread-uuid",
    "lastMessageAt": "2024-01-01T12:00:00Z",
    "participants": [
      { "userId": "uuid", "user": { "username": "jane", "profilePicture": "..." } }
    ],
    "messages": [{ "id": "...", "body": "Last message", "readAt": null }],
    "isSupport": false
  }
]
```

---

### GET `/api/messages/threads/:id`
Get thread with all messages.

**Auth:** Required

**Response `200`:** Thread object including full `messages` array.

---

### POST `/api/messages/threads`
Create a new thread (optionally with initial message).

**Auth:** Required

**Request Body:**
```json
{
  "recipientId": "uuid",
  "body": "Hi, is this still available?",
  "listingId": "optional-listing-uuid",
  "attachmentType": "listing",
  "attachmentMetadata": { "listingId": "uuid", "title": "MacBook Pro" }
}
```

**Response `201`:** Thread object with participants and messages.

---

### POST `/api/messages/threads/:id/messages`
Send a message in an existing thread.

**Auth:** Required

**Request Body:**
```json
{
  "body": "Message text",
  "attachmentType": "media",
  "attachmentUrl": "https://storage.url/image.jpg",
  "attachmentMetadata": null,
  "voiceDuration": null,
  "quotedMessageId": null
}
```

**Response `201`:** Message object.

---

### PATCH `/api/messages/:id/read`
Mark a message as read.

**Auth:** Required  
**Response `200`:** Updated message with `readAt` timestamp.

---

### PATCH `/api/messages/threads/:id/read`
Mark all messages in thread as read.

**Auth:** Required  
**Response `200`:** `{ "message": "Thread marked as read" }`

---

### POST `/api/messages/:messageId/accept-reserve`
Seller accepts a reserve request message.

**Auth:** Required

**Response `200`:**
```json
{
  "checkoutMessage": { ... }
}
```

---

### POST `/api/messages/:messageId/decline-reserve`
Seller declines a reserve request.

**Auth:** Required  
**Response `200`:** Updated message object.

---

### POST `/api/messages/:messageId/accept-price-proposal`
Seller accepts a price proposal.

**Auth:** Required

**Response `200`:**
```json
{
  "priceProposalMessage": { ... },
  "checkoutMessage": { ... }
}
```

---

### POST `/api/messages/:messageId/decline-price-proposal`
Seller declines a price proposal.

**Auth:** Required  
**Response `200`:** Updated message object.

---

### POST `/api/messages/checkout/:messageId/complete`
Mark a checkout message as completed after payment.

**Auth:** Required

**Request Body:**
```json
{ "transactionId": "uuid" }
```

**Response `200`:**
```json
{
  "checkoutMessage": { ... },
  "transactionMessage": { ... }
}
```

---

## 7. Transactions

### POST `/api/transactions/checkout`
Create a new online transaction.

**Auth:** Required

**Request Body:**
```json
{
  "listingId": "uuid",
  "quantity": 1,
  "paymentMethodId": "pm_stripe_id",
  "customPrice": 800.00
}
```

**Response `201`:** Transaction object with `stripePaymentIntentId` and client secret.

---

### POST `/api/transactions/bulk-checkout`
Checkout multiple cart items.

**Auth:** Required

**Request Body:**
```json
{
  "items": [
    { "listingId": "uuid1", "quantity": 1, "customPrice": null },
    { "listingId": "uuid2", "quantity": 1, "customPrice": 50 }
  ],
  "paymentMethodId": "pm_stripe_id"
}
```

**Response `201`:** Array of transaction objects.

---

### POST `/api/transactions/in-person-confirmation`
Create an in-person meetup transaction.

**Auth:** Required

**Request Body:**
```json
{
  "listingId": "uuid",
  "sellerId": "uuid",
  "amount": 50.00,
  "pickupAddress": "BU Campus, Boston MA"
}
```

**Response `201`:** Transaction object.

---

### GET `/api/transactions`
List current user's transactions.

**Auth:** Required

**Query Parameters:**
| Param | Values | Description |
|---|---|---|
| `type` | `buying`, `selling` | Filter by role |

**Response `200`:** Array of transaction objects.

---

### GET `/api/transactions/history`
Get transaction history.

**Auth:** Required

**Query Parameters:** `type` = `bought` | `sold`  
**Response `200`:** Paginated transaction array.

---

### GET `/api/transactions/:id`
Get a specific transaction.

**Auth:** Required (must be buyer or seller)

**Response `200`:**
```json
{
  "id": "uuid",
  "status": "paid",
  "amount": "899.99",
  "paymentMethod": "online",
  "buyerConfirmed": false,
  "sellerConfirmed": false,
  "buyer": { "id": "...", "username": "..." },
  "seller": { "id": "...", "username": "..." },
  "listing": { ... },
  "createdAt": "2024-01-01T00:00:00Z"
}
```

---

### POST `/api/transactions/:id/confirm-delivery`
Buyer confirms they received the item.

**Auth:** Required  
**Response `200`:** Updated transaction.

---

### POST `/api/transactions/:id/cancel-payment`
Cancel a transaction.

**Auth:** Required

**Request Body:**
```json
{ "reason": "Item not as described" }
```

**Response `200`:** Updated transaction with `cancelled` status.

---

### DELETE `/api/transactions/:id`
Hide transaction from own history (soft delete).

**Auth:** Required  
**Response `200`:** `{ "message": "Transaction removed from history" }`

---

### PATCH `/api/transactions/:id/pickup-address`
Update in-person pickup address.

**Auth:** Required

**Request Body:**
```json
{
  "pickupAddress": "123 Main St, Boston MA",
  "pickupLatitude": 42.35,
  "pickupLongitude": -71.10
}
```

**Response `200`:** Updated transaction.

---

## 8. Stripe / Payments

### POST `/api/stripe/connect/account`
Create a Stripe Connect account for selling.

**Auth:** Required  
**Response `201`:**
```json
{
  "accountId": "acct_...",
  "onboardingUrl": "https://connect.stripe.com/setup/..."
}
```

---

### GET `/api/stripe/connect/account/status`
Get Stripe account status.

**Auth:** Required

**Response `200`:**
```json
{
  "accountId": "acct_...",
  "status": "verified",
  "onboardingComplete": true,
  "chargesEnabled": true,
  "payoutsEnabled": true
}
```

---

### POST `/api/stripe/connect/account/resume`
Resume incomplete Stripe onboarding.

**Auth:** Required  
**Response `200`:** `{ "onboardingUrl": "https://connect.stripe.com/..." }`

---

### POST `/api/stripe/payment-methods/setup-intent`
Create setup intent to save a payment card.

**Auth:** Required  
**Response `200`:** `{ "clientSecret": "seti_..." }`

---

### GET `/api/stripe/payment-methods`
List saved payment methods.

**Auth:** Required

**Response `200`:**
```json
[
  {
    "id": "pm_...",
    "type": "card",
    "card": { "brand": "visa", "last4": "4242", "expMonth": 12, "expYear": 2025 },
    "isDefault": true
  }
]
```

---

### PATCH `/api/stripe/payment-methods/:id/default`
Set default payment method.

**Auth:** Required  
**Response `200`:** `{ "message": "Default payment method updated" }`

---

### DELETE `/api/stripe/payment-methods/:id`
Remove a saved payment method.

**Auth:** Required  
**Response `204`:** No content.

---

## 9. Ratings

### POST `/api/ratings`
Create a rating for a completed transaction.

**Auth:** Required

**Request Body:**
```json
{
  "transactionId": "uuid",
  "score": 5,
  "comment": "Great seller, fast response!"
}
```

**Response `201`:** Rating object.

---

### GET `/api/ratings/user/:userId`
Get paginated ratings for a user.

**Auth:** None

**Query Parameters:** `page`, `limit`

**Response `200`:**
```json
{
  "ratings": [
    {
      "id": "uuid",
      "score": 5,
      "comment": "Excellent!",
      "role": "buyer",
      "reviewer": { "username": "jane", "profilePicture": "..." },
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 24,
  "averageScore": 4.8
}
```

---

### GET `/api/ratings/user/:userId/stats`
Get rating statistics for a user.

**Auth:** None

**Response `200`:**
```json
{
  "averageScore": 4.8,
  "totalRatings": 24,
  "breakdown": { "5": 20, "4": 3, "3": 1, "2": 0, "1": 0 }
}
```

---

### GET `/api/ratings/can-rate/:transactionId`
Check if current user can submit a rating.

**Auth:** Required  
**Response `200`:** `{ "canRate": true }`

---

### GET `/api/ratings/transaction/:transactionId/my-rating`
Get own submitted rating for a transaction.

**Auth:** Required  
**Response `200`:** Rating object or `null`.

---

## 10. Disputes

### POST `/api/disputes`
File a dispute for a transaction.

**Auth:** Required

**Request Body:**
```json
{
  "transactionId": "uuid",
  "reason": "Item not as described",
  "description": "The MacBook had a cracked screen that was not shown in photos."
}
```

**Response `201`:** Dispute object.

---

### GET `/api/disputes/my-disputes`
Get current user's disputes.

**Auth:** Required  
**Response `200`:** Array of dispute objects.

---

### GET `/api/disputes/eligibility/:transactionId`
Check if transaction is eligible for a dispute.

**Auth:** Required

**Response `200`:**
```json
{
  "eligible": true,
  "reason": null
}
```

---

### GET `/api/disputes/transaction/:transactionId`
Get the dispute for a specific transaction.

**Auth:** Required  
**Response `200`:** Dispute object.

---

## 11. Reports

### POST `/api/reports`
Submit a report.

**Auth:** Required

**Request Body:**
```json
{
  "reportType": "listing",
  "reason": "Prohibited item",
  "description": "This item violates marketplace rules.",
  "listingId": "uuid",
  "reportedUserId": null,
  "messageId": null
}
```

**Report Types:** `listing`, `user`, `message`  
**Response `201`:** Report object.

---

### GET `/api/reports/my-reports`
Get own submitted reports.

**Auth:** Required

**Query Parameters:** `type` = `listing` | `user` | `message`  
**Response `200`:** Array of report objects.

---

## 12. Notifications

### GET `/api/notifications`
Get notification inbox.

**Auth:** Required

**Query Parameters:**
| Param | Values |
|---|---|
| `type` | `all`, `transaction`, `listing`, `cart`, `request`, `offer`, `rating`, `report`, `system`, `message_action` |
| `limit` | number |

**Response `200`:** Array of notification log objects.

---

### PATCH `/api/notifications/:id/read`
Mark notification as read.

**Auth:** Required  
**Response `200`:** Updated notification.

---

### PATCH `/api/notifications/read-all`
Mark all notifications as read.

**Auth:** Required

**Query Parameters:** `type` (optional, mark only specific type)  
**Response `200`:** `{ "message": "Notifications marked as read" }`

---

### GET `/api/notifications/unread/count`
Get unread notification count (excluding messages).

**Auth:** Required  
**Response `200`:** `{ "count": 3 }`

---

### GET `/api/notifications/unread/total`
Get total unread count (notifications + messages), used for app badge.

**Auth:** Required  
**Response `200`:** `{ "total": 7, "notifications": 3, "messages": 4 }`

---

### GET `/api/notifications/preferences`
Get notification preferences.

**Auth:** Required  
**Response `200`:** NotificationPreferences object.

---

### PATCH `/api/notifications/preferences`
Update notification preferences.

**Auth:** Required

**Request Body:**
```json
{
  "pushEnabled": true,
  "messagesEnabled": true,
  "transactionsEnabled": true,
  "listingsEnabled": true,
  "cartEnabled": true,
  "ratingsEnabled": true,
  "quietHoursEnabled": true,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "08:00"
}
```

**Response `200`:** Updated preferences.

---

### POST `/api/notifications/register-device`
Register device for push notifications.

**Auth:** Required

**Request Body:**
```json
{
  "deviceId": "unique-device-id",
  "fcmToken": "firebase-cloud-messaging-token",
  "platform": "android"
}
```

**Response `201`:** DeviceToken object.

---

### DELETE `/api/notifications/unregister-device/:deviceId`
Unregister device.

**Auth:** Required  
**Response `200`:** `{ "message": "Device unregistered" }`

---

### POST `/api/notifications/mark-read-by-data`
Mark notification read by type/resource (used on notification tap).

**Auth:** Required

**Request Body:**
```json
{
  "type": "transaction",
  "transactionId": "uuid",
  "listingId": null,
  "threadId": null
}
```

**Response `200`:** `{ "message": "Notification marked as read" }`

---

## 13. Support

### GET `/api/support/thread`
Get or create the current user's support thread.

**Auth:** Required

**Response `200`:** MessageThread object (with messages).

---

## 14. File Upload

### POST `/api/upload/image`
Upload a single image.

**Auth:** Required  
**Content-Type:** `multipart/form-data`  
**Field:** `image`

**Response `200`:**
```json
{ "url": "https://storage.url/uploads/uuid/filename.jpg", "filename": "filename.jpg" }
```

---

### POST `/api/upload/images`
Upload up to 10 images.

**Auth:** Required  
**Content-Type:** `multipart/form-data`  
**Field:** `images` (multiple)

**Response `200`:** Array of `{ url, filename }`.

---

### POST `/api/upload/listing-images`
Upload listing images (max 10).

**Auth:** Required  
**Content-Type:** `multipart/form-data`  
**Field:** `images`

**Response `200`:** Array of `{ url, filename }`.

---

### POST `/api/upload/video`
Upload a video (max 50 MB).

**Auth:** Required  
**Content-Type:** `multipart/form-data`  
**Field:** `video`

**Response `200`:** `{ url, filename, duration? }`

---

### POST `/api/upload/voice`
Upload a voice message (max 10 MB).

**Auth:** Required  
**Content-Type:** `multipart/form-data`  
**Field:** `file`

**Response `200`:** `{ url, filename }`

---

### DELETE `/api/upload/file`
Delete a file from storage.

**Auth:** Required

**Request Body:**
```json
{ "fileUrl": "https://storage.url/path/to/file.jpg" }
```

**Response `200`:** `{ "message": "File deleted successfully" }`

---

## 15. Universities

### GET `/api/universities`
List universities for selection dropdowns.

**Auth:** None

**Query Parameters:** `search` (optional keyword)

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "name": "Boston University",
    "domain": "bu.edu",
    "city": "Boston",
    "state": "MA",
    "country": "United States"
  }
]
```

---

## 16. Waitlist

### POST `/api/waitlist`
Add email to the pre-launch waitlist.

**Auth:** None

**Request Body:**
```json
{ "email": "user@example.com", "source": "home" }
```

**Response `201`:** `{ "message": "Added to waitlist" }`

---

### GET `/api/waitlist/check`
Check if email is on the waitlist.

**Auth:** None

**Query Parameters:** `email`  
**Response `200`:** `{ "isOnWaitlist": true }`

---

## 17. Geocoding

### GET `/api/geocoding/reverse`
Reverse geocode coordinates to address.

**Auth:** Optional

**Query Parameters:** `lat` (float), `lng` (float)

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "address": "123 Commonwealth Ave, Boston, MA 02215",
    "city": "Boston",
    "state": "MA",
    "zipCode": "02215"
  }
}
```

---

### GET `/api/geocoding/search`
Search for places by name.

**Auth:** Optional

**Query Parameters:** `query` (string), `lat` (float, optional), `lng` (float, optional)

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "placeId": "ChIJ...",
      "name": "Boston University",
      "address": "One Silber Way, Boston, MA",
      "latitude": 42.35,
      "longitude": -71.10
    }
  ]
}
```

---

### GET `/api/geocoding/autocomplete`
Get address autocomplete suggestions.

**Auth:** Optional

**Query Parameters:** `query`, `lat` (optional), `lng` (optional)

**Response `200`:**
```json
{
  "success": true,
  "data": [
    { "placeId": "ChIJ...", "description": "Boston University, Boston, MA" }
  ]
}
```

---

### GET `/api/geocoding/place`
Get detailed place info by Google Place ID.

**Auth:** Optional

**Query Parameters:** `placeId`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "placeId": "ChIJ...",
    "name": "Boston University",
    "address": "One Silber Way, Boston, MA 02215",
    "latitude": 42.35,
    "longitude": -71.10
  }
}
```

---

## WebSocket API

**URL:** `NEXT_PUBLIC_WS_URL/api/messages`  
**Auth:** Pass `userId` in handshake auth: `{ auth: { userId } }`

### Client → Server

| Event | Payload | Purpose |
|---|---|---|
| `join_thread` | `{ threadId }` | Enter a chat room |
| `leave_thread` | `{ threadId }` | Leave a chat room |
| `send_message` | `{ threadId, body, attachmentType?, attachmentUrl?, attachmentMetadata?, voiceDuration?, quotedMessageId? }` | Send message |
| `typing` | `{ threadId, isTyping }` | Typing indicator |
| `mark_read` | `{ messageId, threadId }` | Mark message read |

### Server → Client

| Event | Payload | Purpose |
|---|---|---|
| `connected` | `{ message, userId }` | Confirm connection |
| `new_message` | `{ message, threadId }` | New message in active thread |
| `new_thread_message` | `{ message, threadId, thread }` | New message in background thread |
| `message_updated` | `{ message, threadId }` | Message state changed |
| `message_read` | `{ messageId, threadId, readAt, userId }` | Message was read |
| `thread_read` | `{ threadId, userId, readAt }` | Thread marked fully read |
| `user_typing` | `{ threadId, userId, username, isTyping }` | Typing indicator |

---

## Error Responses

All errors follow:
```json
{
  "statusCode": 400,
  "message": "Detailed error message",
  "error": "Bad Request"
}
```

| Code | Meaning |
|---|---|
| `400` | Validation failed / bad input |
| `401` | Not authenticated |
| `403` | Forbidden (wrong role/owner) |
| `404` | Resource not found |
| `409` | Conflict (e.g., duplicate entry) |
| `500` | Server error |
