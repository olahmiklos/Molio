// A Molio adatmodellje (a böngészős demóban és a végleges rendszerben azonos szerkezet).
// A végleges PostgreSQL-séma: prisma/schema.prisma

export type Surface = 'M' | 'O' | 'D' | 'V' | 'L'
export type Dentition = 'primary' | 'permanent'
export type PerMode = 'visit' | 'tooth' | 'surface'
export type SurfaceMap = Record<string, Surface[]>

export interface NotifySettings {
  sms: boolean
  email: boolean
  timing: '24' | '48' | '24+2'
  smsTpl: string
  mailSubj: string
  mailTpl: string
}

export interface StatusDef {
  id: string
  name: string
  kw: string[]
}

export interface Company { id: string; name: string; address: string; phone: string; email: string }
export interface Site { id: string; companyId: string; name: string; address: string; phone: string; startHour: number; endHour: number }
export interface Room { id: string; siteId: string; name: string }

export interface Settings {
  clinic: string
  address: string
  phone: string
  startHour: number
  endHour: number
  notify: NotifySettings
  primaryAgeLimit: number
  patientBuffer: number
  statusDict: StatusDef[]
}

export interface Doctor { id: string; name: string }

export interface Item {
  id: string
  siteId: string
  group: string
  name: string
  unit: string
  target: number
  stock: number
  lead: number
  price: number
  supplier: string
  kw: string[]
  generic: boolean
  /** gyártási szám (LOT) és lejárat nyilvántartása kötelező */
  lotTracked?: boolean
  /** implantátum: a beültetett darab LOT-ja a páciens kartonjába kerül */
  implant?: boolean
  /** a legutóbbi bevételezés egységára (a `price` a gördülő súlyozott átlagár) */
  lastPrice?: number
}

/** gyártási tétel (LOT) a raktárban: a kiadás lejárat szerint történik (ami előbb lejár, az fogy előbb) */
export interface Lot { id: string; item: string; lot: string; expiry: string; qty: number; received: string; unitPrice: number }
export interface LotUse { lot: string; expiry: string; qty: number }

export interface PackageLine { item: string; qty: number; per: PerMode }

export interface TreatmentType {
  id: string
  name: string
  dur: number
  buffer: number
  price: number
  /** felszínszám szerinti díj: [1 felszín, 2 felszín, 3+ felszín] */
  priceBySurf?: [number, number, number] | null
  needsSurface?: boolean
  kw: string[]
  notAfter?: string[]
  mats: PackageLine[]
  color: string
  /** a jóváhagyás után felajánlott fogállapot */
  statusAfter?: string | null
  /** kontroll-meghívó (recall) ennyi hónap múlva; 0 / üres = nincs */
  recallMonths?: number
  /** beleegyező nyilatkozat sablonja (CONSENT_TPL kulcsa) */
  consent?: string
}

export interface RemindChoice { sms: boolean; email: boolean; timing?: NotifySettings['timing'] }

export interface Patient {
  id: string
  name: string
  birth: string
  taj: string
  phone: string
  email: string
  address: string
  healthWarning: string
  internalNote: string
  needsBuffer: boolean
  dentition: Dentition
  dentitionHistory: { date: string; to: Dentition }[]
  statuses: StatusSnapshot[]
  created: string
  remind: RemindChoice
}

export interface Planned { teeth: number[]; surfaces: SurfaceMap }

export interface Appointment {
  id: string
  patientId: string
  doctorId: string
  roomId: string
  date: string
  start: string
  dur: number
  buffer: number
  typeIds: string[]
  note: string
  remind: RemindChoice
  created: string
  confirmed?: boolean
  sentAt?: string
  status?: 'noshow'
  late?: number
  planned?: Planned | null
}

export interface MaterialUse { item: string; qty: number; lots?: LotUse[]; cost?: number }

export interface TreatmentRecord {
  id: string
  patientId: string
  appointmentId: string | null
  doctorId: string
  date: string
  time: string
  typeIds: string[]
  teeth: number[]
  surfaces: SurfaceMap
  planned?: Planned | null
  extended?: boolean
  text: string
  materials: MaterialUse[]
  fee: number
  /** sterilizálási tétel (műszercsomag) azonosítója */
  sterBatch?: string | null
  /** EESZT-jelentés állapota (a demóban szimulált) */
  eeszt?: { status: 'pending' | 'sent'; sentAt?: string; ref?: string }
  /** közérthető tájékoztató a páciensnek – csak orvosi jóváhagyás után küldhető */
  patientInfo?: PatientInfo
}

export interface PatientInfo {
  text: string
  status: 'draft' | 'approved' | 'sent'
  approvedBy?: string
  approvedAt?: string
  sentAt?: string
  channels?: string[]
}

export interface StatusSnapshot {
  id: string
  date: string
  dentition: Dentition
  teeth: Record<string, string[]>
  note: string
}

export interface Movement {
  id: string
  item: string
  date: string
  qty: number
  kind: 'in' | 'use' | 'corr'
  recordId?: string
  patientId?: string
  note: string
  /** bevételezésnél: egységár és a bevételezés utáni átlagár */
  unitPrice?: number
  avgAfter?: number
  lot?: string
  expiry?: string
  lots?: LotUse[]
}

export interface Attachment {
  id: string
  patientId: string
  recordId: string | null
  sessKey: string | null
  type: string
  name: string
  mime: string
  size: number
  date: string
  note: string
}

export interface AttendanceEvent {
  id: string
  patientId: string
  date: string
  kind: 'attended' | 'noshow' | 'latecancel' | 'cancel' | 'late'
  min: number
}

/** sterilizációs ciklus (autokláv) */
export interface SterCycle {
  id: string
  date: string
  time: string
  device: string
  program: string
  batch: string
  operator: string
  packs: number
  contents: string
  chem: boolean
  bowieDick: boolean | null
  bio: boolean | null
  ok: boolean
  note: string
}

/** megrendelés: a program javasolja, de mindig munkatárs adja le */
export interface Order {
  id: string
  date: string
  supplier: string
  lines: { item: string; qty: number }[]
  orderedBy: string
  status: 'ordered' | 'received'
  note: string
}

export interface RecallInvite { id: string; patientId: string; typeId: string; date: string; channels: string[] }

export interface Consent {
  id: string
  patientId: string
  recordId: string | null
  sessKey: string | null
  typeIds: string[]
  teeth: number[]
  title: string
  text: string
  doctorId: string
  signedAt: string
  attachmentId: string
}

export interface InvoiceLine { name: string; qty: number; price: number }
export interface Invoice {
  id: string
  no: string
  date: string
  patientId: string
  recordIds: string[]
  payerName: string
  payerAddress: string
  method: 'cash' | 'card' | 'transfer' | 'fund'
  fund: string
  lines: InvoiceLine[]
  total: number
}

export interface DB {
  version: number
  seededAt: string
  company: Company
  sites: Site[]
  rooms: Room[]
  settings: Settings
  doctors: Doctor[]
  items: Item[]
  types: TreatmentType[]
  patients: Patient[]
  appointments: Appointment[]
  records: TreatmentRecord[]
  movements: Movement[]
  attachments: Attachment[]
  events: AttendanceEvent[]
  lots: Lot[]
  orders: Order[]
  sterCycles: SterCycle[]
  recallInvites: RecallInvite[]
  consents: Consent[]
  invoices: Invoice[]
}
