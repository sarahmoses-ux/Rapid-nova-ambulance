# REST API

Requests use the `/api` prefix. Successful JSON responses use `{"data": ...}`; errors use `{"error":"message"}`. Validation errors can include a list of field names. Browser mutations must carry the configured public Origin. Staff requests also use the HTTP-only session cookie.

| Method | Endpoint | Input or response |
| --- | --- | --- |
| GET | /services, /service-areas, /careers | Published listing arrays. Append /:slug for detail. |
| GET | /faqs, /testimonials, /settings/public | Published FAQs, published testimonials or public settings. |
| POST | /transport-inquiries | name, email, phone, method, category, area, callback, consent. General values are general and unconfirmed. Callback is YYYY-MM-DD or an empty string. |
| POST | /referral-inquiries | facility, name, email, phone, slot, category, consent. Slot is anytime, morning or afternoon. Category is referral, partnership or coordination. |
| POST | /contact | name, email, phone, category, consent. Category is general, billing, estimate or partnership. |
| POST | /job-applications | Multipart name, email, phone, position (published slug), experience, resume (PDF). |
| POST | /auth/login | email, password and six-digit authenticator code. |
| POST | /auth/logout | Revokes the current cookie session. |
| GET | /auth/me | Current staff role and permissions. |
| POST | /auth/forgot-password | email, returns generic accepted response. |
| POST | /auth/reset-password | token and password. |
| GET | /admin/overview | Counts and recent records scoped to role. |
| GET | /admin/:resource | Paginated records. Query params page, q, status and archived where applicable. |
| POST / PUT | /admin/:resource and /admin/:resource/:id | Create or edit services, areas, careers, FAQs and testimonials. |
| PATCH | /admin/transport/:id | Optional status, assignedTo, note, archive. |
| GET | /admin/dispatch-users | Active dispatch assignees. |
| PATCH | /admin/users/:id | role and active. |
| GET | /admin/applications/:id/resume | Authenticated attachment. |
| GET / PUT | /admin/settings | Public website configuration. |

Inquiry and application creation returns HTTP 201 with `data.reference`. Public payloads are strict and reject fields outside the contract. Role-based access is enforced on every protected resource. Unknown and unpublished public slugs return 404. No public registration is available.

Use `PATCH /admin/referrals/:id`, `PATCH /admin/contacts/:id` or `PATCH /admin/applications/:id` to update a record's status with `{"status":"Contacted"}`.
