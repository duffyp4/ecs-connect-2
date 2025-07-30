# GoCanvas API Guide

This guide summarises the GoCanvas API for version 3 (`/api/v3`).  It is organised by resource and outlines the base URL, authentication methods, common behaviours (pagination, rate‑limits, error codes), and available endpoints with their required and optional parameters.

## 1 Base URL and Authentication

### Base URL

All API endpoints share the base URL:

- `https://api.gocanvas.com/api/v3/` :contentReference[oaicite:0]{index=0}.

### Authentication Methods

GoCanvas supports two authentication methods:

| Method             | Description | How to authenticate |
|--------------------|-------------|---------------------|
| **Basic auth**     | Use your GoCanvas username and password. Suitable for server‑to‑server calls or simple scripts. | Supply credentials in the `Authorization` header as `Basic base64(username:password)` or use `curl -u username:password`:contentReference[oaicite:1]{index=1}. |
| **Bearer token (OAuth 2)** | Recommended for applications. Create an OAuth application to obtain a `client_id` and `client_secret`, then POST to `/oauth/token` with `grant_type=client_credentials` to obtain an `access_token`. | Include the returned token in requests using `Authorization: Bearer <access_token>`:contentReference[oaicite:2]{index=2}. |

### Pagination and Rate‑Limits

- **Pagination** – All list endpoints are paginated. Use the `page` query parameter (default 1) and optionally `page_size` (default 100). Response headers include a `Link` header with `first`, `next`, `last` links and a JSON body with `current_page`, `page_items` and `total_items`:contentReference[oaicite:3]{index=3}.
- **Rate‑limits** – Responses include `RateLimit‑Limit`, `RateLimit‑Remaining` and `RateLimit‑Reset` headers. If you exceed the limit, the API returns `429 Too Many Requests`. To avoid throttling, avoid concurrent calls, respect retry‑after times and inspect the reset header:contentReference[oaicite:4]{index=4}.
- **Error codes** – Standard HTTP codes are used: `400` (Bad request), `401` (Unauthorized), `403` (Forbidden), `404` (Not Found), `422` (Unprocessable entity), `429` (Too many requests), `500` (Internal server error) and `503` (Service unavailable):contentReference[oaicite:5]{index=5}.

## 2 Customer Resource

### Customer Object

A customer represents an individual or business. It contains contact information and may be associated with multiple sites.  The `customer_type` controls required fields:

- **individual** – requires `contact_first_name` and `contact_last_name`.
- **business** – requires `business_name`:contentReference[oaicite:6]{index=6}.

A customer may have multiple sites; the `default_site_id` identifies the primary site and the `site_ids` array attaches additional sites:contentReference[oaicite:7]{index=7}.

### Endpoints

| Endpoint | Purpose | Notes |
|---------|---------|-------|
| `GET /customers` | List all customers. Supports pagination (`page`) and returns an array of customer objects (id, type, customer_type, contact details, code etc.):contentReference[oaicite:8]{index=8}. |
| `GET /customers/{id}` | Retrieve a single customer (not explicitly shown but implied). |
| `POST /customers` | Create a new customer. Required fields depend on `customer_type`:contentReference[oaicite:9]{index=9}. |
| `PATCH /customers/{id}` | Update a customer’s details. Body may include `default_site_id`, `notes`, and `site_ids`. Response returns a success message:contentReference[oaicite:10]{index=10}. |
| `DELETE /customers/{id}` | Delete a customer. Soft‑delete by default; to permanently remove, add `hard_delete=true`:contentReference[oaicite:11]{index=11}. |

## 3 Department Resource

### Department Object

Departments group forms, users and dispatches. The object includes `id`, `name`, `description` and `created_at`:contentReference[oaicite:12]{index=12}.

### Endpoints

| Endpoint | Purpose |
|---------|---------|
| `GET /departments` | List all departments (with `page` and optional `department_id`). Returns an array of departments:contentReference[oaicite:13]{index=13}. |
| `POST /departments` | Create a department. Requires `name` and optionally `description`. Returns the created department:contentReference[oaicite:14]{index=14}. |
| `POST /departments/{id}/users` | Add a user to a department by providing `user_id` and `department_role` (e.g., `department_user`, `department_admin`, etc.):contentReference[oaicite:15]{index=15}. |

## 4 Dispatch Resource

Dispatches are pre‑populated responses to a form that become submissions once completed. They support immediate, scheduled, recurring and looped dispatches and can be associated with customers, projects or sites. A dispatch object includes numerous fields such as `id`, `form_id`, `user_id`, `department_id`, `status`, `scheduled_at`, `reminder_interval`, `send_calendar_invite`, and an array of `responses` where each response references a form entry:contentReference[oaicite:16]{index=16}.

### List and Retrieve Dispatches

- `GET /dispatches` – List dispatches. You must supply at least one filter: `user_id`, `department_id`, or `form_id`. Optional parameters include `page`, `status` (e.g., `assigned`, `unassigned`, `received`), and `start_date`:contentReference[oaicite:17]{index=17}. Returns an array of dispatch objects.
- `GET /dispatches/{id}` – Retrieve a single dispatch and its fields:contentReference[oaicite:18]{index=18}.

### Create an Immediate Dispatch

To send an immediate dispatch to a user (without scheduling), POST to `/dispatches` with `dispatch_type` set to `immediate_dispatch`. Key parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `assignee_id` | integer (optional) | User who will receive the dispatch; if omitted, dispatch remains unassigned:contentReference[oaicite:19]{index=19}. |
| `name` | string (optional) | Short name displayed in the dispatch calendar:contentReference[oaicite:20]{index=20}. |
| `description` | string (optional) | Text shown at the top of the dispatch on the mobile device:contentReference[oaicite:21]{index=21}. |
| `dispatch_type` | enum | Must be `immediate_dispatch`:contentReference[oaicite:22]{index=22}. |
| `department_id` | integer (optional) | Department that the dispatch belongs to. If omitted, the assignee’s default department or the form’s originating department is used:contentReference[oaicite:23]{index=23}. |
| `form_id` | integer | Identifier of the form to dispatch:contentReference[oaicite:24]{index=24}. |
| `responses` | array | Pre‑populated answers; each item includes `entry_id`, `value`, and optional `multi_key` for looped forms:contentReference[oaicite:25]{index=25}. |
| `send_notification` | boolean (optional) | Sends a push notification to the assignee when `true`:contentReference[oaicite:26]{index=26}. |

### Create a Scheduled Dispatch

Scheduled dispatches are like immediate dispatches but include dates and reminders:

| Parameter | Description |
|-----------|-------------|
| `dispatch_type` | Must be `scheduled_dispatch`:contentReference[oaicite:27]{index=27}. |
| `scheduled_at` | Date and time the dispatch begins; format `MM/DD/YYYY HH:mm:ss AM/PM`:contentReference[oaicite:28]{index=28}. |
| `scheduled_end` | Date and time the dispatch ends:contentReference[oaicite:29]{index=29}. |
| `reminder_interval` | Minutes before `scheduled_at` when a reminder notification is sent:contentReference[oaicite:30]{index=30}. |
| All other parameters from immediate dispatch apply. |

### Create a Recurring Dispatch

Recurring dispatches allow the dispatch to repeat on a schedule. Use `dispatch_type=recurring_dispatch` and include recurrence parameters:

| Parameter | Description |
|-----------|-------------|
| `repeat_interval` | Frequency of recurrence: `daily`, `weekly`, `monthly` or `yearly`:contentReference[oaicite:31]{index=31}. |
| `repeat_ends_option` | Determines when recurrence stops; values: `ends_after` (after a set number of occurrences) or `ends_on` (on a specific date):contentReference[oaicite:32]{index=32}. |
| `repeat_occurrences` | Number of times the dispatch repeats; required if `repeat_ends_option` is `ends_after`:contentReference[oaicite:33]{index=33}. |
| `repeat_ends_on` | End date (`MM/DD/YYYY`) when `repeat_ends_option` is `ends_on`:contentReference[oaicite:34]{index=34}. |
| `scheduled_at`, `scheduled_end`, `reminder_interval` | Same as scheduled dispatch but required for recurring dispatches:contentReference[oaicite:35]{index=35}. |
| All other immediate dispatch parameters apply. |

Only the `assignee_id`, `scheduled_at`, `scheduled_end` and recurrence fields are required; the rest are optional.

### Create a Dispatch with Loops

When a form contains loop screens, use the `multi_key` field within `responses` to differentiate values belonging to each loop iteration. Dispatches with loops can be immediate or scheduled. Key parameters:

| Parameter | Description |
|-----------|-------------|
| `dispatch_type` | `immediate_dispatch` or `scheduled_dispatch`:contentReference[oaicite:36]{index=36}. Recurring dispatches with loops are not supported. |
| `responses[].multi_key` | Required for looped forms; identifies the loop iteration for a response:contentReference[oaicite:37]{index=37}. |
| All parameters from immediate or scheduled dispatch apply. |

### Associate Dispatches with Customers, Projects or Sites

Dispatches can be associated with a `customer_id`, `project_id` or `site_id`. These parameters organise dispatches within the Project Management View and are available only for Project Management customers:

| Parameter | Description |
|-----------|-------------|
| `customer_id` | ID of a customer to associate the dispatch with:contentReference[oaicite:38]{index=38}. |
| `project_id` | ID of a project to associate the dispatch with:contentReference[oaicite:39]{index=39}. |
| `site_id` | ID of a site to associate the dispatch with:contentReference[oaicite:40]{index=40}. |
| Other parameters | Same as immediate/scheduled dispatch. |

### Delete a Dispatch

Send `DELETE /dispatches/{id}`. By default this soft‑deletes the dispatch (removes it from task lists but preserves data). To permanently delete, include the query parameter `hard_delete=true`:contentReference[oaicite:41]{index=41}. The response returns a message confirming deletion.

## 5 Form Resource

### Form Object

A form is the digital template that collects data. It is composed of sections and sheets containing entries.  Forms have statuses (`new`, `pending`, `published`, `archived`, `testing`) and versioning. When retrieving a form, you can specify the `format` query parameter:

- `flat` – returns a single JSON object with all fields flattened (recommended for most use cases).
- `nested` – default; returns sections, sheets and entries grouped hierarchically.
- `minimal` – returns only id, name, status, version and root version id.
- `metadata` – returns metadata only:contentReference[oaicite:42]{index=42}.

### Endpoints

| Endpoint | Purpose |
|---------|---------|
| `GET /forms` | List forms with pagination. Returns form objects containing id, type, name, description, status, version and root_version_id:contentReference[oaicite:43]{index=43}. |
| `GET /forms/{id}` | Retrieve a form (with optional `format`). The response contains sections, sheets and entries depending on the format:contentReference[oaicite:44]{index=44}. |
| `POST /forms/{id}/assignments` | Assign/unassign users or departments to a form (not detailed in the docs but available via UI). |

## 6 Group Resource

Groups allow you to organise users and forms within a department.  A group includes `id`, `department_id`, `created_at`, `name`, `description`, a list of `members` (users) and `assigned_forms`:contentReference[oaicite:45]{index=45}.

Endpoints:

| Endpoint | Purpose |
|---------|---------|
| `GET /groups` | List groups with optional `page` and `department_id` parameters:contentReference[oaicite:46]{index=46}. |
| `GET /groups/{id}` | Retrieve a group’s details, including members and assigned forms:contentReference[oaicite:47]{index=47}. |
| `POST /groups` | Create a group (requires `name`, optionally `department_id` and `description`). |
| `PATCH /groups/{id}` | Update a group’s name or description. |
| `DELETE /groups/{id}` | Delete a group. |
| `POST /groups/{id}/forms` | Assign a form to a group. |
| `DELETE /groups/{id}/forms/{form_id}` | Remove a form from a group. |
| `POST /groups/{id}/users` | Add a user to a group. |
| `DELETE /groups/{id}/users/{user_id}` | Remove a user from a group. |

(*Only `GET` endpoints are demonstrated explicitly in the docs; the remaining actions are implied by navigation links and typical CRUD patterns.*)

## 7 Project Resource

Projects are part of the Project Management view and are used to group dispatches, submissions and reference data. A project contains `id`, `name`, `company_id`, `department_id`, `customer_id`, `site_id`, `start_date`, `end_date`, `status`, `notes` and `code`:contentReference[oaicite:48]{index=48}.

Endpoints:

| Endpoint | Purpose |
|---------|---------|
| `GET /projects` | List projects (supports `page`):contentReference[oaicite:49]{index=49}. |
| `GET /projects/{id}` | Retrieve details of a single project:contentReference[oaicite:50]{index=50}. |
| `POST /projects` | Create a project (requires `name`; optional fields include dates, customer_id, site_id, notes, code). |
| `PATCH /projects/{id}` | Update a project. |
| `DELETE /projects/{id}` | Delete a project. |

## 8 Reference Data Resource

Reference data represents spreadsheet‑like data used by forms for lookups (e.g., lists of equipment). A reference data object includes `id`, `type`, `name`, `description`, `use_user_groups` (boolean), `version`, `department_id`, `headers` (array of column names) and `rows` (array of values):contentReference[oaicite:51]{index=51}.

Endpoints:

| Endpoint | Purpose |
|---------|---------|
| `GET /reference_data` | List reference data sets with optional `department_id`:contentReference[oaicite:52]{index=52}. |
| `GET /reference_data/{id}` | Retrieve a reference data set. Optional `format` parameter (`rows_with_index`) returns row numbers alongside data:contentReference[oaicite:53]{index=53}. |
| `POST /reference_data` | Create reference data (provide `name`, `headers` and `rows`). |
| `PATCH /reference_data/{id}` | Update reference data (replace or add rows). |
| `DELETE /reference_data/{id}` | Delete reference data. |

## 9 Report Resource

Reports are PDF outputs generated from submissions. Each form can have multiple report definitions. GoCanvas automatically creates a **Standard Report** for each form. A **Default Report** uses the report marked as default. Some forms also have custom report templates defined in the Report Designer.

Endpoints:

| Endpoint | Purpose |
|---------|---------|
| `GET /submissions/{submission_id}/standard_pdf` | Retrieve the built‑in Standard report for a submission:contentReference[oaicite:54]{index=54}. |
| `GET /submissions/{submission_id}/pdf` | Retrieve the default report for a submission using default PDF options:contentReference[oaicite:55]{index=55}. |
| `GET /forms/{form_id}/reports` | List report definitions for a form. Each definition includes `id`, `name`, `created_at`, `updated_at`, `format` and whether it is default_emailed:contentReference[oaicite:56]{index=56}. |
| `GET /forms/{form_id}/reports/{report_id}` | Retrieve a report definition. The response includes an XML `definition` string used by the report engine:contentReference[oaicite:57]{index=57}. |

## 10 Site Resource

Sites represent physical locations within the Project Management view. A site must have a `name` and may be associated with a customer. Sites have fields `id`, `name`, `address`, `city`, `state`, `zip_code`, `country` (two‑letter code) and `code`:contentReference[oaicite:58]{index=58}. Customers can have multiple sites; the first created becomes the primary site:contentReference[oaicite:59]{index=59}.

Endpoints:

| Endpoint | Purpose |
|---------|---------|
| `GET /sites` | List all sites with optional pagination:contentReference[oaicite:60]{index=60}. |
| `GET /sites/{id}` | Retrieve a site by ID:contentReference[oaicite:61]{index=61}. |
| `POST /sites` | Create a site. Required: `name`; optional: `address`, `city`, `state`, `zip_code`, `country`, `code`, `customer_id`. The `country` field must be a two‑letter code and `customer_id` must reference an existing customer:contentReference[oaicite:62]{index=62}:contentReference[oaicite:63]{index=63}. |
| `PATCH /sites/{id}` | Update a site (same fields as create). Returns `Site updated successfully`:contentReference[oaicite:64]{index=64}. |
| `DELETE /sites/{id}` | Delete a site. Without `hard_delete` it is soft‑deleted; use `?hard_delete=true` to permanently remove:contentReference[oaicite:65]{index=65}. |

## 11 Submission Resource

### Submission Object

A submission represents a completed form. Each submission must reference a form and has a unique `client_guid`. The submission object contains `id`, `form_id`, `client_guid`, `submission_number`, `submission_name`, `created_at`, `status`, and nested `form` and `department` objects:contentReference[oaicite:66]{index=66}. The `responses` array contains answers to each form entry.

### List Submissions

`GET /submissions` lists submissions for a form. Required parameter: `form_id`. Optional parameters include:

- `page` – page number.
- `department_id` – filter by department.
- `user_id` – filter by user.
- `status` – one of `all`, `completed`, `deleted`, `in-progress`, `overdue`, `rejected`, `handed-off`, `assigned`, `unassigned`, `custom`, `saved-to-cloud`, or `unfinished`:contentReference[oaicite:67]{index=67}:contentReference[oaicite:68]{index=68}.
- `custom_status` – filter by a custom status.
- `start_date` / `end_date` – return submissions created in a date range (format `YYYY-MM-DD`).

The response returns an array of submissions with details:contentReference[oaicite:69]{index=69}.

### Create a Submission

#### Basic Submission

Send `POST /submissions` with `Content-Type: application/json`. Required fields:

| Field | Description |
|------|-------------|
| `guid` | Unique ID for your system (string):contentReference[oaicite:70]{index=70}. |
| `form` | Object with `id` or `guid` identifying the form. If using `guid`, include `version` to specify the form version:contentReference[oaicite:71]{index=71}. |
| `responses` | Array of answers; each object must include `entry_id` and `value`. For loop screens, include `multi_key` to identify the loop instance:contentReference[oaicite:72]{index=72}. |
| `department_id` and `user_id` | Optional; assign the submission to a department/user:contentReference[oaicite:73]{index=73}. |

The response returns the created submission object.

#### Submission with Loops

For forms with looped sections, include a `multi_key` string in each response to indicate the loop instance:contentReference[oaicite:74]{index=74}.

#### Submission with Media (photos, videos, attachments)

Use `Content-Type: multipart/form-data`. For each media response, include a `content_guid` in the JSON body and attach the binary file in the same multipart request. Top‑level `content_guid` is required for forms with media fields:contentReference[oaicite:75]{index=75}.

### Retrieve a Submission

- `GET /submissions/{id}` – Returns the submission including `responses`. For media responses, the `value` field shows "Binary data is not displayed"; use the Values API to download the file:contentReference[oaicite:76]{index=76}.
- `GET /submissions/{client_guid}` – Retrieve a submission by its GUID:contentReference[oaicite:77]{index=77}.

### List Revisions

`GET /submissions/{id}/revisions` returns the revision history for a submission. Each revision includes `revision_number`, `user_id`, `entry_id`, `value_id`, previous value and new value:contentReference[oaicite:78]{index=78}.

### Update a Submission

`PATCH /submissions/{id}` updates an existing submission. Send a JSON body or multipart/form-data containing:

| Field | Description |
|------|-------------|
| `value_id` | ID of the response to update:contentReference[oaicite:79]{index=79}. |
| `value` | New value; set to empty string to remove the value:contentReference[oaicite:80]{index=80}. |
| `content_guid` | For media fields, include a content GUID and attach a file. |
| `multi_key` | Required when updating looped responses; must match the parent `multi_key`:contentReference[oaicite:81]{index=81}. |

Updates to GPS coordinates must use `latitude,longitude,accuracy` in `value` with EPSG:3857 projection:contentReference[oaicite:82]{index=82}. The response returns `200 OK` on success.

### Delete a Submission

- `DELETE /submissions/{id}` – Soft‑deletes the submission; use `?hard_delete=true` to permanently delete:contentReference[oaicite:83]{index=83}.
- `DELETE /submissions/{client_guid}` – Delete by GUID:contentReference[oaicite:84]{index=84}.

## 12 User Resource

### User Object

A user includes `id`, `first_name`, `last_name`, `login` (email) and `enabled` (boolean):contentReference[oaicite:85]{index=85}.

### Endpoints

| Endpoint | Purpose |
|---------|---------|
| `GET /users` | List users with optional `page` and `enabled` query parameters:contentReference[oaicite:86]{index=86}. |
| `GET /users/{id}` | Retrieve a user’s details:contentReference[oaicite:87]{index=87}. |
| `POST /users` | Create a user. Required fields: `first_name`, `last_name`, `email`, `password`, `department_role`. Optional: `department_id`, `account_role` (if departments disabled), `phone`, `skip_welcome_email`:contentReference[oaicite:88]{index=88}. |
| `PATCH /users/{id}/change_password` | Change a user’s password; requires admin privileges and new `password`:contentReference[oaicite:89]{index=89}. |
| `PATCH /users/{id}` | Update a user’s name, phone or `enabled` status (can only enable a user if seats are available):contentReference[oaicite:90]{index=90}. |
| `DELETE /users/{id}` | Soft‑delete or hard‑delete a user (using `hard_delete=true`). |

## 13 Values Resource

For media responses within submissions, use `GET /submissions/{submission_id}/values/{value_id}` to download the file. Non‑media values are returned inline with the submission:contentReference[oaicite:91]{index=91}.

## 14 Additional Considerations

- **Loop Screens** – Loops allow repeated sets of form entries. When creating or updating submissions or dispatches, include `multi_key` to identify each loop instance:contentReference[oaicite:92]{index=92}. For nested loops (child loops), the child’s `multi_key` must be prefixed with the parent loop’s `multi_key`:contentReference[oaicite:93]{index=93}.
- **Customers, Projects and Sites** – Are only available on GoCanvas’s Project Management view. When associating dispatches, projects or sites, ensure your account has Project Management enabled:contentReference[oaicite:94]{index=94}. 
- **Soft vs Hard Delete** – Many endpoints allow soft deletion by default. To permanently remove a record (hard delete), pass `hard_delete=true` as a query parameter:contentReference[oaicite:95]{index=95}:contentReference[oaicite:96]{index=96}.  
- **Region and Language** – `country` fields must use two‑letter ISO country codes:contentReference[oaicite:97]{index=97}. Dates and times are typically in `MM/DD/YYYY` and `HH:mm:ss AM/PM` format; for range filters use ISO `YYYY‑MM‑DD`.

---

This guide captures the key structures, parameters and behaviours described in GoCanvas’s API documentation for version 3.  For full examples and additional sample code (cURL, Ruby, JavaScript), refer to the GoCanvas API reference available to logged‑in users.  Always test your API calls in a development environment before deploying to production.
