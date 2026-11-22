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
  /** kontroll-emlékeztető üzenetsablonok (2.1.2; admin/beállítások menüben szerkeszthető) */
  recallTemplates: MsgTemplate[]
  /** „javasolt kezelés – egyeztessen időpontot” üzenetsablon (udvarias, kérő hangnem – spec v2.2, 8. pont) */
  suggestTemplate: string
  /** tájékoztató a páciensnek a rögzített időpontról és a javasolt kezelésekről (spec v2.2, 8. pont) */
  informTemplate?: string
  /** szinonimatábla a diktálás értelmezéséhez (5. pont) */
  synonyms?: Synonym[]
}

export interface Synonym { id: string; from: string; to: string; group: string }

export interface MsgTemplate { id: string; name: string; text: string }

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
  /** kiszerelés-változatok (pl. 6, 8 → „6-os”, „8-as”): a „három hatos injekció” = 3 db a 6-os változatból (spec v2.3, 5. pont) */
  variants?: number[]
  /** gyártási szám (LOT) és lejárat nyilvántartása kötelező */
  lotTracked?: boolean
  /** implantátum: a beültetett darab LOT-ja a páciens kartonjába kerül */
  implant?: boolean
  /** a legutóbbi bevételezés egységára (a `price` a gördülő súlyozott átlagár) */
  lastPrice?: number
  /** biztonsági tartalék: mennyiség (db) vagy hét fogyása; ha nincs megadva, 0 */
  safety?: { mode: 'qty' | 'weeks'; value: number } | null
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
  /** fogra (nem a teljes szájra) végzett művelet: a kezelési tétel foghoz kötött */
  toothBound?: boolean
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
  /** kezelő (fő-) orvos (spec v2.2, 5. pont); a v2.2 előtt felvett páciensnél hiányozhat */
  doctorId?: string | null
  /** a kezelő orvos módosításainak naplója */
  doctorLog?: { at: string; by: string; from: string | null; to: string; reason: string }[]
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
  /** a foglalt kezelési tételek (fog, művelet, felszín) – a kezelés indításakor „előjegyzett” tételek */
  items?: PlannedItem[]
  /** a páciens „NEM” választ küldött az emlékeztetőre: lemondást jelzett, az asszisztens zárja le */
  cancelSignal?: { at: string; text: string }
  /** a páciens egyéb válaszai az emlékeztetőre (üzenet az asszisztensnek, v2.1 9. pont); lezárásig a Teendők között */
  replies?: { id: string; at: string; text: string; done?: boolean }[]
  /** összevonás: a ide beolvasztott időpontok azonosítói (spec v2.2, 2. pont) */
  mergedFrom?: string[]
}

/** foglalt tétel: fog, művelet, felszín; javasolt eredetű tételnél a javaslat azonosítója és a végző orvos (spec v2.2, 6–7. pont) */
export interface PlannedItem { tooth: number | null; typeId: string; surfaces: Surface[]; suggestionId?: string; doctorId?: string | null }

/** törölt vagy lemondott jövőbeli időpont: „törölve” állapotban megmarad, 30 napig visszaállítható (spec v2.2, 2. pont) */
export interface DeletedAppt {
  id: string
  appt: Appointment
  kind: 'delete' | 'cancel' | 'merged'
  reason: string
  at: string
  by: string
  /** a törlés után a tételekkel történtek (naplóhoz) */
  fate: string
  /** az érintett javaslatok azonosítói, visszaállításkor újra az időponthoz kötődnek */
  suggestionIds: string[]
  notified?: boolean
}

/** a diktálás nem mentett piszkozata: 7 napig marad meg, készletet nem von le (spec v2.2, 4. pont) */
export interface Draft {
  id: string
  patientId: string
  appointmentId: string | null
  recordId: string | null
  doctorId: string
  text: string
  savedAt: string
  expires: string
}

/** páciens-tájékoztató (időpont + javasolt kezelések) kiküldésének vagy mellőzésének naplója (spec v2.2, 8. pont) */
export interface InformLog {
  id: string
  patientId: string
  appointmentIds: string[]
  at: string
  kind: 'sent' | 'skipped'
  channel: string
  text: string
  reason?: string
}

/** kezelési tétel egy vizitben (2. pont): egy fog + egy művelet */
export type ItemOrigin = 'planned' | 'added' | 'manual'
export interface VisitItem {
  id: string
  tooth: number | null
  typeId: string
  surfaces: Surface[]
  /** előjegyzett / kezelés közben hozzáadott */
  origin: ItemOrigin
  /** elvégzett vagy elhalasztott (a javasolt tétel külön, Suggestion) */
  state: 'done' | 'postponed'
  fee: number
  note?: string
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
  /** a vizit kezelési tételei (foganként, műveletenként); a régi rekordoknál hiányzik */
  items?: VisitItem[]
  /** utólagos módosítások naplója (ki, mikor) */
  editLog?: { at: string; by: string; note: string }[]
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
  /** a pillanatképben változott fogak: korábbi → új állapot (a fog előzményeihez) */
  changes?: Record<string, { from: string[]; to: string[] }>
  source?: 'dictation' | 'status' | 'manual' | 'treatment'
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
  lines: { item: string; qty: number; received?: number }[]
  orderedBy: string
  /** leadva → részben beérkezett → beérkezett (automatikus) / lezárt (kézi) / visszavont */
  status: 'ordered' | 'partial' | 'received' | 'closed' | 'cancelled'
  note: string
  /** rendelésszám / megjegyzés */
  ref?: string
  /** várható beérkezés (megrendelés dátuma + beszerzési idő) */
  expected?: string
  receivedDate?: string
  closedNote?: string
  cancelReason?: string
}

/** javasolt, de még be nem ütemezett kezelés (12. pont) */
export type SuggestionStatus = 'new' | 'contacted' | 'booked' | 'done' | 'postponed' | 'declined' | 'dropped'
export interface Suggestion {
  id: string
  patientId: string
  recordId: string | null
  doctorId: string
  createdAt: string
  tooth: number | null
  typeId: string
  surfaces: Surface[]
  note: string
  urgency: 'urgent' | 'recommended' | 'later'
  /** mikorra javasolt (határidő) */
  due: string | null
  status: SuggestionStatus
  /** elhalasztva: ekkor jelez újra */
  remindAt?: string | null
  contacts: { date: string; channel: string; note: string }[]
  appointmentId?: string | null
  callback?: boolean
  droppedBy?: string
  closedNote?: string
  /** végző orvos (spec v2.2, 7. pont); alapértelmezés: a páciens kezelő orvosa */
  performerId?: string | null
  /** „újra megerősítve” bejegyzések: ugyanazt javasolta egy későbbi vizit is (spec v2.2, 6. pont) */
  confirms?: { date: string; recordId: string | null; doctorId: string }[]
}

/** kontroll-emlékeztető: a „nem szükséges” és az elhalasztás nyilvántartása (8. pont) */
export interface RecallSnooze { id: string; patientId: string; typeId: string; last: string; until: string | null; reason: string; date: string }

export interface SavedFilter { id: string; name: string; filters: StockFilters; builtin?: boolean }
export interface StockFilters {
  q: string
  stockMin: number | null; stockMax: number | null
  priceMin: number | null; priceMax: number | null
  useMin: number | null; useMax: number | null
  leadMin: number | null; leadMax: number | null
  byFrom: string; byTo: string
  quick: '' | 'overdue' | 'today' | 'week' | 'month'
  belowReserve: boolean
  notOrdered: boolean
  siteId: string
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
  suggestions: Suggestion[]
  recallSnoozes: RecallSnooze[]
  savedFilters: SavedFilter[]
  /** törölt / lemondott / összevont jövőbeli időpontok (spec v2.2) */
  deleted: DeletedAppt[]
  drafts: Draft[]
  informs: InformLog[]
}
