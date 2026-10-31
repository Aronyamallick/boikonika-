# Admin guide

Everything is under **Admin** (`/admin`) in the account menu. Each section appears only to staff whose role
has the matching permission (**Admin → Roles & permissions**). Every staff action is recorded in the
**Audit log**.

## Daily routine

**Overview** shows what is waiting — verification requests, reports, held posts, refunds, payouts,
copyright claims, contact messages — plus today's orders and sales. Work the queues from there.

| Section | What you do there |
| --- | --- |
| Verification | Review identity documents for sellers, authors, publishers, teachers and students. Approve, reject with a reason, or ask for a resubmission. Documents open through short-lived links; numbers are masked. Documents are deleted automatically after the retention period (Settings → privacy). |
| Moderation | Reports from readers and posts held for review. Remove, restore, warn, restrict or suspend — each decision is told to the person with the reason, and appears on their **Account standing** page. |
| Copyright | Complaints from rights holders and counter-notices. Taking an e-book down removes downloads for new readers; restoring brings it back. |
| Messages | Messages from the contact form. Replies are emailed to the sender (signed-in people also get them as a notification). |
| Author claims | People asking to manage an author page. Check their verification first. |

## Orders and money

| Section | What you do there |
| --- | --- |
| Orders | Find any order, see each seller's parcel, payment and history. |
| Refunds | Approve or reject refund requests. Approved online payments are refunded through the gateway automatically; cash-on-delivery refunds are paid by staff and marked done here. |
| Payouts | Pay sellers what they earned (sales minus commission and refunds) to their bKash, Nagad, Rocket or bank account, and record the reference. |
| Coupons | Create discount codes: percentage or fixed, limits, dates, minimum order. |
| Listings | Review listings when **Settings → marketplace.requireListingReview** is on; suspend listings that break the rules. |
| E-book files | Every uploaded e-book with its rights declaration; take down or restore. |

## Content

- **Homepage:** choose and order sections (book shelves, categories, clubs, articles, banners,
  testimonials), edit banners (desktop and phone images) and testimonials. Changes appear within a minute.
- **Content:** information pages (terms, privacy, returns, shipping, seller policy, copyright, community
  guidelines, cookies), blog and help articles, and FAQs — always in both Bangla and English. Pages are
  written in Markdown (headings, lists, links, bold, italic).
- **Announcements:** send a notice to everyone or to a group (students, teachers, sellers, authors,
  publishers), written in both languages. It reaches inboxes unless someone turned announcements off; push
  and email only go to people who chose them. There is an hourly limit — use announcements sparingly.
- **Student Zone:** quizzes, events, competitions and scholarships.

## People and settings

- **People:** search accounts, see roles and standing, suspend or reactivate. Suspensions are recorded as
  moderation actions.
- **Roles & permissions:** give staff the least access they need (for example, a support agent gets orders
  and messages, not payouts).
- **Settings:**

  | Setting | Default | Meaning |
  | --- | --- | --- |
  | `commission.defaultPercent` | 10 | Platform commission on seller sales |
  | `orders.paymentWindowMinutes` | 30 | Time to pay online before an order is cancelled |
  | `orders.codMaxAmount` | ৳20,000 | Largest order allowed with cash on delivery |
  | `orders.returnWindowDays` | 7 | Days after delivery that returns are accepted |
  | `marketplace.requireListingReview` | off | New listings wait for staff review |
  | `preview.maxPercent` | 20 | Largest share of an e-book that can be previewed |
  | `digital.downloadsPerDay` | 10 | E-book downloads per reader per day |
  | `recommendations.minSupport` | 2 | Readers needed before "readers also liked" shows a book (privacy) |
  | `kyc.approvedRetentionDays` / `kyc.rejectedRetentionDays` | 1825 / 90 | How long identity documents are kept |
  | `ai.dailyRequests` | 20 | AI assistant requests per reader per day (0 turns it off) |

## Good practice

- Turn on two-step verification for every staff account (**Account → Login & security**).
- Never ask readers for passwords, codes or full ID numbers by message.
- Write moderation reasons people can understand; they see them.
