# Task 08: Terraform — GCP Infrastructure

## Context
All GCP infrastructure must be defined as code in `gcp/server/terraform/` so the environment
is reproducible, versioned, and can be torn down and rebuilt without manual steps.
Manual steps already covered in `gcp/docs/pre-requisites.md` (project creation, APIs, Firebase Auth,
Service Account key download) are excluded — Terraform manages only programmable resources.

## Goal
Write Terraform configuration that provisions all GCP resources needed to run the monitor,
so that `terraform apply` brings up a fully working backend from scratch.

## Acceptance Criteria
- [ ] `terraform init` succeeds
- [ ] `terraform plan` shows no errors against a real GCP project
- [ ] `terraform apply` creates all resources listed below
- [ ] `terraform destroy` removes all managed resources cleanly
- [ ] No secrets or credentials committed to the repo (use variables and Secret Manager data sources)
- [ ] All resources tagged with `project = "speedtest-logger"`
- [ ] All Terraform files have comment blocks explaining each resource

## Resources to provision

### Cloud Function (Gen 2)
- Source: `../function/` (zip uploaded to Cloud Storage bucket)
- Runtime: `python312`
- Trigger: HTTP (unauthenticated — Cloud Scheduler calls it via service account OIDC)
- Memory: 256 MB
- Timeout: 60s
- Environment variables: `GCP_PROJECT_ID`, `ALERT_EMAIL`, `MAX_MINUTES_WITHOUT_DATA`
- Secret env vars (from Secret Manager): `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`

### Cloud Scheduler Job
- Schedule: `*/15 * * * *` (every 15 minutes)
- Target: Cloud Function HTTP URL
- Auth: OIDC token with the Service Account

### Cloud Storage Bucket (function source)
- Single bucket for function source zip
- Not public

### Secret Manager (data sources — secrets created manually per pre-requisites)
- `gmail-client-id`
- `gmail-client-secret`
- `gmail-refresh-token`
- Reference as `data "google_secret_manager_secret_version"` — do not create, only read

### Firebase Hosting
- Managed via `google_firebase_hosting_site` resource
- Deploy of Angular build handled separately by `firebase deploy` (outside Terraform scope)

## Technical Notes

### File structure
```
gcp/server/terraform/
├── main.tf          # provider, project vars, common locals
├── function.tf      # Cloud Function + Storage bucket for source
├── scheduler.tf     # Cloud Scheduler job
├── secrets.tf       # data sources for Secret Manager
├── hosting.tf       # Firebase Hosting site
└── variables.tf     # input variables (project_id, region, alert_email, sa_email)
```

### variables.tf
```hcl
variable "project_id"   { type = string }
variable "region"       { type = string  default = "us-central1" }
variable "alert_email"  { type = string }
variable "sa_email"     { type = string  description = "Service Account email created in pre-requisites" }
```

### Provider block (main.tf)
```hcl
provider "google" {
  project = var.project_id
  region  = var.region
}
provider "google-beta" {
  project = var.project_id
  region  = var.region
}
```

### terraform.tfvars (gitignored — user creates locally)
```hcl
project_id  = "your-project-id"
alert_email = "youremail@gmail.com"
sa_email    = "speedtest-sa@your-project-id.iam.gserviceaccount.com"
```

Add `terraform.tfvars` to `.gitignore`.

## References
- `gcp/architecture.md` — all infrastructure decisions
- `gcp/docs/pre-requisites.md` — what is provisioned manually vs. via Terraform
- `gcp/server/function/` — source for the Cloud Function (task 02)
- `gcp/CLAUDE.md` — comment conventions

## Definition of Done
`terraform apply -var-file=terraform.tfvars` completes with no errors.
Cloud Function is visible in GCP Console and callable via HTTP.
Cloud Scheduler job is visible and triggers the function on schedule.
`terraform destroy` removes all resources.
