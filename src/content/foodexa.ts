/**
 * HUNGRY Z — content & information source of truth (Prompt 1).
 * Copy, field definitions and status enums only. No UI, no backend.
 * Narrative doc: docs/foodexa-content-spec.md
 */

export const brand = {
  name: "HUNGRY Z",
  tagline: "Smart Campus Food Ordering",
  currency: "INR",
  currencySymbol: "₹",
  paymentProvider: "Razorpay",
  platformFee: "₹0",
} as const;

export const hero = {
  title: "HUNGRY Z",
  tagline: brand.tagline,
  description:
    "HUNGRY Z is a smart campus food ordering platform. Discover campus food, order from your canteen, pay securely, track preparation live and collect from the correct counter — with ₹0 platform fee.",
  actions: [
    { label: "User Login", href: "#login" },
    { label: "Canteen Registration", href: "#canteen-registration" },
    { label: "Download App", href: "#download" },
  ],
} as const;

export const about = {
  heading: "What is HUNGRY Z?",
  body: "HUNGRY Z is a campus food-ordering platform built for institutions, canteens, students, faculty and guests.",
  capabilities: [
    "Discover campus food",
    "View live menus",
    "Order food",
    "Pay securely",
    "Track orders",
    "Receive live order updates",
    "Pick up food from the correct counter",
  ],
} as const;

export const howItWorks = [
  { step: 1, title: "LOGIN", description: "User logs into HUNGRY Z." },
  { step: 2, title: "SELECT / ACCESS CANTEEN", description: "User enters their authorized Canteen Code." },
  { step: 3, title: "DISCOVER FOOD", description: "User views available food and categories." },
  { step: 4, title: "ADD TO CART", description: "User selects food, quantity and options." },
  { step: 5, title: "PAY", description: "User pays securely." },
  { step: 6, title: "TRACK", description: "User sees live order status." },
  { step: 7, title: "PICK UP", description: "User receives pickup information and collects from the correct counter." },
] as const;

/* ---------------------------------- users --------------------------------- */

export const userRoles = ["Student", "Faculty", "Guest"] as const;
export type UserRole = (typeof userRoles)[number];

export const userLogin = {
  heading: "USER LOGIN",
  note: "Direct login without a Google account. Google sign-in is optional, never mandatory.",
  groups: [
    { group: "Personal Information", fields: ["Full Name", "Email Address"] },
    { group: "Campus/Canteen Information", fields: ["Canteen Code"] },
    { group: "Role", fields: ["Student", "Faculty", "Guest"] },
  ],
  canteenCodeNote: "The valid Canteen Code identifies the institution and canteen the user belongs to.",
} as const;

/* ------------------------------ legal content ----------------------------- */

export const termsTopics = [
  "Account usage",
  "Campus usage",
  "Food ordering",
  "Payments",
  "Cancellation",
  "Refunds",
  "Pickup",
  "User responsibilities",
  "Privacy",
  "Data usage",
  "Security",
  "Prohibited activities",
  "Support",
] as const;

export const legal = {
  heading: "HUNGRY Z TERMS & SERVICE",
  gate: "The NEXT action stays disabled until the user scrolls to the bottom.",
  policies: ["Privacy Policy", "Refund Policy", "Payment Policy"],
} as const;

/* -------------------------- canteen registration -------------------------- */

export const canteenRegistration = {
  heading: "REGISTER YOUR CANTEEN",
  intro: "Institutions and canteens can join HUNGRY Z and run ordering, counters and payouts in one place.",
  sections: [
    {
      key: "institution",
      title: "Institution Information",
      fields: [
        "Institution Name",
        "Campus Name",
        "Institution Type",
        "Institution Address",
        "City",
        "State",
        "Country",
        "Postal Code",
        "Institution Website",
      ],
    },
    {
      key: "canteen",
      title: "Canteen Information",
      fields: [
        "Canteen Name",
        "Canteen Description",
        "Canteen Location",
        "Canteen Contact Number",
        "Canteen Email",
        "Opening Time",
        "Closing Time",
        "Operating Days",
        "Number of Counters",
      ],
    },
    {
      key: "administrator",
      title: "Canteen Administrator Information",
      fields: ["Administrator Full Name", "Designation", "Official Email", "Phone Number"],
    },
    {
      key: "operations",
      title: "Canteen Operations",
      fields: [
        "Number of Counters",
        "Counter Names",
        "Food Categories",
        "Veg Food Available",
        "Non-Veg Food Available",
        "Average Preparation Time",
        "Pickup Method",
      ],
    },
    {
      key: "business",
      title: "Business Information",
      note: "Collect only what is genuinely required.",
      fields: [
        "Business/Registration Name",
        "GST Number",
        "Business Registration Information",
        "Tax-related information required for the service",
      ],
    },
    {
      key: "payout",
      title: "Bank / Payout Information",
      note: "Sensitive financial information must be securely handled.",
      fields: ["Account Holder Name", "Bank Name", "Account Number", "IFSC", "Bank Branch"],
    },
    {
      key: "documents",
      title: "Documents",
      note: "Secure upload. Do not make unnecessary documents mandatory.",
      fields: [
        "Institution authorization",
        "Business registration documents",
        "GST documents",
        "Other verification documents",
      ],
    },
  ],
} as const;

export const registrationSuccess = {
  heading: "SUCCESSFULLY REGISTERED",
  fields: ["Registration ID", "Canteen Name", "Registered Email", "Submission Date", "Current Status"],
  status: "UNDER REVIEW",
  message:
    "Your registration has been submitted successfully. Our team will verify your details and notify you by email.",
  canteenLoginNote: "Canteen login access becomes available after approval.",
} as const;

/* ------------------------------ super admin ------------------------------- */

export const superAdmin = {
  login: { heading: "SUPER ADMIN LOGIN", fields: ["Email", "Password"], note: "Credentials are never exposed publicly." },
  overview: [
    "Total Institutions",
    "Total Canteens",
    "Pending Registrations",
    "Approved Canteens",
    "Active Canteens",
    "Total Users",
    "Total Orders",
    "Today's Orders",
    "Today's Revenue",
    "Pending Redemptions",
  ],
  approvalRecord: [
    "Registration ID",
    "Institution Name",
    "Campus Name",
    "Canteen Name",
    "Administrator Name",
    "Email",
    "Phone",
    "Address",
    "Operating Hours",
    "Number of Counters",
    "Business Information",
    "Submitted Documents",
    "Bank/Payout Information status",
    "Registration Date",
    "Current Status",
  ],
  approvalActions: ["View", "Verify", "Approve", "Reject", "Request Changes"],
  generatedCredentials: ["Unique Canteen ID", "Unique Canteen Code", "Secure account setup/login credentials"],
  emailCenter: {
    heading: "EMAIL CENTER",
    fields: [
      "Recipient Name",
      "Canteen Name",
      "Recipient Email",
      "Email Subject",
      "Email Message",
      "Registration/Approval information",
      "Canteen Code",
      "Secure account setup/login information",
    ],
    actions: ["Preview", "Edit", "Send"],
    statuses: ["Draft", "Sent", "Failed"],
  },
} as const;

/* --------------------------- canteen dashboard ---------------------------- */

export const canteenDashboard = {
  overview: [
    "Today's Orders",
    "Today's Revenue",
    "Pending Orders",
    "Confirmed Orders",
    "Preparing Orders",
    "Ready Orders",
    "Completed Orders",
    "Cancelled Orders",
    "Active Counters",
    "Estimated Preparation Time",
  ],
  profile: [
    "Canteen Name",
    "Description",
    "Logo",
    "Cover/Banner Image",
    "Location",
    "Contact Information",
    "Opening Hours",
    "Closing Hours",
    "Operating Days",
    "Counters",
  ],
  menuManagement: [
    "Add Food",
    "Edit Food",
    "Delete Food",
    "Enable Food",
    "Disable Food",
    "Upload Food Image",
    "Add Banner",
    "Edit Banner",
    "Delete Banner",
  ],
} as const;

export const foodItemFields = [
  "Food Name",
  "Description",
  "Food Image",
  "Price",
  "Discount",
  "Final Price",
  "Category",
  "Veg / Non-Veg",
  "Estimated Preparation Time",
  "Counter",
  "Availability",
  "Today's Special",
  "Bestseller status",
] as const;

export const menuCategories = [
  "Breakfast",
  "South Indian",
  "North Indian",
  "Meals",
  "Rice",
  "Snacks",
  "Fast Food",
  "Pizza",
  "Burgers",
  "Beverages",
  "Desserts",
  "Healthy Food",
  "Today's Special",
] as const;

export const addMenuOptions = [
  {
    key: "manual",
    title: "OPTION 1 — MANUAL MENU",
    fields: [
      "Food Name",
      "Description",
      "Price",
      "Discount",
      "Category",
      "Veg / Non-Veg",
      "Estimated Time",
      "Food Image",
      "Counter",
      "Availability",
    ],
  },
  {
    key: "image-assisted",
    title: "OPTION 2 — IMAGE-ASSISTED MENU",
    description:
      "Canteen uploads a food/menu image. HUNGRY Z may later use AI to suggest details, which the canteen must review before publishing.",
    suggested: ["Food Name", "Description", "Category", "Veg/Non-Veg", "Estimated Time"],
  },
] as const;

export const counters = ["Counter 1", "Counter 2", "Counter 3", "Counter 4", "Custom Counter"] as const;

/* --------------------------------- orders --------------------------------- */

export const orderFields = [
  "Order ID",
  "User",
  "User Role",
  "Canteen",
  "Food Items",
  "Quantity",
  "Price",
  "Discount",
  "Total Amount",
  "Payment Status",
  "Order Status",
  "Counter",
  "Estimated Preparation Time",
  "Order Date",
  "Order Time",
  "Pickup Code",
  "QR/Pickup information",
] as const;

export const orderStatuses = [
  "Order Received",
  "Confirmed",
  "Preparing",
  "Ready for Pickup",
  "Collected",
  "Cancelled",
] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const liveTracking = {
  flow: ["ORDER RECEIVED", "CONFIRMED", "PREPARING", "READY FOR PICKUP", "COLLECTED"],
  details: ["Order ID", "Counter", "Estimated Time", "Pickup Code", "Order Items", "Total Amount"],
} as const;

/* ----------------------------- user dashboard ----------------------------- */

export const userDashboardSections = [
  "Home",
  "Canteen",
  "Menu",
  "Categories",
  "Search",
  "Food Details",
  "Cart",
  "Checkout",
  "Payment",
  "Orders",
  "Live Tracking",
  "Pickup Code",
  "Notifications",
  "Profile",
  "Order History",
] as const;

export const userFoodInfo = [
  "Food Image",
  "Food Name",
  "Description",
  "Price",
  "Discount",
  "Final Price",
  "Veg/Non-Veg",
  "Category",
  "Estimated Preparation Time",
  "Counter",
  "Availability",
] as const;

/* --------------------------- payments & revenue --------------------------- */

export const paymentFields = [
  "Order ID",
  "Payment ID",
  "Amount",
  "Currency",
  "Payment Status",
  "Payment Date",
  "Payment Method",
  "Refund Status",
] as const;

export const canteenRevenueFields = [
  "Today's Revenue",
  "Total Sales",
  "Completed Orders",
  "Cancelled Orders",
  "Refunds",
  "Platform Fees",
  "Net Revenue",
  "Available Balance",
  "Redeemed Amount",
  "Pending Redemption",
] as const;

export const redeemMoney = {
  heading: "REDEEM MONEY",
  fields: [
    "Available Balance",
    "Redemption Amount",
    "Bank Account",
    "Redemption Status",
    "Request Date",
    "Transaction ID",
  ],
  statuses: ["Requested", "Processing", "Paid", "Failed", "Reversed"],
} as const;

/* --------------------------- analytics & reports -------------------------- */

export const analytics = {
  orders: ["Today's Orders", "Weekly Orders", "Monthly Orders"],
  revenue: ["Today's Revenue", "Weekly Revenue", "Monthly Revenue"],
  food: ["Most Ordered Food", "Least Ordered Food", "Bestselling Food", "Food Sales"],
  operations: ["Peak Ordering Time", "Average Order Value", "Average Preparation Time"],
} as const;

export const reports = {
  items: ["Today's Orders", "Order History", "Revenue Report", "Menu Sales", "Analytics"],
  formats: ["PDF", "Excel", "CSV"],
} as const;

/* ------------------------------ notifications ----------------------------- */

export const notifications = {
  user: [
    "Order Confirmation",
    "Payment Confirmation",
    "Preparing",
    "Ready for Pickup",
    "Order Collected",
    "Refund",
  ],
  canteen: ["New Order", "Payment Received", "Redemption Update", "Super Admin Message"],
  superAdmin: ["New Canteen Registration", "Redemption Request", "Important System Events"],
} as const;

/* -------------------------------- download -------------------------------- */

export const download = {
  heading: "DOWNLOAD HUNGRY Z",
  platforms: [
    { platform: "Android", status: "COMING SOON", href: null },
    { platform: "iOS", status: "COMING SOON", href: null },
  ],
  note: "No store links until the apps are published.",
} as const;

/* ----------------------------------- faq ---------------------------------- */

export const faqs = [
  ["What is HUNGRY Z?", "HUNGRY Z is a smart campus food ordering platform for institutions, canteens, students, faculty and guests."],
  ["Who can use HUNGRY Z?", "Students, faculty and approved guests of an institution running HUNGRY Z, plus the canteen teams themselves."],
  ["How do I create an account or log in?", "Choose Create Account / Login and follow the account form. Use your own email and accurate account details. Google sign-in is optional when offered."],
  ["What is a Canteen Code?", "A code issued to an approved canteen. It links you to the right institution, campus and menu."],
  ["How do I place an order?", "Choose food and quantities, then select Dine In or Parcel. Review your canteen, items, counter, total and payment option before placing the order."],
  ["What is the difference between Dine In and Parcel?", "Dine In is for eating at the canteen. Parcel is packed to take away. Parcel orders currently require Pay at Counter; available payment options are shown during checkout."],
  ["How do faculty event requests work?", "Faculty submit event details, expected participants, a seven-digit code, requested menu quantities and optional canteen instructions. The canteen reviews the request and sends an itemized quotation. Faculty can request changes or approve it; the canteen confirms and publishes the event after approval."],
  ["How do event tokens work?", "For a published event, an eligible signed-in user at the participating canteen enters the seven-digit code to request a unique four-digit token and QR code, while approved capacity remains. Event tokens are for participation and do not use the food menu, cart or regular checkout."],
  ["How can I pay?", "Choose Pay at Counter or an available online checkout option. Online checkout is provided through Razorpay and may show UPI, card or other methods. Payment options can depend on the order type and current payment availability."],
  ["When is an order marked Paid?", "Online payments are marked Paid after HUNGRY Z verifies confirmation from the payment provider. Pay at Counter orders remain Pending until canteen staff confirm payment. Printing a bill does not confirm payment."],
  ["Money was deducted, but my order or payment is not confirmed. What should I do?", "First check the order's latest status and avoid paying again until it is resolved. Email hungryofficialx@gmail.com with your Order ID and payment reference or UPI transaction ID. Never send an OTP, password or full card number."],
  ["How do I cancel an order?", "An online order awaiting payment can be cancelled from its order details when the Cancel option is available. For an accepted order, contact the canteen or HUNGRY Z support; cancellation depends on the order status and payment method."],
  ["How do refunds work?", "Eligible online-paid orders may show Request a refund in order details. Cancellation does not automatically qualify for a refund; requests are reviewed under the existing eligibility rules. If approved, the refund is initiated through Razorpay to the original payment method. After approval and successful initiation, eligible refunds generally take 5–7 business working days to appear; timing can vary by Razorpay, your bank and payment method. Order details show the refund amount and current status. We email you when a refund is initiated and when its status changes, and mark it refunded only after gateway confirmation. For help, email hungryofficialx@gmail.com with your Order ID."],
  ["How do I track and collect an order?", "The order page updates as the canteen moves it through preparation and ready status. When collecting, show the 4-digit code at the counter listed on your order. The order becomes Collected when canteen staff update it."],
  ["Can I dine in with an online payment or pay at the counter?", "For Dine In, checkout displays the currently available payment choices, which can include Pay at Counter and online payment. Parcel orders are currently paid at the counter."],
  ["How can a canteen register?", "Use Register Your Canteen and submit institution, canteen, administrator, operations, business, payout and document details."],
  ["How does approval work?", "The submission goes UNDER REVIEW. Our team verifies it and emails the outcome; approved canteens receive a Canteen ID, Canteen Code and login details."],
  ["How does a canteen receive payments?", "Order payments are collected through Razorpay and settled to the canteen's verified bank account."],
  ["How do I contact HUNGRY Z?", "For account, order, payment, refund, privacy or operational support, email hungryofficialx@gmail.com. For payment issues, include your Order ID and payment reference."],
  ["Where can I read the Privacy Policy and Terms?", "Open the separate Privacy Policy and Terms & Conditions pages from the website footer or your dashboard profile."],
] as const;
