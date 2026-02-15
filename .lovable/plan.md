

# ComplianceEngine — Indian Statutory Compliance SaaS

## Overview
A full-featured statutory compliance platform for Indian companies, built with React/Vite, Supabase Auth, and Supabase database. Covers EPF, ESIC, Professional Tax, Bonus, Gratuity, TDS, and LWF with working calculation engines.

---

## 1. Design System & Color Scheme
- **Primary:** Blue (#3498db) — main buttons, links, active states
- **Secondary:** Dark Blue (#2c3e50) — headers, navigation
- **Accent/CTA:** Orange (#f39c12) — call-to-action buttons, highlights
- **Success:** Green (#27ae60), **Warning:** Orange, **Danger:** Red (#e74c3c)
- Modern, clean aesthetic with card-based layouts, professional typography

---

## 2. Landing Page (Public — `/`)

### Hero Section
- Bold headline: "Automate Indian Statutory Compliance"
- Subheadline listing EPF, ESIC, PT, Bonus, Gratuity, LWF
- Two CTA buttons: "Start Free Trial" → sign-up, "Watch Demo"
- Illustrated dashboard mockup/graphic

### Features Grid (6 cards)
1. EPF & ESIC Automation
2. Professional Tax
3. Bonus & Gratuity
4. TDS on Salaries (FY 2025-26)
5. Labour Welfare Fund
6. Compliance Calendar

### Pricing Section (3 tiers)
- **Starter** ₹999/mo — 25 employees, basic compliance
- **Professional** ₹2,499/mo (Most Popular) — 100 employees, full suite + form generation
- **Enterprise** ₹4,999/mo — Unlimited, API, dedicated support

### Footer
- Company info, legal links, copyright

---

## 3. Authentication (Supabase Auth)
- **Sign Up** (`/sign-up`) — email/password registration, redirects to `/dashboard`
- **Sign In** (`/sign-in`) — login page
- **Protected routes** — all `/dashboard/*` routes require authentication
- **User menu** — top-right with sign-out option

---

## 4. Supabase Database Schema

### Tables (all with RLS):
- **companies** — company profile with PAN, TAN, EPF/ESIC/PT/LWF registration numbers, linked to `auth.users`
- **employees** — employee master data with salary components, UAN, ESIC number, applicable flags
- **payroll_runs** — monthly payroll processing records
- **epf_contributions** — employee + employer EPF/EPS breakdown per month
- **esic_contributions** — employee + employer ESIC contributions
- **pt_calculations** — Professional Tax per Maharashtra slabs
- **bonus_calculations** — annual bonus per Payment of Bonus Act
- **gratuity_calculations** — gratuity computation per Gratuity Act
- **tds_calculations** — monthly TDS under new regime FY 2025-26
- **lwf_contributions** — half-yearly Labour Welfare Fund records
- **compliance_calendar** — deadline tracking for all filings

### RLS Policy
- All tables restricted so users can only access data belonging to their company

---

## 5. Dashboard (`/dashboard`)

### Company Setup
- Onboarding flow for first-time users to enter company details (PAN, TAN, registration numbers)
- Edit company settings

### Employee Management
- Add/edit/import employees with salary details
- Employee list with search, filter by status
- Toggle EPF/ESIC/PT applicability per employee

### Payroll & Compliance Module

#### EPF Calculator
- Auto-calculate employee share (12% of basic), employer share (3.67% EPF + 8.33% EPS)
- Apply ₹15,000 wage ceiling for EPS
- ECR file generation support

#### ESIC Calculator
- Employee 0.75% + Employer 3.25% of gross
- Apply ₹21,000 wage ceiling
- Monthly contribution tracking

#### Professional Tax (Maharashtra)
- Slab-based: ₹0 up to ₹7,500; ₹175 for ₹7,501–₹10,000; ₹200 for ₹10,001–₹15,000; ₹300 for above (₹312 in Feb)
- Monthly auto-calculation

#### Bonus Calculator
- Minimum 8.33% / Maximum 20% of basic
- Per Payment of Bonus Act, 1965
- Annual calculation

#### Gratuity Calculator
- Formula: (15 × last drawn salary × years of service) / 26
- Eligibility after 5 years
- Per Payment of Gratuity Act, 1972

#### TDS on Salaries
- New tax regime slabs for FY 2025-26
- Standard deduction ₹75,000
- Monthly TDS computation

#### Labour Welfare Fund (Maharashtra)
- Employee ₹25 + Employer ₹75
- Half-yearly (June 30 & December 31)

### Compliance Calendar
- Dashboard view of upcoming deadlines
- EPF (15th), ESIC (21st), PT monthly, LWF half-yearly
- Visual indicators for overdue/upcoming/completed

### Reports & Forms
- Monthly compliance summary
- Employee-wise breakdowns
- Form generation stubs (ECR, Form D, Form 16)

---

## 6. Mobile Responsiveness
- Fully responsive landing page and dashboard
- Collapsible sidebar navigation on mobile
- Touch-friendly tables and forms

