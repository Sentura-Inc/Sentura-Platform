> **On-demand reference — not read by default.** Consult when generating admin-side MCP tools for GradSale or auditing admin API behavior.

# GradSale Admin Panel — API Reference

## Overview

This document covers every backend API endpoint consumed exclusively by the GradSale **admin panel** (`/admin-panel`). The admin panel uses the same backend as the web application, but only accesses admin-privileged endpoints.

**API Base URL:** `NEXT_PUBLIC_API_URL` (same backend)  
**Content-Type:** `application/json`  
**Authentication:** JWT Bearer token stored in `localStorage.admin_token`  
**Header:** `Authorization: Bearer <admin_token>`

All admin endpoints require the JWT to carry `role: 'admin'` or `role: 'super_admin'`. The backend enforces this via `AdminGuard`.

---

## Table of Contents

1. [Admin Authentication](#1-admin-authentication)
2. [Disputes Management](#2-disputes-management)
3. [User Verification Review](#3-user-verification-review)
4. [Ratings Oversight](#4-ratings-oversight)
5. [Reports Management](#5-reports-management)
6. [Support Threads](#6-support-threads)
7. [Waitlist Management](#7-waitlist-management)
8. [Email Verification Oversight](#8-email-verification-oversight)
9. [Transactions (Admin View)](#9-transactions-admin-view)

---

## 1. Admin Authentication

### POST `/api/auth/admin/login`
Login to the admin panel.

**Auth:** None

**Request Body:**
```json
{
  "email": "admin@gradsale.com",
  "password": "adminSecurePassword"
}
```

**Response `200`:**
```json
{
  "admin": {
    "id": "uuid",
    "email": "admin@gradsale.com",
    "name": "Admin User",
    "role": "admin"
  },
  "accessToken": "eyJ...",
  "message": "Login successful"
}
```

**Notes:**
- The returned `accessToken` should be stored as `admin_token` in `localStorage`
- Token includes `role` claim used by backend `AdminGuard`
- Token expiry follows `JWT_EXPIRES_IN` config (default: 7 days)

---

## 2. Disputes Management

Admin can view, filter, and resolve all buyer disputes on the platform.

---

### GET `/api/disputes`
List all disputes across the platform.

**Auth:** Required (AdminGuard)

**Query Parameters:**
| Param | Values | Description |
|---|---|---|
| `status` | `pending`, `approved`, `rejected` | Filter by status |

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "transactionId": "uuid",
    "buyerId": "uuid",
    "reason": "Item not as described",
    "description": "The laptop had issues not shown in photos.",
    "status": "pending",
    "adminNotes": null,
    "handledAt": null,
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z",
    "buyer": {
      "id": "uuid",
      "username": "johndoe",
      "email": "john@bu.edu",
      "profilePicture": "https://..."
    },
    "transaction": {
      "id": "uuid",
      "amount": "899.99",
      "status": "completed",
      "listing": {
        "id": "uuid",
        "title": "MacBook Pro 2021",
        "imageUrls": ["https://..."]
      },
      "seller": {
        "id": "uuid",
        "username": "janesmith"
      }
    }
  }
]
```

---

### GET `/api/disputes/:id`
Get detailed view of a specific dispute.

**Auth:** Required (AdminGuard)

**Response `200`:** Full dispute object (same structure as above, fully populated).

---

### PATCH `/api/disputes/:id/handle`
Resolve a dispute (approve or reject).

**Auth:** Required (AdminGuard)

**Request Body:**
```json
{
  "action": "approved",
  "adminNotes": "Refund issued. Seller's listing was misleading."
}
```

**Fields:**
| Field | Type | Required | Description |
|---|---|---|---|
| `action` | `"approved"` \| `"rejected"` | Yes | Decision on the dispute |
| `adminNotes` | string | No | Internal notes visible in admin panel |

**Response `200`:** Updated dispute object.

```json
{
  "id": "uuid",
  "status": "approved",
  "adminNotes": "Refund issued. Seller's listing was misleading.",
  "handledAt": "2024-01-16T09:00:00Z"
}
```

**Side Effects:**
| Action | Backend Effect |
|---|---|
| `approved` | Transaction refunded; buyer receives refund via Stripe; transaction status updated |
| `rejected` | Dispute closed; no refund; dispute status set to `rejected` |

---

## 3. User Verification Review

Admin manually reviews alumni verification submissions from users who cannot use `.edu` email verification.

---

### GET `/api/users/verification/pending`
List all users awaiting manual verification review.

**Auth:** Required (admin role)

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "username": "johndoe",
    "email": "john@gmail.com",
    "university": "Harvard University",
    "graduationYear": 2022,
    "verificationStatus": "pending",
    "verificationType": "manual_alumni",
    "verificationSubmittedAt": "2024-01-14T08:00:00Z",
    "idImageUrls": ["https://storage.url/id1.jpg", "https://storage.url/id2.jpg"],
    "proofImageUrls": ["https://storage.url/proof1.jpg", "https://storage.url/proof2.jpg"]
  }
]
```

---

### GET `/api/users/:id`
Get a specific user's full profile (used to view verification submission details).

**Auth:** Public (no auth required, but admin uses it with context)

**Response `200`:**
```json
{
  "id": "uuid",
  "username": "johndoe",
  "email": "john@gmail.com",
  "university": "Harvard University",
  "graduationYear": 2022,
  "profilePicture": "https://...",
  "isVerified": false,
  "verificationStatus": "pending",
  "verificationType": "manual_alumni",
  "idImageUrls": ["..."],
  "proofImageUrls": ["..."],
  "verificationSubmittedAt": "2024-01-14T08:00:00Z"
}
```

---

### POST `/api/users/verification/review/:userId`
Approve or reject a verification submission.

**Auth:** Required (admin role)

**URL Parameter:** `userId` — the ID of the user being reviewed

**Request Body:**
```json
{
  "decision": "verified",
  "rejectionReason": null
}
```

**Fields:**
| Field | Type | Required | Description |
|---|---|---|---|
| `decision` | `"verified"` \| `"rejected"` | Yes | Approval decision |
| `rejectionReason` | string | Conditionally | Required when `decision = "rejected"` |

**Response `200`:**
```json
{
  "id": "uuid",
  "isVerified": true,
  "verificationStatus": "verified",
  "verificationReviewedAt": "2024-01-16T09:00:00Z",
  "verificationReviewedBy": "admin-uuid"
}
```

**Side Effects:**
| Decision | `verificationStatus` | `isVerified` | User Notification |
|---|---|---|---|
| `verified` | `verified` | `true` | Email/push sent |
| `rejected` | `rejected` | `false` | Email/push with rejection reason |

---

## 4. Ratings Oversight

Admin can view all ratings across the platform for moderation.

---

### GET `/api/ratings/user/:userId`
Get all ratings for a specific user.

**Auth:** None (public — admin uses for context)

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `page` | number | Page number |
| `limit` | number | Items per page |

**Response `200`:**
```json
{
  "ratings": [
    {
      "id": "uuid",
      "transactionId": "uuid",
      "score": 2,
      "comment": "Item was damaged",
      "role": "buyer",
      "reviewer": { "id": "uuid", "username": "janedoe", "profilePicture": "..." },
      "reviewee": { "id": "uuid", "username": "johndoe" },
      "createdAt": "2024-01-10T00:00:00Z"
    }
  ],
  "total": 24,
  "averageScore": 4.2
}
```

---

### GET `/api/ratings/transaction/:transactionId/all`
Get all ratings for a specific transaction.

**Auth:** Required

**Response `200`:** Array of rating objects (buyer and seller ratings for the transaction).

---

### GET `/api/ratings/user/:userId/stats`
Get aggregated rating stats for a user.

**Auth:** None

**Response `200`:**
```json
{
  "averageScore": 4.2,
  "totalRatings": 24,
  "breakdown": { "5": 15, "4": 5, "3": 2, "2": 1, "1": 1 }
}
```

---

## 5. Reports Management

Admin reviews and resolves user-generated reports for listings, users, and messages.

---

### GET `/api/reports`
List all reports.

**Auth:** Required (admin role)

**Query Parameters:**
| Param | Values | Description |
|---|---|---|
| `status` | `pending`, `under_review`, `resolved`, `dismissed` | Filter by status |
| `type` | `listing`, `user`, `message` | Filter by report type |

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "reporterId": "uuid",
    "reportType": "listing",
    "reason": "Prohibited item",
    "description": "This item is not allowed on the platform.",
    "status": "pending",
    "listingId": "uuid",
    "reportedUserId": null,
    "messageId": null,
    "adminNotes": null,
    "reviewedBy": null,
    "reviewedAt": null,
    "createdAt": "2024-01-15T10:00:00Z"
  }
]
```

---

### GET `/api/reports/stats`
Get report statistics overview.

**Auth:** Required (admin role)

**Response `200`:**
```json
{
  "total": 45,
  "pending": 12,
  "under_review": 5,
  "resolved": 22,
  "dismissed": 6,
  "byType": {
    "listing": 25,
    "user": 15,
    "message": 5
  }
}
```

---

### GET `/api/reports/:id`
Get full details of a specific report.

**Auth:** Required

**Response `200`:** Full report object with resolved reporter and target information.

---

### PATCH `/api/reports/:id`
Update a report status (admin action).

**Auth:** Required (admin role)

**Request Body:**
```json
{
  "status": "resolved",
  "adminNotes": "Listing has been removed. Seller warned."
}
```

**Status Workflow:**
```
pending → under_review → resolved | dismissed
```

**Response `200`:** Updated report object.

---

### DELETE `/api/reports/:id`
Delete a report (admin only).

**Auth:** Required (admin role)  
**Response `200`:** `{ "message": "Report deleted" }`

---

## 6. Support Threads

Admin handles user support conversations through a dedicated support thread system.

---

### GET `/api/support/admin/threads`
List all customer support threads.

**Auth:** Required (admin role)

**Response `200`:**
```json
[
  {
    "id": "thread-uuid",
    "isSupport": true,
    "supportStatus": "open",
    "lastMessageAt": "2024-01-15T12:00:00Z",
    "createdAt": "2024-01-15T10:00:00Z",
    "participants": [
      {
        "userId": "uuid",
        "user": {
          "id": "uuid",
          "username": "johndoe",
          "email": "john@bu.edu",
          "profilePicture": "..."
        }
      }
    ],
    "messages": [
      {
        "id": "msg-uuid",
        "body": "Hi, I need help with my order.",
        "senderId": "uuid",
        "createdAt": "2024-01-15T10:00:00Z",
        "readAt": null
      }
    ]
  }
]
```

---

### GET `/api/support/admin/threads/:threadId`
Get a specific support thread with full message history.

**Auth:** Required (admin role)

**Response `200`:** Full thread object with all messages, participant info.

---

### PATCH `/api/support/admin/threads/:threadId/status`
Update support thread status.

**Auth:** Required (admin role)

**Request Body:**
```json
{ "status": "in_progress" }
```

**Valid Status Values:**
| Status | Meaning |
|---|---|
| `open` | New ticket, not yet handled |
| `in_progress` | Admin is actively responding |
| `resolved` | Issue has been resolved |
| `closed` | Thread archived |

**Response `200`:** Updated thread object.

---

### POST `/api/support/admin/threads/:threadId/messages`
Send a reply message in a support thread (as admin/system).

**Auth:** Required (admin role)

**Request Body:**
```json
{ "body": "Thank you for contacting us. We have resolved your issue." }
```

**Response `201`:** Message object.

```json
{
  "id": "msg-uuid",
  "threadId": "thread-uuid",
  "senderId": "support-system-user-id",
  "body": "Thank you for contacting us. We have resolved your issue.",
  "createdAt": "2024-01-16T09:00:00Z"
}
```

---

### GET `/api/support/admin/system-user/exists`
Check if the support system user exists in the database.

**Auth:** Required (admin role)

**Response `200`:** `{ "exists": true }`

**Notes:** The support system user is a special `User` record that acts as the sender for all admin support messages. It must be created before support messaging can work.

---

### POST `/api/support/admin/system-user/create`
Create the support system user (one-time setup).

**Auth:** Required (admin role)

**Response `201`:**
```json
{
  "id": "support-user-uuid",
  "username": "GradSale Support",
  "email": "support@gradsale.com"
}
```

---

## 7. Waitlist Management

Admin manages the pre-launch email waitlist.

---

### GET `/api/waitlist/admin/entries`
List all waitlist email entries (paginated).

**Auth:** Required (admin role)

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 50) |

**Response `200`:**
```json
{
  "entries": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "source": "home",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1250,
  "page": 1,
  "limit": 50,
  "totalPages": 25
}
```

---

### GET `/api/waitlist/admin/stats`
Get waitlist statistics.

**Auth:** Required (admin role)

**Response `200`:**
```json
{
  "total": 1250,
  "bySource": {
    "website": 800,
    "home": 350,
    "about": 100
  },
  "recentSignups": {
    "last24h": 15,
    "last7days": 95,
    "last30days": 340
  }
}
```

---

### GET `/api/waitlist/admin/export`
Export all waitlist emails as a list.

**Auth:** Required (admin role)

**Response `200`:**
```json
{
  "emails": ["user1@example.com", "user2@example.com"],
  "total": 1250,
  "exportedAt": "2024-01-16T09:00:00Z"
}
```

---

### DELETE `/api/waitlist/admin/entries/:id`
Delete a specific waitlist entry.

**Auth:** Required (admin role)

**Response `200`:** `{ "message": "Entry deleted" }`

---

## 8. Email Verification Oversight

Admin can view users with pending email verifications for debugging and manual support.

---

### GET `/api/auth/admin/pending-email-verifications`
List users whose email is not yet verified.

**Auth:** Required (admin JWT)

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "email": "john@bu.edu",
    "username": "johndoe",
    "isEmailVerified": false,
    "emailVerificationAttempts": 2,
    "emailVerificationExpiry": "2024-01-15T12:00:00Z",
    "createdAt": "2024-01-15T10:00:00Z"
  }
]
```

---

## 9. Transactions (Admin View)

Admin can search and view all transactions across the platform for oversight and dispute investigation.

---

### GET `/api/transactions`
Get all transactions with search and filter (admin context).

**Auth:** Required

When called with admin-specific query parameters (`status`, `search`, `page`, `limit`), the backend returns platform-wide results instead of user-specific results.

**Query Parameters (admin mode):**
| Param | Type | Description |
|---|---|---|
| `status` | string | Filter by transaction status |
| `search` | string | Search by buyer/seller username or listing title |
| `page` | number | Page (default: 1) |
| `limit` | number | Items per page (default: 20) |

**Response `200`:**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "status": "completed",
      "amount": "899.99",
      "paymentMethod": "online",
      "buyerConfirmed": true,
      "sellerConfirmed": true,
      "buyer": { "id": "...", "username": "johndoe", "email": "john@bu.edu" },
      "seller": { "id": "...", "username": "janesmith", "email": "jane@bu.edu" },
      "listing": { "id": "...", "title": "MacBook Pro 2021" },
      "paidAt": "2024-01-10T12:00:00Z",
      "completedAt": "2024-01-12T15:00:00Z",
      "createdAt": "2024-01-10T10:00:00Z"
    }
  ],
  "total": 450,
  "page": 1,
  "limit": 20
}
```

---

### GET `/api/transactions/:id`
Get full transaction detail (admin can access any transaction).

**Auth:** Required

**Response `200`:** Full transaction object including buyer, seller, listing, Stripe info, dispute, and ratings.

---

### POST `/api/transactions/admin/trigger-auto-complete`
Manually trigger the auto-complete scheduler for transactions past their hold period.

**Auth:** Required (AdminGuard)

**Response `200`:**
```json
{
  "message": "Auto-complete triggered",
  "completedCount": 3
}
```

---

## Error Responses

All errors follow standard NestJS format:

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### Admin-specific Error Scenarios

| Scenario | Status Code | Message |
|---|---|---|
| Missing/expired admin token | `401` | `Unauthorized` |
| Non-admin role accessing admin route | `403` | `Forbidden resource` |
| Dispute already handled | `400` | `Dispute has already been handled` |
| User verification already reviewed | `400` | `Verification already reviewed` |
| Support system user not created | `404` | `Support system user not found` |
| Waitlist entry not found | `404` | `Waitlist entry not found` |

---

## Admin Permission Matrix

| Operation | `support` role | `admin` role | `super_admin` role |
|---|---|---|---|
| View support threads | ✅ | ✅ | ✅ |
| Reply to support threads | ✅ | ✅ | ✅ |
| View disputes | ❌ | ✅ | ✅ |
| Handle disputes | ❌ | ✅ | ✅ |
| Review verifications | ❌ | ✅ | ✅ |
| Manage reports | ❌ | ✅ | ✅ |
| View waitlist | ❌ | ✅ | ✅ |
| Export waitlist | ❌ | ✅ | ✅ |
| View all transactions | ❌ | ✅ | ✅ |
| Trigger auto-complete | ❌ | ✅ | ✅ |
| Create admin users | ❌ | ❌ | ✅ |
