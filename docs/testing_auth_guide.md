# Vytrosti Authentication Testing Guide

This guide describes how to run and test the Neon Auth integration in Vytrosti.

## Seeding database and test users

We have integrated 3 test users directly into the `neon_auth` schema within the seeder script.

To reset the database, run the migrations, and seed the initial listings, pool wallets, ledger, and authentication users, run:

```bash
npm run db:setup
```

Or just seed the database:

```bash
npm run db:seed
```

---

## Test Accounts

The following coordinates are registered upstream on the Neon Auth proxy and synced with the local database schema:

### 1. Platform Admin User
- **Email:** `admin.demo@vytrosti.com`
- **Password:** `Vytr0sti#Admin2024!`
- **Role:** `admin`
- **Access Level:** Private backoffice portal (`/admin`) and public Explorer pages.

### 2. Guest User 1
- **Email:** `guest1.demo@vytrosti.com`
- **Password:** `Vytr0sti#Guest1!`
- **Role:** `user`
- **Access Level:** Public Explorer, Booking Form, and Reservation Details. Cannot access the Admin Portal (`/admin`).

### 3. Guest User 2
- **Email:** `guest2.demo@vytrosti.com`
- **Password:** `Vytr0sti#Guest2!`
- **Role:** `user`
- **Access Level:** Public Explorer, Booking Form, and Reservation Details. Cannot access the Admin Portal (`/admin`).

---

## Seeding Implementation Details

Neon Auth operates as a managed upstream proxy. Writing user credentials directly to the local `neon_auth.user` and `neon_auth.account` tables will cause authentication requests to fail with HTTP 500 errors. 

Therefore, the seeder script executes the following steps:
1. Clears all existing local records in the `neon_auth` tables.
2. Registers each test account by executing HTTP `POST` requests to the upstream Neon Auth service endpoint `/sign-up/email` (passing correct `Origin` headers).
3. Directly queries the local database to update the `admin.demo@vytrosti.com` user's `role` to `'admin'`.

---

## Authentication Enforcement Matrix

| Route / Component | Public / Private | Behavior if Unauthenticated | Behavior if Authenticated |
| :--- | :--- | :--- | :--- |
| **Explorer** (`/`) | Public | Allowed | Allowed |
| **Listing details** (`/listings/[id]`) | Public | Allowed | Allowed |
| **Admin Portal** (`/admin`) | Private | Redirected to `/login?callbackUrl=/admin` | Redirected if not `admin` role. Allowed if admin. |
| **Reservations Details** (`/reservations/[id]`) | Private | Redirected to `/login?callbackUrl=/reservations/[id]` | Allowed |
| **Booking Request** (`BookingForm.tsx`) | Restricted | Hides the submit button; displays a **"Sign In to Request Reservation"** button. | Displays the standard **"Request Reservation"** button. |
| **Create Booking** (`createBooking` Action) | Restricted | Server action rejects request and returns an error message. | Allowed |

---

## Testing Scenarios

### Scenario A: Unauthorized Backoffice Redirection
1. Open the application.
2. In the navbar, click on the **Admin Portal** button or go directly to `/admin`.
3. Verify you are redirected to the `/login` page with a `callbackUrl=/admin` parameter in the address bar.

### Scenario B: Guest User Booking Flow
1. Open the application and go to a listing page (e.g. click a card in `/` or go directly to `/listings/<uuid>`).
2. Observe the right-hand **Reserve Property** widget. Instead of a submit button, you will see a dark green button: **"Sign In to Request Reservation"**.
3. Click the button. You will be redirected to the login page.
4. Click **Quick Fill** on either **Guest Tenant 1** or **Guest Tenant 2**, then click **Sign In**.
5. You will be redirected back to the listing detail page.
6. The booking form will now show the standard **"Request Reservation"** submit button.
7. Fill in the check-in/check-out dates and click **Request Reservation**. The reservation will be created successfully and you will be redirected to the `/reservations/[id]` detail page.
8. Look at the navbar: your guest email will be displayed, and a **"Log Out"** button will be available.
9. Try going to `/admin` as a guest; verify you are redirected back to the login page because your role is not `admin`.

### Scenario C: Admin Access to Portal
1. Click **Log Out** in the navbar.
2. Go to the login page (`/login`).
3. Click **Quick Fill** on the **Admin Portal User**, then click **Sign In**.
4. You will be redirected to `/`.
5. Look at the navbar: you will see the **Admin Portal** link in the center and an **"Admin Portal"** button on the right.
6. Click **Admin Portal**. Verify you can view the complete backoffice metrics, ledger logs, and disputes list.

### Scenario D: Manual Payment Status Verification
1. As a logged-in guest user, navigate to an active reservation page (e.g. `/reservations/[id]`).
2. When a Stellar payment has been made but not yet processed automatically, click the **"Verify Payment"** button.
3. This action triggers the backend `verifyPaymentStatus` action, which manually queries/polls the Stellar ledger scanner (`pollPayments`).
4. Once verified, the interface will update the status of the reservation immediately to reflect that the payment has been detected and updated to `paid`.
