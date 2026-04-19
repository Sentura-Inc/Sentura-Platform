> **On-demand reference — not read by default.** Consult when building MCP servers against GradSale, ingesting enterprise knowledge, or writing ekg/ skills. The GradSale docs are the canonical test enterprise per `.cursorrules` rule 17.

# GradSale Database — Technical Documentation

## Overview

GradSale uses **PostgreSQL** as its primary relational database, accessed via the **Prisma ORM**. The schema is defined in `/backend/prisma/schema.prisma` and managed through Prisma Migrate.

**Database:** PostgreSQL  
**ORM:** Prisma v6  
**Connection:** Configured via `DATABASE_URL` environment variable  
**ID Strategy:** UUID v4 for all primary keys  
**Timestamps:** `createdAt` (auto-set), `updatedAt` (auto-updated) on most tables

---

## Entity Relationship Overview

```
User ─────────────────────────────────────────────────────────────┐
  │                                                                │
  ├── Listing[] (userId)                                          │
  │     ├── CartItem[] (listingId)                                │
  │     ├── SavedItem[] (listingId)                               │
  │     └── Transaction[] (listingId)                             │
  │                                                               │
  ├── Message[] (senderId)                                        │
  ├── ThreadParticipant[] (userId)                                │
  │     └── MessageThread ───── Message[]                        │
  │                                                               │
  ├── Transaction[] as buyer (buyerId)                           │
  ├── Transaction[] as seller (sellerId)                         │
  │     ├── Rating[] (transactionId)                              │
  │     └── Dispute? (transactionId)                             │
  │                                                               │
  ├── Rating[] as reviewer (reviewerId)                          │
  ├── Rating[] as reviewee (revieweeId)                          │
  │                                                               │
  ├── CartItem[] (userId)                                         │
  ├── SavedItem[] (userId)                                        │
  ├── DeviceToken[] (userId)                                      │
  ├── NotificationPreferences? (userId)                           │
  ├── NotificationLog[] (userId)                                  │
  └── Dispute[] as buyer (buyerId)                               │

AdminUser (separate — no FK to User)                            │
University (standalone lookup table)                             │
WaitlistEntry (standalone)                                       │
BlockedUser (self-referencing User relationship)                 │
Report (references User, Listing, Message by ID — no FK)        │
```

---

## Tables

---

### `users`

The core user account table for all marketplace participants (buyers and sellers).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(UUID)` | PK, default: `uuid()` | Unique user identifier |
| `email` | `VARCHAR` | UNIQUE, NOT NULL | Login email |
| `google_id` | `VARCHAR` | UNIQUE, nullable | Google OAuth ID |
| `password_hash` | `VARCHAR` | NOT NULL | bcrypt hashed password |
| `username` | `VARCHAR` | UNIQUE, NOT NULL | Display name / handle |
| `phone_number` | `VARCHAR` | nullable | Optional phone number |
| `university` | `VARCHAR` | NOT NULL | University affiliation |
| `graduation_year` | `INT` | NOT NULL | Expected/actual graduation year |
| `profile_picture` | `VARCHAR` | nullable | GCS URL for profile photo |
| `cover_image` | `VARCHAR` | nullable | GCS URL for banner image |
| `auth_provider` | `VARCHAR` | default: `'email'` | `'email'` or `'google'` |
| `address` | `VARCHAR` | nullable | Street address |
| `city` | `VARCHAR` | nullable | City |
| `state` | `VARCHAR` | nullable | State |
| `zip_code` | `VARCHAR` | nullable | ZIP code |
| `latitude` | `DECIMAL(10,7)` | nullable | Geocoded latitude (~1cm precision) |
| `longitude` | `DECIMAL(10,7)` | nullable | Geocoded longitude |
| `stripe_customer_id` | `VARCHAR` | UNIQUE, nullable | Stripe customer ID (buyer) |
| `stripe_account_id` | `VARCHAR` | UNIQUE, nullable | Stripe Connect account (seller) |
| `stripe_account_status` | `VARCHAR` | nullable | `'pending'`, `'verified'`, `'restricted'` |
| `stripe_onboarding_complete` | `BOOLEAN` | default: `false` | Stripe onboarding completion |
| `device_id` | `VARCHAR` | nullable | Current logged-in device identifier |
| `session_token` | `VARCHAR` | nullable | Current session token |
| `last_login_at` | `TIMESTAMP` | nullable | Last login timestamp |
| `is_email_verified` | `BOOLEAN` | default: `false` | Email verification status |
| `email_verification_code` | `VARCHAR` | nullable | 6-digit verification code |
| `email_verification_expiry` | `TIMESTAMP` | nullable | Code expiry timestamp |
| `email_verification_attempts` | `INT` | default: `0` | Rate limiting counter |
| `password_reset_code` | `VARCHAR` | nullable | 6-digit reset code |
| `password_reset_expiry` | `TIMESTAMP` | nullable | Reset code expiry |
| `password_reset_attempts` | `INT` | default: `0` | Rate limiting counter |
| `is_verified` | `BOOLEAN` | default: `false` | Alumni verification status |
| `verification_type` | `VARCHAR` | nullable | `'edu_email'`, `'manual_alumni'`, `null` |
| `verification_status` | `VARCHAR` | default: `'unverified'` | `'unverified'`, `'pending'`, `'verified'`, `'rejected'` |
| `id_image_urls` | `VARCHAR[]` | default: `[]` | Government ID image URLs (max 2) |
| `proof_image_urls` | `VARCHAR[]` | default: `[]` | Alumni proof image URLs (max 5) |
| `verification_submitted_at` | `TIMESTAMP` | nullable | When user submitted for review |
| `verification_reviewed_at` | `TIMESTAMP` | nullable | When admin reviewed |
| `verification_reviewed_by` | `VARCHAR` | nullable | Admin user ID who reviewed |
| `verification_rejection_reason` | `VARCHAR` | nullable | Reason for rejection |
| `created_at` | `TIMESTAMP` | default: `now()` | Account creation time |
| `updated_at` | `TIMESTAMP` | auto-updated | Last update time |

**Indexes:** `email` (UNIQUE), `google_id` (UNIQUE), `username` (UNIQUE), `stripe_customer_id` (UNIQUE), `stripe_account_id` (UNIQUE)

---

### `listings`

Marketplace items posted by sellers.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(UUID)` | PK | Unique listing ID |
| `user_id` | `VARCHAR` | FK → `users.id`, NOT NULL | Seller's user ID |
| `title` | `VARCHAR` | NOT NULL | Listing title |
| `description` | `TEXT` | NOT NULL | Detailed description |
| `price` | `DECIMAL(10,2)` | NOT NULL | Asking price |
| `open_to_offers` | `BOOLEAN` | default: `false` | Whether seller accepts offers |
| `lowest_price` | `DECIMAL(10,2)` | nullable | Minimum acceptable offer price |
| `category` | `VARCHAR` | NOT NULL | Item category (Electronics, Furniture, etc.) |
| `payment_option` | `VARCHAR` | nullable | `'online'`, `'in-person'`, `'both'` |
| `location` | `JSONB` | nullable | `{ latitude, longitude, address, name }` |
| `university` | `VARCHAR` | NOT NULL | Associated university |
| `sell_by_date` | `TIMESTAMP` | nullable | Date seller wants item sold by |
| `image_urls` | `VARCHAR[]` | NOT NULL | Array of GCS image URLs |
| `status` | `VARCHAR` | default: `'active'` | `'active'`, `'sold'`, `'hidden'`, `'draft'`, `'expired'` |
| `view_count` | `INT` | default: `0` | Total view count |
| `inquiry_count` | `INT` | default: `0` | Number of message inquiries |
| `created_at` | `TIMESTAMP` | default: `now()` | Creation timestamp |
| `updated_at` | `TIMESTAMP` | auto-updated | Last update |
| `deleted_at` | `TIMESTAMP` | nullable | Soft delete timestamp |
| `original_price` | `DECIMAL(10,2)` | nullable | (deprecated) Original purchase price |
| `condition` | `VARCHAR` | nullable | (deprecated) Item condition |
| `brand` | `VARCHAR` | nullable | (deprecated) Brand name |
| `dimensions` | `VARCHAR` | nullable | (deprecated) Dimensions |
| `color` | `VARCHAR` | nullable | (deprecated) Color |
| `is_negotiable` | `BOOLEAN` | default: `false` | (deprecated) Negotiable flag |
| `availability_start` | `TIMESTAMP` | nullable | (deprecated) |
| `availability_end` | `TIMESTAMP` | nullable | (deprecated) |
| `original_image_urls` | `VARCHAR[]` | default: `[]` | (deprecated) |
| `quantity` | `INT` | default: `1` | Available quantity |

**Indexes:** `user_id`, `status`, `category`, `university`

---

### `message_threads`

Conversation containers between two users (also used for support tickets).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(UUID)` | PK | Unique thread ID |
| `last_message_at` | `TIMESTAMP` | default: `now()` | When last message was sent |
| `created_at` | `TIMESTAMP` | default: `now()` | Thread creation time |
| `updated_at` | `TIMESTAMP` | auto-updated | Last update |
| `is_support` | `BOOLEAN` | default: `false` | Whether this is a support thread |
| `support_status` | `VARCHAR` | nullable | `'open'`, `'in_progress'`, `'resolved'`, `'closed'` |

**Indexes:** `is_support`

---

### `thread_participants`

Join table: users participating in a message thread.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `user_id` | `VARCHAR` | FK → `users.id`, PK | Participant user ID |
| `thread_id` | `VARCHAR` | FK → `message_threads.id`, PK | Thread ID |
| `joined_at` | `TIMESTAMP` | default: `now()` | When user joined the thread |

**Primary Key:** Composite (`user_id`, `thread_id`)  
**Indexes:** `thread_id`

---

### `messages`

Individual messages within a thread.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(UUID)` | PK | Message ID |
| `thread_id` | `VARCHAR` | FK → `message_threads.id` | Parent thread |
| `sender_id` | `VARCHAR` | FK → `users.id` | Sender's user ID |
| `body` | `TEXT` | NOT NULL | Message text content |
| `read_at` | `TIMESTAMP` | nullable | When message was read |
| `created_at` | `TIMESTAMP` | default: `now()` | Send timestamp |
| `attachment_type` | `VARCHAR` | nullable | `'media'`, `'voice'`, `'listing'`, `'location'`, `'transaction'`, `'price_proposal'`, `'reserve_request'`, `'checkout'`, `'in_person_confirmation'` |
| `attachment_url` | `VARCHAR` | nullable | GCS URL for media/voice attachments |
| `attachment_metadata` | `JSONB` | nullable | JSON data for listing/location/transaction/proposal cards |
| `voice_duration` | `INT` | nullable | Voice message duration (seconds) |
| `quoted_message_id` | `VARCHAR` | FK → `messages.id` (self-ref, SetNull), nullable | ID of quoted message |

**Indexes:** `thread_id`, `quoted_message_id`

---

### `cart_items`

Wishlist / cart items. Tracks reservation states for seller coordination.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(UUID)` | PK | Cart item ID |
| `user_id` | `VARCHAR` | FK → `users.id` | Buyer's user ID |
| `listing_id` | `VARCHAR` | FK → `listings.id` | The listed item |
| `quantity` | `INT` | default: `1` | Quantity desired |
| `added_at` | `TIMESTAMP` | default: `now()` | When added to cart |
| `reservation_status` | `VARCHAR` | default: `'none'` | `'none'`, `'pending'`, `'accepted'`, `'rejected'` |
| `reserve_requested_at` | `TIMESTAMP` | nullable | When reserve request was sent |
| `reserve_accepted_at` | `TIMESTAMP` | nullable | When seller accepted |
| `last_view_count_notified` | `INT` | default: `0` | Last view milestone for notifications |
| `notified_7_days_remaining` | `BOOLEAN` | default: `false` | 7-day deadline notification sent |
| `notified_3_days_remaining` | `BOOLEAN` | default: `false` | 3-day deadline notification sent |
| `notified_1_day_remaining` | `BOOLEAN` | default: `false` | 1-day deadline notification sent |

**Indexes:** `user_id`, `listing_id`, `reservation_status`

---

### `saved_items`

Bookmarked listings (separate from cart/wishlist).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(UUID)` | PK | Saved item ID |
| `user_id` | `VARCHAR` | FK → `users.id` | User who saved |
| `listing_id` | `VARCHAR` | FK → `listings.id` | Saved listing |
| `saved_at` | `TIMESTAMP` | default: `now()` | When saved |

**Unique Constraint:** `(user_id, listing_id)` — prevents duplicate saves  
**Indexes:** `user_id`, `listing_id`

---

### `transactions`

Records of all completed or in-progress purchases between buyers and sellers.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(UUID)` | PK | Transaction ID |
| `buyer_id` | `VARCHAR` | FK → `users.id` | Buyer's user ID |
| `seller_id` | `VARCHAR` | FK → `users.id` | Seller's user ID |
| `listing_id` | `VARCHAR` | FK → `listings.id`, nullable | Associated listing |
| `quantity` | `INT` | default: `1` | Quantity purchased |
| `amount` | `DECIMAL(10,2)` | NOT NULL | Total transaction amount |
| `status` | `VARCHAR` | default: `'pending'` | `'pending'`, `'payment_processing'`, `'paid'`, `'completed'`, `'cancelled'`, `'refunded'` |
| `payment_method` | `VARCHAR` | nullable | `'online'`, `'in-person'` |
| `pickup_address` | `VARCHAR` | nullable | In-person meetup address |
| `pickup_latitude` | `DECIMAL(10,7)` | nullable | Pickup GPS latitude |
| `pickup_longitude` | `DECIMAL(10,7)` | nullable | Pickup GPS longitude |
| `stripe_payment_intent_id` | `VARCHAR` | UNIQUE, nullable | Stripe PaymentIntent ID |
| `stripe_transfer_id` | `VARCHAR` | UNIQUE, nullable | Stripe Transfer ID (seller payout) |
| `platform_fee` | `DECIMAL(10,2)` | nullable | GradSale platform fee amount |
| `seller_earnings` | `DECIMAL(10,2)` | NOT NULL | Amount transferred to seller |
| `payment_status` | `VARCHAR` | default: `'pending'` | `'pending'`, `'succeeded'`, `'failed'`, `'requires_capture'` |
| `buyer_confirmed` | `BOOLEAN` | default: `false` | Buyer confirmed receipt |
| `seller_confirmed` | `BOOLEAN` | default: `false` | Seller confirmed delivery |
| `buyer_confirmed_at` | `TIMESTAMP` | nullable | Buyer confirmation timestamp |
| `seller_confirmed_at` | `TIMESTAMP` | nullable | Seller confirmation timestamp |
| `cancelled_by` | `VARCHAR` | nullable | User ID who cancelled |
| `cancellation_reason` | `VARCHAR` | nullable | Reason for cancellation |
| `cancelled_at` | `TIMESTAMP` | nullable | Cancellation timestamp |
| `hidden_by_buyer` | `BOOLEAN` | default: `false` | Hidden from buyer's history |
| `hidden_by_seller` | `BOOLEAN` | default: `false` | Hidden from seller's history |
| `buyer_rating_notification_sent_at` | `TIMESTAMP` | nullable | Last buyer rating reminder timestamp |
| `seller_rating_notification_sent_at` | `TIMESTAMP` | nullable | Last seller rating reminder timestamp |
| `paid_at` | `TIMESTAMP` | nullable | When payment was authorized |
| `completed_at` | `TIMESTAMP` | nullable | When transaction completed |
| `created_at` | `TIMESTAMP` | default: `now()` | Creation time |
| `updated_at` | `TIMESTAMP` | auto-updated | Last update |

**Indexes:** `buyer_id`, `seller_id`

---

### `ratings`

Buyer and seller ratings after transaction completion.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(UUID)` | PK | Rating ID |
| `transaction_id` | `VARCHAR` | FK → `transactions.id` | Related transaction |
| `reviewer_id` | `VARCHAR` | FK → `users.id` | User giving the rating |
| `reviewee_id` | `VARCHAR` | FK → `users.id` | User receiving the rating |
| `score` | `INT` | NOT NULL | 1–5 star rating |
| `comment` | `TEXT` | nullable | Optional review text |
| `role` | `VARCHAR` | NOT NULL | `'buyer'` or `'seller'` — who is giving the rating |
| `created_at` | `TIMESTAMP` | default: `now()` | Rating submission time |

**Unique Constraint:** `(transaction_id, reviewer_id)` — one rating per user per transaction  
**Indexes:** `reviewee_id`, `transaction_id`

---

### `disputes`

Transaction disputes filed by buyers.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(UUID)` | PK | Dispute ID |
| `transaction_id` | `VARCHAR` | FK → `transactions.id`, UNIQUE | One dispute per transaction |
| `buyer_id` | `VARCHAR` | FK → `users.id` | The disputing buyer |
| `reason` | `VARCHAR` | NOT NULL | Dispute reason category |
| `description` | `TEXT` | nullable | Detailed dispute description |
| `status` | `VARCHAR` | default: `'pending'` | `'pending'`, `'approved'`, `'rejected'` |
| `admin_notes` | `TEXT` | nullable | Admin resolution notes |
| `handled_at` | `TIMESTAMP` | nullable | When admin resolved it |
| `created_at` | `TIMESTAMP` | default: `now()` | Filing time |
| `updated_at` | `TIMESTAMP` | auto-updated | Last update |

**Indexes:** `buyer_id`, `status`

---

### `universities`

Approved university list used for user registration validation and listing association.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(UUID)` | PK | University ID |
| `name` | `VARCHAR` | UNIQUE, NOT NULL | Full university name |
| `domain` | `VARCHAR` | NOT NULL | Primary email domain (e.g., `bu.edu`) |
| `country` | `VARCHAR` | default: `'United States'` | Country |
| `state` | `VARCHAR` | nullable | US state abbreviation |
| `city` | `VARCHAR` | nullable | City |
| `website` | `VARCHAR` | nullable | Official website URL |
| `is_active` | `BOOLEAN` | default: `true` | Whether university is shown in dropdown |
| `created_at` | `TIMESTAMP` | default: `now()` | Record creation |
| `updated_at` | `TIMESTAMP` | auto-updated | Last update |

**Indexes:** `name`, `is_active`

---

### `device_tokens`

FCM push notification tokens for mobile devices.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(UUID)` | PK | Record ID |
| `user_id` | `VARCHAR` | FK → `users.id`, Cascade Delete | Device owner |
| `device_id` | `VARCHAR` | NOT NULL | Unique device identifier |
| `fcm_token` | `VARCHAR` | NOT NULL | Firebase Cloud Messaging token |
| `platform` | `VARCHAR` | NOT NULL | `'ios'` or `'android'` |
| `is_active` | `BOOLEAN` | default: `true` | Whether token is currently valid |
| `last_used_at` | `TIMESTAMP` | default: `now()` | Last successful send |
| `created_at` | `TIMESTAMP` | default: `now()` | Registration time |
| `updated_at` | `TIMESTAMP` | auto-updated | Last update |

**Unique Constraint:** `(user_id, device_id)`  
**Indexes:** `user_id`, `fcm_token`

---

### `notification_preferences`

Per-user notification settings and quiet hours.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `VARCHAR(UUID)` | PK | Record ID |
| `user_id` | `VARCHAR` | FK → `users.id`, UNIQUE, Cascade | One preferences record per user |
| `push_enabled` | `BOOLEAN` | `true` | Master push notification toggle |
| `messages_enabled` | `BOOLEAN` | `true` | Message notifications |
| `message_actions_enabled` | `BOOLEAN` | `true` | Accept/decline decision notifications |
| `transactions_enabled` | `BOOLEAN` | `true` | Transaction update notifications |
| `listings_enabled` | `BOOLEAN` | `true` | Listing activity notifications |
| `cart_enabled` | `BOOLEAN` | `true` | Wishlist/cart notifications |
| `ratings_enabled` | `BOOLEAN` | `true` | Rating reminder notifications |
| `reports_enabled` | `BOOLEAN` | `true` | Report status notifications |
| `system_enabled` | `BOOLEAN` | `true` | System notifications |
| `quiet_hours_enabled` | `BOOLEAN` | `false` | Enable quiet hours |
| `quiet_hours_start` | `VARCHAR` | nullable | Start time (e.g., `"22:00"`) |
| `quiet_hours_end` | `VARCHAR` | nullable | End time (e.g., `"08:00"`) |
| `created_at` | `TIMESTAMP` | `now()` | Creation time |
| `updated_at` | `TIMESTAMP` | auto-updated | Last update |

---

### `notification_logs`

Audit trail of all sent push notifications (for debugging and analytics).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(UUID)` | PK | Log entry ID |
| `user_id` | `VARCHAR` | FK → `users.id`, Cascade | Recipient user |
| `device_token_id` | `VARCHAR` | nullable | Which device token was used |
| `type` | `VARCHAR` | NOT NULL | `'message'`, `'transaction'`, `'listing'`, `'rating'`, `'system'` |
| `title` | `VARCHAR` | NOT NULL | Notification title |
| `body` | `TEXT` | NOT NULL | Notification body text |
| `data` | `JSONB` | nullable | Deep link payload data |
| `sent_at` | `TIMESTAMP` | default: `now()` | Send timestamp |
| `read_at` | `TIMESTAMP` | nullable | When user read the notification |
| `success` | `BOOLEAN` | default: `true` | Whether FCM send succeeded |
| `error_message` | `VARCHAR` | nullable | Error message if failed |

**Indexes:** `user_id`, `type`, `sent_at`

---

### `reports`

User-submitted reports for inappropriate content or behavior.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(UUID)` | PK | Report ID |
| `reporter_id` | `VARCHAR` | NOT NULL (no FK constraint) | User who filed the report |
| `report_type` | `VARCHAR` | NOT NULL | `'listing'`, `'user'`, `'message'` |
| `reason` | `VARCHAR` | NOT NULL | Reason category |
| `description` | `TEXT` | nullable | Additional details |
| `status` | `VARCHAR` | default: `'pending'` | `'pending'`, `'under_review'`, `'resolved'`, `'dismissed'` |
| `listing_id` | `VARCHAR` | nullable | Target listing ID |
| `reported_user_id` | `VARCHAR` | nullable | Target user ID |
| `message_id` | `VARCHAR` | nullable | Target message ID |
| `admin_notes` | `TEXT` | nullable | Admin resolution notes |
| `reviewed_by` | `VARCHAR` | nullable | Admin user ID (no FK) |
| `reviewed_at` | `TIMESTAMP` | nullable | Review timestamp |
| `created_at` | `TIMESTAMP` | default: `now()` | Filing time |
| `updated_at` | `TIMESTAMP` | auto-updated | Last update |

**Indexes:** `reporter_id`, `report_type`, `status`, `listing_id`, `reported_user_id`, `message_id`  
**Note:** Target references (`listing_id`, `reported_user_id`, `message_id`) are stored as plain strings without FK constraints for flexibility.

---

### `blocked_users`

Records of users blocked by other users.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(UUID)` | PK | Block record ID |
| `blocker_id` | `VARCHAR` | NOT NULL | User doing the blocking |
| `blocked_id` | `VARCHAR` | NOT NULL | User being blocked |
| `created_at` | `TIMESTAMP` | default: `now()` | When block was created |

**Unique Constraint:** `(blocker_id, blocked_id)`  
**Indexes:** `blocker_id`, `blocked_id`

---

### `admin_users`

Internal GradSale admin/support staff accounts (separate from regular users).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(UUID)` | PK | Admin user ID |
| `email` | `VARCHAR` | UNIQUE, NOT NULL | Admin email address |
| `password_hash` | `VARCHAR` | NOT NULL | bcrypt hashed password |
| `name` | `VARCHAR` | NOT NULL | Display name |
| `role` | `VARCHAR` | default: `'support'` | `'support'`, `'admin'`, `'super_admin'` |
| `is_active` | `BOOLEAN` | default: `true` | Whether account is active |
| `last_login_at` | `TIMESTAMP` | nullable | Last login time |
| `created_at` | `TIMESTAMP` | default: `now()` | Account creation |
| `updated_at` | `TIMESTAMP` | auto-updated | Last update |

**Indexes:** `email`, `role`

---

### `waitlist_entries`

Pre-launch email waitlist.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(UUID)` | PK | Entry ID |
| `email` | `VARCHAR` | UNIQUE, NOT NULL | Waitlist email |
| `source` | `VARCHAR` | default: `'website'` | Where they signed up: `'website'`, `'home'`, `'about'` |
| `created_at` | `TIMESTAMP` | default: `now()` | Signup time |

**Indexes:** `email`, `created_at`

---

## Relationships Summary

| Relationship | Type | Description |
|---|---|---|
| `User` → `Listing` | 1:N | A user can have many listings |
| `User` → `Message` (sent) | 1:N | A user sends many messages |
| `User` → `ThreadParticipant` | 1:N | A user participates in many threads |
| `MessageThread` → `ThreadParticipant` | 1:N | A thread has many participants |
| `MessageThread` → `Message` | 1:N | A thread has many messages |
| `Message` → `Message` (quoted) | Self-ref 1:N | A message can quote another message |
| `User` → `Transaction` (buyer) | 1:N | A user can buy many items |
| `User` → `Transaction` (seller) | 1:N | A user can sell many items |
| `Transaction` → `Rating` | 1:N | A transaction can have 2 ratings (buyer + seller) |
| `Transaction` → `Dispute` | 1:1 | One dispute per transaction |
| `User` → `Rating` (given) | 1:N | A user gives many ratings |
| `User` → `Rating` (received) | 1:N | A user receives many ratings |
| `Listing` → `CartItem` | 1:N | A listing can be in many carts |
| `User` → `CartItem` | 1:N | A user has many cart items |
| `Listing` → `SavedItem` | 1:N | A listing can be saved by many users |
| `User` → `SavedItem` | 1:N | A user can save many listings |
| `User` → `DeviceToken` | 1:N | A user can have multiple devices |
| `User` → `NotificationPreferences` | 1:1 | One preferences record per user |
| `User` → `NotificationLog` | 1:N | A user has many notification records |
| `User` → `Dispute` (buyer) | 1:N | A user can file multiple disputes |
| `Listing` → `Transaction` | 1:N | A listing can have multiple transactions |
| `User` → `BlockedUser` (blocker) | 1:N | A user can block many users |
| `User` → `BlockedUser` (blocked) | 1:N | A user can be blocked by many users |

---

## Key Business Rules Enforced at DB Level

| Rule | Mechanism |
|---|---|
| One rating per user per transaction | `UNIQUE(transaction_id, reviewer_id)` on `ratings` |
| One dispute per transaction | `UNIQUE(transaction_id)` on `disputes` |
| No duplicate saves | `UNIQUE(user_id, listing_id)` on `saved_items` |
| No duplicate blocks | `UNIQUE(blocker_id, blocked_id)` on `blocked_users` |
| Unique email per user | `UNIQUE(email)` on `users` |
| Unique username | `UNIQUE(username)` on `users` |
| One Stripe customer per user | `UNIQUE(stripe_customer_id)` |
| One Stripe Connect account per user | `UNIQUE(stripe_account_id)` |
| One notification preferences per user | `UNIQUE(user_id)` on `notification_preferences` |
| No duplicate device tokens | `UNIQUE(user_id, device_id)` on `device_tokens` |

---

## Soft Deletes

| Table | Mechanism |
|---|---|
| `listings` | `deleted_at` column; queries filter `WHERE deleted_at IS NULL` |
| `transactions` | `hidden_by_buyer` / `hidden_by_seller` boolean flags |

No hard foreign key cascades on most tables — data is preserved for audit purposes.

---

## JSON / JSONB Columns

| Table | Column | Schema |
|---|---|---|
| `listings` | `location` | `{ latitude: number, longitude: number, address: string, name: string }` |
| `messages` | `attachment_metadata` | Varies by `attachment_type`: listing card, location data, transaction summary, price proposal, reserve request |
| `notification_logs` | `data` | Deep link data: `{ type, threadId?, listingId?, transactionId?, ... }` |

---

## Array Columns

| Table | Column | Description |
|---|---|---|
| `users` | `id_image_urls` | Government ID image GCS URLs (max 2) |
| `users` | `proof_image_urls` | Alumni proof image GCS URLs (max 5) |
| `listings` | `image_urls` | Listing photo GCS URLs |
| `listings` | `original_image_urls` | (deprecated) |

---

## Prisma Schema Location

```
/backend/prisma/schema.prisma
```

## Migration Commands

```bash
# Generate migration from schema changes
npx prisma migrate dev --name <migration-name>

# Apply migrations in production
npx prisma migrate deploy

# Generate Prisma Client after schema changes
npx prisma generate

# Open Prisma Studio (database GUI)
npx prisma studio
```
