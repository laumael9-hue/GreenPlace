# GreenPlace System Diagrams

Data flow diagrams, network model and network topology for GreenPlace, drawn from the live system (React client and Express API on Vercel, Supabase, PayMongo).

**DFD notation:** rectangles are external entities, rounded boxes are processes, cylinders are data stores, and each arrow is labelled with the data that moves.

## Figure 1: Data Flow Diagram, Level 0 (Context Diagram)

```mermaid
%%{init: {"theme": "neutral", "flowchart": {"curve": "basis"}}}%%
flowchart LR
  G["Guest"]
  R["Resident"]
  B["Business Owner"]
  A["Administrator"]
  P0(["0<br/>GreenPlace<br/>System"])
  PM["PayMongo"]
  EM["Email Service<br/>(Supabase Auth)"]

  G -->|"search filters, sign-up details"| P0
  P0 -->|"listings, establishments, forum posts"| G
  R -->|"login, cart items, orders, drop-off requests,<br/>posts, messages, reviews, refund requests"| P0
  P0 -->|"order status, receipts, notifications,<br/>messages, drop-off records"| R
  B -->|"business application, documents, listings,<br/>order status updates, drop-off logs"| P0
  P0 -->|"incoming orders, sales analytics,<br/>reviews, approval results"| B
  A -->|"approvals, rejections, moderation actions,<br/>account status, settings"| P0
  P0 -->|"pending applications, reports,<br/>listings to review, statistics"| A
  P0 -->|"payment intent, refund request"| PM
  PM -->|"payment page, webhook: payment.paid / payment.failed"| P0
  P0 -->|"password reset request"| EM
  EM -->|"reset link email"| R
```

**Figure 1.** Context diagram. Residents, business owners and administrators are separate entities because each sends and receives different data. A business owner keeps every resident capability (layered roles), so they also use the resident flows. PayMongo is external: GreenPlace never handles card or e-wallet credentials itself.

## Figure 2: Data Flow Diagram, Level 1

```mermaid
%%{init: {"theme": "neutral", "flowchart": {"curve": "basis"}}}%%
flowchart LR
  R["Resident"]
  B["Business Owner"]
  A["Administrator"]
  PM["PayMongo"]

  P1(["1.0 Manage Accounts<br/>and Authentication"])
  P2(["2.0 Register and Verify<br/>Business"])
  P3(["3.0 Manage Listings"])
  P4(["4.0 Process Cart<br/>and Orders"])
  P5(["5.0 Process Payments<br/>and Refunds"])
  P6(["6.0 Manage Drop-offs"])
  P7(["7.0 Run Community Forum"])
  P8(["8.0 Exchange Messages"])
  P9(["9.0 Manage Reviews"])
  P10(["10.0 Administer and<br/>Moderate"])
  P11(["11.0 Send Notifications"])

  D1[("D1 Users")]
  D2[("D2 Businesses")]
  D3[("D3 Listings")]
  D4[("D4 Cart")]
  D5[("D5 Orders")]
  D6[("D6 Payments")]
  D7[("D7 Drop-offs")]
  D8[("D8 Forum")]
  D9[("D9 Messages")]
  D10[("D10 Notifications")]
  D11[("D11 Reviews")]
  D12[("D12 Reports and Audit")]

  R -->|"credentials, profile"| P1
  P1 <-->|"account, role, status"| D1
  B -->|"application, 3 documents"| P2
  P2 -->|"business record"| D2
  A -->|"document and business approval"| P2
  P2 -->|"role change to business"| D1
  B -->|"listing details, photos"| P3
  P3 <-->|"listing, status, stock"| D3
  A -->|"approve / reject listing"| P3
  R -->|"items, quantity, checkout"| P4
  P4 <-->|"cart items"| D4
  P4 -->|"reserve / release stock"| D3
  P4 <-->|"orders, order items"| D5
  B -->|"order status updates"| P4
  P4 -->|"online order to pay"| P5
  P5 -->|"payment intent"| PM
  PM -->|"payment result (webhook)"| P5
  P5 <-->|"payment, refund records"| D6
  P5 -->|"paid / failed status"| D5
  B -->|"drop-off log, completion"| P6
  P6 <-->|"drop-off records"| D7
  R -->|"threads, replies, reactions"| P7
  P7 <-->|"posts, bookmarks"| D8
  R -->|"messages, reports, blocks"| P8
  P8 <-->|"conversations"| D9
  R -->|"ratings, comments"| P9
  P9 <-->|"reviews, replies"| D11
  P9 -->|"verified purchase check"| D5
  A -->|"suspend, moderate, settings"| P10
  P10 <-->|"reports, audit log, settings"| D12
  P10 -->|"account status"| D1
  EV["order, payment, approval,<br/>drop-off and message events<br/>from 2.0 to 9.0"] -.-> P11
  P11 -->|"notification"| D10
  D10 -->|"unread notifications"| R
```

**Figure 2.** Level 1 DFD. Processes 4.0 and 5.0 carry the main business flow and are expanded in Figure 3. Every process writes through the API server, which is the only component allowed to change the data stores (Figure 4). The dotted input to 11.0 stands for the events that processes 2.0 to 9.0 raise (order placed, payment received, listing approved and so on); each becomes a notification in D10.

## Figure 3: Data Flow Diagram, Level 2: Ordering and Payment (Processes 4.0 and 5.0)

```mermaid
%%{init: {"theme": "neutral", "flowchart": {"curve": "basis"}}}%%
flowchart LR
  R["Resident"]
  B["Business Owner"]
  PM["PayMongo"]

  P41(["4.1 Add to Cart<br/>(check stock)"])
  P42(["4.2 Check Out<br/>(one order per shop)"])
  P43(["4.3 Reserve Stock"])
  P44(["4.4 Update Order Status"])
  P51(["5.1 Create Payment"])
  P52(["5.2 Confirm Payment"])
  P53(["5.3 Release Stock<br/>(failed or 30 min unpaid)"])
  P54(["5.4 Process Refund"])

  D3[("D3 Listings")]
  D4[("D4 Cart")]
  D5[("D5 Orders")]
  D6[("D6 Payments")]

  R -->|"listing, quantity"| P41
  D3 -->|"available stock"| P41
  P41 -->|"cart item"| D4
  P41 -->|"error: only N left"| R
  R -->|"selected items, pickup date, method"| P42
  D4 -->|"cart items"| P42
  P42 -->|"order, order items"| D5
  P42 -->|"quantities"| P43
  P43 -->|"stock minus quantity"| D3
  P42 -->|"GCash / Maya order"| P51
  P51 -->|"amount, buyer billing"| PM
  PM -->|"payment page"| R
  PM -->|"webhook: payment.paid"| P52
  P52 -->|"paid, confirmed"| D5
  P52 -->|"payment record"| D6
  PM -->|"webhook: payment.failed"| P53
  P53 -->|"stock plus quantity"| D3
  P53 -->|"failed / cancelled"| D5
  B -->|"confirmed, ready, completed, cancelled"| P44
  P44 <-->|"order status"| D5
  P44 -->|"cancelled: return stock"| P53
  R -->|"refund reason"| P54
  B -->|"approve refund"| P54
  P54 -->|"refund"| PM
  P54 -->|"refunded"| D6
  P54 -->|"return stock"| D3
```

**Figure 3.** Level 2 DFD of ordering and payment. Stock is reserved when the order is placed (4.3), for every payment method, so the last unit cannot be sold twice. It is released when a payment fails, when an online order stays unpaid for 30 minutes, when an order is cancelled, or on refund (5.3, 5.4). If the buyer returns to the site before the webhook arrives, 5.2 also confirms the payment by asking PayMongo directly.

## Table 1: Data Stores and Their Database Tables

| Data store | Tables | Holds |
|---|---|---|
| D1 Users | `profiles` (+ Supabase Auth users) | Name, role (resident, business, admin), active status |
| D2 Businesses | `businesses`, `business_documents`, `business_hours`, `business_materials` | Shop profile, DTI/SEC, permit and BIR documents, hours, accepted materials and prices |
| D3 Listings | `listings`, `listing_images`, `categories` | Products, stock, status (draft, pending, active, rejected), photos |
| D4 Cart | `cart_items` | Items a resident intends to buy |
| D5 Orders | `orders`, `order_items` | Orders per shop, pickup schedule, status, stock-held flag |
| D6 Payments | `payments`, `refunds`, `webhook_events` | PayMongo payment IDs, refund records, processed webhook events |
| D7 Drop-offs | `drop_offs`, `drop_off_items` | Recyclables brought to shops, weights, estimated value |
| D8 Forum | `forum_threads`, `forum_posts`, `forum_reactions`, `forum_thread_reactions`, `forum_bookmarks` | Community posts, replies, reactions, saved posts |
| D9 Messages | `conversations`, `messages`, `conversation_settings` | Direct messages, mute, archive, block |
| D10 Notifications | `notifications` | In-app notifications and read status |
| D11 Reviews | `reviews` | Shop and product ratings, shop replies |
| D12 Reports and Audit | `reports`, `admin_audit_log`, `system_settings` | User and content reports, admin actions, platform settings |

Uploaded files (product photos, business documents, logos, avatars) are kept in Supabase Storage buckets, and their links are saved in the tables above.

## Figure 4: Network Model: Three-Tier Client–Server

```mermaid
%%{init: {"theme": "neutral", "flowchart": {"curve": "basis"}}}%%
flowchart LR
  subgraph T1["Presentation tier (client)"]
    C["React web app<br/>runs in the user's browser<br/>phone, tablet or laptop"]
  end
  subgraph T2["Application tier (server)"]
    S["Express.js REST API<br/>Vercel serverless functions<br/>login checks, roles, business rules"]
  end
  subgraph T3["Data tier"]
    DB[("Supabase PostgreSQL<br/>29 tables")]
    AU["Supabase Auth<br/>accounts, tokens"]
    ST["Supabase Storage<br/>photos, documents"]
  end
  subgraph EXT["External service"]
    PM["PayMongo<br/>GCash, Maya"]
  end

  C -->|"HTTPS requests /api/*<br/>with login token"| S
  S -->|"JSON responses"| C
  S -->|"SQL queries (service role)"| DB
  S -->|"verify token"| AU
  S -->|"upload / read files"| ST
  S -->|"create payment, refund"| PM
  PM -->|"webhook (signed)"| S
  C -->|"redirect to pay"| PM
```

**Figure 4.** GreenPlace follows a three-tier client–server model. The browser never talks to the database directly: every read and write goes through the API, which checks the login token and the user's role (resident, business or admin) first. Payment details stay with PayMongo; the API receives only the result, through a webhook signed with a shared secret.

## Figure 5: Network Topology

```mermaid
%%{init: {"theme": "neutral", "flowchart": {"curve": "basis"}}}%%
flowchart LR
  subgraph USERS["User devices (Metro Cebu)"]
    U1["Smartphone<br/>mobile data / Wi-Fi"]
    U2["Laptop / PC<br/>Wi-Fi / LAN"]
  end
  RT["Home router /<br/>cell tower"]
  ISP["Internet Service<br/>Provider"]
  NET(("Internet"))
  subgraph VERCEL["Vercel cloud: greenplace-three.vercel.app"]
    EDGE["Edge network / CDN<br/>HTTPS (TLS, port 443)<br/>routes /api/* vs pages"]
    WEB["Static web app<br/>(React build)"]
    FN["API functions<br/>(Express, Singapore region)"]
  end
  subgraph SUPA["Supabase cloud, Sydney"]
    PG[("PostgreSQL")]
    AUTH["Auth"]
    STO["Storage"]
  end
  PMG["PayMongo API<br/>(payment gateway)"]

  U1 --> RT
  U2 --> RT
  RT --> ISP --> NET
  NET -->|"HTTPS"| EDGE
  EDGE -->|"/*"| WEB
  EDGE -->|"/api/*"| FN
  FN -->|"HTTPS"| PG
  FN -->|"HTTPS"| AUTH
  FN -->|"HTTPS"| STO
  FN -->|"HTTPS"| PMG
  PMG -->|"webhook HTTPS"| EDGE
```

**Figure 5.** Network topology. User devices connect through their router or cell tower and ISP to the internet. Vercel's edge network receives all traffic over HTTPS and routes it: page requests to the static React app, and `/api/*` requests to the Express functions running in Singapore. Only the functions connect to Supabase in Sydney and to PayMongo, all over encrypted HTTPS. PayMongo calls back into the same edge address with its webhook. Overall this is a hub-and-spoke (star) layout with the API functions as the hub.
