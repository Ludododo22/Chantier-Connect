export type Capability = "manage_platform" | "manage_company" | "manage_team" | "manage_sites" | "manage_tasks" | "capture_photos" | "create_reports" | "validate_reports" | "clock_in" | "update_assigned_tasks" | "manage_finance" | "read_company" | "read_assigned" | "read_team" | "read_validated_reports"

export type UserRole = "EDITOR" | "ADMIN_ENTERPRISE" | "CONDUCTEUR" | "CHEF_CHANTIER" | "COMPAGNON" | "SOUS_TRAITANT" | "COMPTABLE" | "MAITRE_OUVRAGE"

export interface AuthUser {
  id: string

  email: string

  phone: string | null

  fullName: string

  initials: string

  role: UserRole

  roleLabel: string

  tenantId: string | null

  tenantName: string

  tenantPlan: string

  assignedSite: string | null

  sections: string[]

  capabilities: Capability[]

  profilePhotoUrl: string | null
}

export interface RecentActivity {
  kind: string

  title: string

  detail: string

  siteName: string

  occurredAt: string
}

export interface Site {
  id: string

  name: string

  location: string | null

  status: "En cours" | "En pause" | "Terminé" | null

  progress: number | null

  budgetFcfa: string | null

  startDate: string | null

  endDate: string | null

  teamCount: number | null

  createdAt: string
}

export interface Task {
  id: string

  siteId: string

  siteName: string

  title: string

  description: string

  category: string

  priority: "Basse" | "Normale" | "Haute" | "Urgente"

  status: "À faire" | "En cours" | "Terminée" | "Bloquée"

  dueDate: string | null

  assignedTo: string | null

  assigneeInitials: string | null

  assigneeName: string | null

  createdAt: string

  updatedAt: string
}

export interface Report {
  id: string

  siteId: string

  siteName: string

  authorId: string

  authorName: string

  workDone: string

  crewCount: number

  status: "À valider" | "Validé" | "Rejeté"

  reportDate: string

  createdAt: string

  validatedAt: string | null
}

export type ManagedRole = "CONDUCTEUR" | "CHEF_CHANTIER" | "COMPAGNON" | "SOUS_TRAITANT" | "COMPTABLE" | "MAITRE_OUVRAGE"

export interface TeamMember {
  id: string

  email: string

  phone: string | null

  fullName: string

  initials: string

  role: ManagedRole | "ADMIN_ENTERPRISE"

  roleLabel: string

  assignedSite: string | null

  active: boolean

  createdAt: string
}

export interface SitePhoto {
  id: string

  siteId: string

  siteName: string

  authorId: string

  authorName: string

  caption: string

  contentType: string

  sha256: string

  latitude: number | null

  longitude: number | null

  capturedAt: string

  createdAt: string
}

export interface AttendanceRecord {
  id: string

  siteId: string

  siteName: string

  clockInAt: string

  clockOutAt: string | null

  clockInLatitude: number | null

  clockInLongitude: number | null

  clockOutLatitude: number | null

  clockOutLongitude: number | null
}

export interface FinanceEntry {
  id: string

  siteId: string

  siteName: string

  entryType: "engagement" | "encaissement" | "depense"

  category: string

  description: string

  amountFcfa: string

  status: "prévu" | "réalisé"

  dueDate: string | null

  occurredAt: string | null

  createdAt: string
}

export interface FinanceSummary {
  budgetFcfa: string

  engagedFcfa: string

  expensesFcfa: string

  plannedReceiptsFcfa: string

  receivedFcfa: string

  cashBalanceFcfa: string
}

export interface PlatformOverview {
  tenantCount: number

  activeTenantCount: number

  trialTenantCount: number

  pastDueTenantCount: number

  activeUserCount: number

  monthlyRevenueFcfa: string

  openTicketCount: number
}

export interface PlatformTenant {
  id: string

  name: string

  status: "Actif" | "Essai" | "Impayé" | "Suspendu"

  createdAt: string

  planId: string | null

  planName: string | null

  subscriptionStatus: "Essai" | "Actif" | "Impayé" | "Suspendu" | "Résilié" | null

  renewsAt: string | null

  userCount: number

  siteCount: number
}

export type RegistrationRequestStatus =
  | "Nouvelle"
  | "En cours"
  | "Entreprise créée"
  | "Refusée"

export interface RegistrationRequest {
  id: string
  companyName: string
  adminFullName: string
  adminEmail: string
  phone: string | null
  message: string
  status: RegistrationRequestStatus
  createdAt: string
  updatedAt: string
}

export interface SubscriptionPlan {
  id: string

  name: string

  monthlyPriceFcfa: string

  maxUsers: number | null

  maxSites: number | null

  active: boolean

  subscriberCount?: number
}

export type InvoicePaymentMethod =
  | "Espèces"
  | "Virement bancaire"
  | "Mobile Money"
  | "Autre"

export interface PlatformInvoice {
  id: string

  invoiceNumber: string

  tenantId: string

  tenantName: string

  description: string

  amountFcfa: string

  issuedAt: string

  dueAt: string

  status: "À payer" | "Payée" | "Annulée"

  paymentMethod: InvoicePaymentMethod | null

  paymentReference: string | null

  paidAt: string | null

  closedBy: string | null

  createdAt: string
}

export interface MobilePaymentInvoice {
  id: string

  invoiceNumber: string

  description: string

  amountFcfa: string

  currency: "XAF"

  issuedAt: string

  dueAt: string

  status: PlatformInvoice["status"]
}

export interface MobilePaymentIntent {
  id: string

  provider: string

  status: "En attente" | "Payée" | "Échouée" | "Annulée"

  amountFcfa: string

  currency: "XAF"

  providerReference: string | null

  createdAt: string

  completedAt: string | null
}

export type SupportTicketStatus = "Nouveau" | "En cours" | "En attente client" | "Résolu"

export interface SupportTicket {
  id: string

  tenantId: string

  tenantName: string

  subject: string

  description: string

  priority: "Basse" | "Normale" | "Haute" | "Urgente"

  status: SupportTicketStatus

  createdAt: string

  updatedAt: string

  resolvedAt: string | null
}

export interface TenantSettings {
  legalName: string

  taxId: string

  email: string

  phone: string

  address: string

  city: string

  country: string

  language: "fr"

  currency: "XAF"

  preferences: Record<string, boolean>

  updatedAt: string
}

export interface PlatformSettings {
  name: string

  supportEmail: string

  requestLimit: number

  updatedAt: string
}

export type PaymentDossierStatus = "En préparation" | "Prêt à transmettre" | "En instruction" | "À corriger" | "Payé" | "Refusé"

export interface PaymentDossier {
  id: string

  reference: string

  siteId: string

  siteName: string

  subject: string

  amountFcfa: string

  status: PaymentDossierStatus

  dueDate: string | null

  createdAt: string

  updatedAt: string
}

export interface PaymentDossierSummary {
  status: PaymentDossierStatus

  count: number

  amountFcfa: string
}

export const managedRoles: Array<{ value: ManagedRole; label: string }> = [
  { value: "CONDUCTEUR", label: "Conducteur de travaux" },

  { value: "CHEF_CHANTIER", label: "Chef de chantier" },

  { value: "COMPAGNON", label: "Compagnon" },

  { value: "SOUS_TRAITANT", label: "Sous-traitant" },

  { value: "COMPTABLE", label: "Comptable" },

  { value: "MAITRE_OUVRAGE", label: "Maître d’ouvrage" },
]

export class ApiError extends Error {
  constructor(
    message: string,

    readonly status: number,
  ) {
    super(message)

    this.name = "ApiError"
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    })
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ApiError(
        "Le service est temporairement indisponible. Réessayez dans quelques instants.",
        0,
      )
    }
    throw error
  }

  if (response.status === 204) return undefined as T

  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      response.status >= 500
        ? "Le service est temporairement indisponible. Réessayez dans quelques instants."
        : typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "La demande n’a pas pu être traitée. Vérifiez les informations saisies et réessayez."

    throw new ApiError(message, response.status)
  }

  return body as T
}

export const api = {
  async submitRegistrationRequest(input: {
    companyName: string
    adminFullName: string
    adminEmail: string
    phone: string
    message: string
    consent: boolean
    website: string
  }) {
    return request<{ message: string }>("/api/registration-requests", {
      method: "POST",
      body: JSON.stringify(input),
    })
  },

  async submitContact(input: {
    fullName: string
    email: string
    phone: string
    company: string
    topic: string
    message: string
    consent: boolean
    website: string
  }) {
    return request<{ message: string }>("/api/contact", {
      method: "POST",
      body: JSON.stringify(input),
    })
  },

  async login(identifier: string, password: string, rememberMe: boolean) {
    const result = await request<{ user: AuthUser }>("/api/auth/login", {
      method: "POST",

      body: JSON.stringify({ identifier, password, rememberMe }),
    })

    return result.user
  },

  async updateProfile(input: {
    fullName: string

    email: string

    phone: string | null
  }) {
    const result = await request<{ user: AuthUser }>("/api/auth/profile", {
      method: "PATCH",

      body: JSON.stringify(input),
    })

    return result.user
  },

  async updateProfilePhoto(input: {
    contentType: "image/jpeg" | "image/png" | "image/webp"
    imageBase64: string
  }) {
    const result = await request<{
      data: { profilePhotoUrl: string }
    }>("/api/auth/profile/photo", {
      method: "PUT",
      body: JSON.stringify(input),
    })
    return result.data
  },

  async removeProfilePhoto() {
    await request<void>("/api/auth/profile/photo", { method: "DELETE" })
  },

  async currentUser(): Promise<AuthUser | null> {
    try {
      const result = await request<{ user: AuthUser }>("/api/auth/me")

      return result.user
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null

      throw error
    }
  },

  async logout() {
    await request<void>("/api/auth/logout", { method: "POST" })
  },

  async sites() {
    const result = await request<{ data: Site[] }>("/api/sites")

    return result.data
  },

  async recentActivity() {
    const result = await request<{ data: RecentActivity[] }>(
      "/api/activity/recent",
    )
    return result.data
  },

  async createSite(input: { name: string; location: string }) {
    await request<{ data: Site }>("/api/sites", {
      method: "POST",

      body: JSON.stringify(input),
    })
  },

  async tasks() {
    const result = await request<{ data: Task[] }>("/api/tasks")

    return result.data
  },

  async createTask(input: {
    siteId: string

    title: string

    dueDate: string | null
  }) {
    await request<{ data: Pick<Task, "id"> }>("/api/tasks", {
      method: "POST",

      body: JSON.stringify(input),
    })
  },

  async updateTaskStatus(id: string, status: Task["status"]) {
    return request<{ data: Pick<Task, "id" | "status" | "updatedAt"> }>(
      `/api/tasks/${encodeURIComponent(id)}/status`,

      {
        method: "PATCH",

        body: JSON.stringify({ status }),
      },
    )
  },

  async reports() {
    const result = await request<{ data: Report[] }>("/api/reports")

    return result.data
  },

  async createReport(input: {
    siteId: string

    workDone: string

    crewCount: number

    reportDate?: string
  }) {
    await request<{ data: Report }>("/api/reports", {
      method: "POST",

      body: JSON.stringify(input),
    })
  },

  async validateReport(id: string) {
    const result = await request<{
      data: Pick<Report, "id" | "status" | "validatedAt">
    }>(
      `/api/reports/${encodeURIComponent(id)}/validate`,

      { method: "POST" },
    )

    return result.data
  },

  async team() {
    const result = await request<{ data: TeamMember[] }>("/api/team")

    return result.data
  },

  async createTeamMember(input: {
    fullName: string

    email: string

    phone: string | null

    role: ManagedRole

    assignedSite: string | null

    temporaryPassword: string
  }) {
    const result = await request<{ data: TeamMember }>("/api/team", {
      method: "POST",

      body: JSON.stringify(input),
    })

    return result.data
  },

  async updateTeamMember(
    id: string,

    input: {
      role: ManagedRole
      assignedSite: string | null
      active: boolean
    },
  ) {
    const result = await request<{ data: TeamMember }>(
      `/api/team/${encodeURIComponent(id)}`,

      { method: "PATCH", body: JSON.stringify(input) },
    )

    return result.data
  },

  async deleteTeamMember(id: string) {
    const result = await request<{ data: TeamMember }>(
      `/api/team/${encodeURIComponent(id)}`,

      { method: "DELETE" },
    )

    return result.data
  },

  async photos() {
    const result = await request<{ data: SitePhoto[] }>("/api/photos")

    return result.data
  },

  async createPhoto(input: {
    siteId: string

    caption: string

    contentType: "image/jpeg" | "image/png" | "image/webp"

    imageBase64: string

    latitude?: number

    longitude?: number

    capturedAt?: string
  }) {
    const result = await request<{ data: SitePhoto }>("/api/photos", {
      method: "POST",

      body: JSON.stringify(input),
    })

    return result.data
  },

  photoUrl(id: string) {
    return `/api/photos/${encodeURIComponent(id)}/image`
  },

  async attendance() {
    const result = await request<{ data: AttendanceRecord[] }>(
      "/api/attendance",
    )

    return result.data
  },

  async clockIn(location?: { latitude: number; longitude: number }) {
    const result = await request<{ data: AttendanceRecord }>(
      "/api/attendance/clock-in",
      {
        method: "POST",

        body: JSON.stringify(location ?? {}),
      },
    )

    return result.data
  },

  async clockOut(location?: { latitude: number; longitude: number }) {
    const result = await request<{ data: AttendanceRecord }>(
      "/api/attendance/clock-out",
      {
        method: "POST",

        body: JSON.stringify(location ?? {}),
      },
    )

    return result.data
  },

  async finance() {
    return request<{ data: FinanceEntry[]; summary: FinanceSummary }>(
      "/api/finance",
    )
  },

  async createFinanceEntry(input: {
    entryType: FinanceEntry["entryType"]

    siteId: string

    category: string

    description: string

    amountFcfa: number

    dueDate: string | null
  }) {
    const result = await request<{ data: FinanceEntry }>("/api/finance", {
      method: "POST",

      body: JSON.stringify(input),
    })

    return result.data
  },

  async realizeFinanceEntry(id: string) {
    const result = await request<{
      data: Pick<FinanceEntry, "id" | "status" | "occurredAt">
    }>(
      `/api/finance/${encodeURIComponent(id)}/realize`,

      { method: "POST", body: JSON.stringify({ status: "réalisé" }) },
    )

    return result.data
  },

  async paymentDossiers() {
    return request<{
      data: PaymentDossier[]
      summary: PaymentDossierSummary[]
    }>(
      "/api/payments",
    )
  },

  async createPaymentDossier(input: {
    siteId: string

    subject: string

    amountFcfa: number

    dueDate: string | null
  }) {
    const result = await request<{ data: PaymentDossier }>("/api/payments", {
      method: "POST",

      body: JSON.stringify(input),
    })

    return result.data
  },

  async updatePaymentDossierStatus(id: string, status: PaymentDossierStatus) {
    const result = await request<{
      data: Pick<PaymentDossier, "id" | "status" | "updatedAt">
    }>(`/api/payments/${encodeURIComponent(id)}/status`, {
      method: "PATCH",

      body: JSON.stringify({ status }),
    })

    return result.data
  },

  async platformOverview() {
    const result = await request<{ data: PlatformOverview }>(
      "/api/platform/overview",
    )

    return result.data
  },

  async platformTenants() {
    const result = await request<{ data: PlatformTenant[] }>(
      "/api/platform/tenants",
    )

    return result.data
  },

  async registrationRequests() {
    const result = await request<{ data: RegistrationRequest[] }>(
      "/api/platform/registration-requests",
    )
    return result.data
  },

  async updateRegistrationRequest(
    id: string,
    status: RegistrationRequestStatus,
  ) {
    const result = await request<{
      data: Pick<RegistrationRequest, "id" | "status" | "updatedAt">
    }>(`/api/platform/registration-requests/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    })
    return result.data
  },

  async platformInvoices() {
    const result = await request<{ data: PlatformInvoice[] }>(
      "/api/platform/invoices",
    )
    return result.data
  },

  async createPlatformInvoice(input: {
    tenantId: string
    description: string
    amountFcfa: number
    issuedAt: string
    dueAt: string
  }) {
    const result = await request<{ data: PlatformInvoice }>(
      "/api/platform/invoices",
      { method: "POST", body: JSON.stringify(input) },
    )
    return result.data
  },

  async updatePlatformInvoiceStatus(
    id: string,
    input: {
      status: "Payée" | "Annulée"
      paymentMethod?: InvoicePaymentMethod
      paymentReference?: string | null
    },
  ) {
    const result = await request<{
      data: Pick<
        PlatformInvoice,
        "id" | "status" | "paymentMethod" | "paymentReference" | "paidAt"
      >
    }>(`/api/platform/invoices/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify(input),
    })
    return result.data
  },

  async mobilePaymentInvoices() {
    const result = await request<{ data: MobilePaymentInvoice[] }>(
      "/api/mobile-payments/invoices",
    )
    return result.data
  },

  async createMobilePaymentIntent(input: {
    invoiceId: string
    provider: string
    phoneNumber: string
    idempotencyKey: string
  }) {
    const result = await request<{ data: MobilePaymentIntent }>(
      "/api/mobile-payments/intents",
      {
        method: "POST",
        headers: { "Idempotency-Key": input.idempotencyKey },
        body: JSON.stringify({
          invoiceId: input.invoiceId,
          provider: input.provider,
          phoneNumber: input.phoneNumber,
        }),
      },
    )
    return result.data
  },

  async mobilePaymentIntent(id: string) {
    const result = await request<{ data: MobilePaymentIntent }>(
      `/api/mobile-payments/intents/${encodeURIComponent(id)}`,
    )
    return result.data
  },

  async createPlatformTenant(input: {
    name: string

    adminFullName: string

    adminEmail: string

    temporaryPassword: string
  }) {
    const result = await request<{
      data: Pick<PlatformTenant, "id" | "name" | "status" | "createdAt">

      adminEmail: string
    }>("/api/platform/tenants", {
      method: "POST",

      body: JSON.stringify(input),
    })

    return result.data
  },

  async updateTenantSubscription(
    id: string,

    input: {
      planId: string

      status: NonNullable<PlatformTenant["subscriptionStatus"]>

      renewsAt: string | null
    },
  ) {
    const result = await request<{
      data: {
        tenantId: string

        planId: string

        status: NonNullable<PlatformTenant["subscriptionStatus"]>

        renewsAt: string | null
      }
    }>(
      `/api/platform/tenants/${encodeURIComponent(id)}/subscription`,

      { method: "PATCH", body: JSON.stringify(input) },
    )

    return result.data
  },

  async subscriptionPlans() {
    const result = await request<{ data: SubscriptionPlan[] }>(
      "/api/platform/plans",
    )

    return result.data
  },

  async saveSubscriptionPlan(
    input: {
      name: string

      monthlyPriceFcfa: number

      maxUsers: number | null

      maxSites: number | null

      active?: boolean
    },

    id?: string,
  ) {
    const result = await request<{ data: SubscriptionPlan }>(
      id
        ? `/api/platform/plans/${encodeURIComponent(id)}`
        : "/api/platform/plans",

      {
        method: id ? "PATCH" : "POST",

        body: JSON.stringify({
          ...input,
          active: input.active ?? true,
        }),
      },
    )

    return result.data
  },

  async supportTickets() {
    const result = await request<{ data: SupportTicket[] }>(
      "/api/platform/tickets",
    )

    return result.data
  },

  async createSupportTicket(input: {
    tenantId: string

    subject: string

    description: string

    priority: SupportTicket["priority"]
  }) {
    const result = await request<{ data: SupportTicket }>(
      "/api/platform/tickets",

      { method: "POST", body: JSON.stringify(input) },
    )

    return result.data
  },

  async updateSupportTicketStatus(id: string, status: SupportTicketStatus) {
    const result = await request<{
      data: Pick<SupportTicket, "id" | "status" | "updatedAt" | "resolvedAt">
    }>(`/api/platform/tickets/${encodeURIComponent(id)}/status`, {
      method: "PATCH",

      body: JSON.stringify({ status }),
    })

    return result.data
  },

  async tenantSettings() {
    const result = await request<{ data: TenantSettings }>(
      "/api/company/settings",
    )

    return result.data
  },

  async saveTenantSettings(input: Omit<TenantSettings, "updatedAt">) {
    const result = await request<{ data: TenantSettings }>(
      "/api/company/settings",
      {
        method: "PUT",

        body: JSON.stringify(input),
      },
    )

    return result.data
  },

  async platformSettings() {
    const result = await request<{ data: PlatformSettings }>(
      "/api/platform/settings",
    )

    return result.data
  },

  async savePlatformSettings(input: Omit<PlatformSettings, "updatedAt">) {
    const result = await request<{ data: PlatformSettings }>(
      "/api/platform/settings",

      { method: "PUT", body: JSON.stringify(input) },
    )

    return result.data
  },
}
