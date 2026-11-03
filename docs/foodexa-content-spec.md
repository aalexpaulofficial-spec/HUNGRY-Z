# HUNGRY — Content & Information Spec (Prompt 1)

Product: **HUNGRY** — Smart Campus Food Ordering.
Scope of this document: content, information architecture, fields and states only.
No redesign of the existing frontend. No backend, database or payment implementation yet.

Machine-readable counterpart: `src/content/foodexa.ts` (single source of truth for copy, field lists and status enums).

---

## 1. Main landing website (existing design preserved)

Sections: Hero → About → How It Works → Students/Faculty/Institutions → Analytics → Zero Platform Fee → Pricing → Download → FAQ → Final CTA → Footer.

### A. Home / Hero
- Brand: HUNGRY
- Tagline: Smart Campus Food Ordering
- Short explanation of the platform
- Primary actions: **User Login**, **Canteen Registration**, **Download App**

### B. About HUNGRY
What is HUNGRY — a campus food-ordering platform where users can:
discover campus food, view live menus, order food, pay securely, track orders,
receive live order updates, and pick up food from the correct counter.
Supporting visuals: mobile app screens and canteen dashboard mockups.

### C. How it works (7 steps, mobile UI visuals)
1. **Login** — user logs into HUNGRY.
2. **Select / access canteen** — user enters an authorized Canteen Code.
3. **Discover food** — available food and categories.
4. **Add to cart** — item, quantity, options.
5. **Pay** — secure payment.
6. **Track** — live order status.
7. **Pick up** — pickup information; collect at the correct counter.

---

## 2. User login

Direct login **without** a Google account. Google sign-in is optional, never mandatory.

Fields:
- Personal: Full Name, Email Address
- Campus/Canteen: Canteen Code
- Role: Student | Faculty | Guest

The valid Canteen Code resolves the user's institution and canteen.

---

## 3. Terms & Service gate

Shown before direct login/registration completes. Topics covered: account usage, campus usage,
food ordering, payments, cancellation, refunds, pickup, user responsibilities, privacy,
data usage, security, prohibited activities, support.

Behaviour: **NEXT** stays disabled until the user scrolls to the bottom of the document.

Also published: Privacy Policy, Refund Policy, Payment Policy.

---

## 4. Canteen registration — "REGISTER YOUR CANTEEN"

Landing copy explains that institutions and canteens can join HUNGRY.

**A. Institution** — Institution Name, Campus Name, Institution Type, Address, City, State, Country, Postal Code, Website.

**B. Canteen** — Canteen Name, Description, Location, Contact Number, Email, Opening Time, Closing Time, Operating Days, Number of Counters.

**C. Administrator** — Full Name, Designation, Official Email, Phone Number.

**D. Operations** — Number of Counters, Counter Names, Food Categories, Veg Available, Non-Veg Available, Average Preparation Time, Pickup Method.
Counters are canteen-defined: Counter 1–4 plus Other / Custom Counter.

**E. Business (only where genuinely required)** — Business/Registration Name, GST Number, Business Registration Information, required tax information.

**F. Bank / payout (future settlements)** — Account Holder Name, Bank Name, Account Number, IFSC, Bank Branch. Sensitive financial data must be handled securely (never exposed client-side, never logged).

**G. Documents (secure upload, minimum mandatory)** — Institution authorization, Business registration, GST documents, Other verification documents.

### Registration success — "SUCCESSFULLY REGISTERED"
Shows Registration ID, Canteen Name, Registered Email, Submission Date, Current Status = **UNDER REVIEW**.
Message: "Your registration has been submitted successfully. Our team will verify your details and notify you by email."
Also offers **Canteen Login**, with a note that access unlocks after approval.

---

## 5. Super Admin

**Login:** Email + Password. Credentials are never exposed publicly on the website.

**Overview metrics:** Total Institutions, Total Canteens, Pending Registrations, Approved Canteens,
Active Canteens, Total Users, Total Orders, Today's Orders, Today's Revenue, Pending Redemptions.

**Canteen approval record:** Registration ID, Institution Name, Campus Name, Canteen Name,
Administrator Name, Email, Phone, Address, Operating Hours, Number of Counters, Business Information,
Submitted Documents, Bank/Payout Information status, Registration Date, Current Status.
Actions: View, Verify, Approve, Reject, Request Changes.

**Credentials on approval:** unique Canteen ID, unique Canteen Code, secure account setup/login credentials, delivered to the canteen by email.

**Email Center:** Recipient Name, Canteen Name, Recipient Email, Subject, Message, registration/approval
information, Canteen Code, secure account setup information. Buttons: Preview, Edit, Send.
Email status: Draft | Sent | Failed.

---

## 6. Canteen dashboard

**Overview:** Today's Orders, Today's Revenue, Pending, Confirmed, Preparing, Ready, Completed,
Cancelled Orders, Active Counters, Estimated Preparation Time.

**Profile:** Canteen Name, Description, Logo, Cover/Banner Image, Location, Contact Information,
Opening Hours, Closing Hours, Operating Days, Counters.

**Menu management:** add / edit / delete / enable / disable food, upload food image, add / edit / delete banner.

**Food item fields:** Food Name, Description, Food Image, Price, Discount, Final Price, Category,
Veg/Non-Veg, Estimated Preparation Time, Counter, Availability, Today's Special, Bestseller.

**Default categories:** Breakfast, South Indian, North Indian, Meals, Rice, Snacks, Fast Food, Pizza,
Burgers, Beverages, Desserts, Healthy Food, Today's Special. Custom categories allowed.

**Add menu — two options**
- Option 1 — Manual: Food Name, Description, Price, Discount, Category, Veg/Non-Veg, Estimated Time, Food Image, Counter, Availability.
- Option 2 — Image-assisted: canteen uploads a food/menu image; AI may later suggest Food Name, Description,
  Category, Veg/Non-Veg, Estimated Time. The canteen must review and confirm before publishing.

**Counters:** Counter 1–4 plus Custom Counter; each order and menu item can be associated with a counter.

---

## 7. Orders

**Order fields:** Order ID, User, User Role, Canteen, Food Items, Quantity, Price, Discount, Total Amount,
Payment Status, Order Status, Counter, Estimated Preparation Time, Order Date, Order Time, Pickup Code,
QR/pickup information where applicable.

**Order status:** Order Received → Confirmed → Preparing → Ready for Pickup → Collected; Cancelled.

---

## 8. Student / user dashboard (existing dashboard preserved)

Home, Canteen, Menu, Categories, Search, Food Details, Cart, Checkout, Payment, Orders, Live Tracking,
Pickup Code, Notifications, Profile, Order History.

**Food info shown to users:** Food Image, Food Name, Description, Price, Discount, Final Price,
Veg/Non-Veg, Category, Estimated Preparation Time, Counter, Availability.

**Live tracking view:** current stage in the status flow plus Order ID, Counter, Estimated Time,
Pickup Code, Order Items, Total Amount.

---

## 9. Payments, revenue and redemption

**Payment record:** Order ID, Payment ID, Amount, Currency, Payment Status, Payment Date,
Payment Method, Refund Status where applicable. Currency INR ₹. Provider: Razorpay.

**Canteen revenue:** Today's Revenue, Total Sales, Completed Orders, Cancelled Orders, Refunds,
Platform Fees, Net Revenue, Available Balance, Redeemed Amount, Pending Redemption.

**Redeem money:** Available Balance, Redemption Amount, Bank Account, Redemption Status,
Request Date, Transaction ID. Statuses: Requested | Processing | Paid | Failed | Reversed.

---

## 10. Analytics & reports

**Analytics** — Orders (today, weekly, monthly), Revenue (today, weekly, monthly),
Food (most ordered, least ordered, bestselling, food sales),
Operations (peak ordering time, average order value, average preparation time).

**Report downloads** — Today's Orders, Order History, Revenue Report, Menu Sales, Analytics.
Formats: PDF, Excel, CSV.

---

## 11. Notifications

- **User:** Order Confirmation, Payment Confirmation, Preparing, Ready for Pickup, Order Collected, Refund.
- **Canteen:** New Order, Payment Received, Redemption Update, Super Admin Message.
- **Super Admin:** New Canteen Registration, Redemption Request, Important System Events.

---

## 12. Download HUNGRY

Platforms: Android, iOS. Until published, show **COMING SOON** — no fake store links.

---

## 13. FAQ

What is HUNGRY? · Who can use HUNGRY? · How do I log in? · Do I need Google? · What is a Canteen Code? ·
How do I order food? · How do I pay? · How do I track my order? · How do I pick up my food? ·
How can a canteen register? · How does approval work? · How does a canteen receive payments? ·
How does redemption work? · How are refunds handled? · Is my information secure?
