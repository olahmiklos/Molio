// Rendelői adminisztráció (spec v2.0): kontroll-meghívók, páciens-tájékoztató orvosi jóváhagyással,
// beleegyező nyilatkozat, EESZT-jelentés és számla (a demóban szemléltetés), sterilizációs napló
import { defineStore } from 'pinia'
import { useDataStore } from './data'
import { today, uid } from '~/utils/dates'
import type { Consent, Invoice, SterCycle } from '~/utils/types'
import { batchNo, bowieDickToday, eesztRef, nextInvoiceNo, patientInfoDraft, recallRows, usableBatches } from '~/utils/office'
import { doctorName } from '~/utils/logic'
import { useRepository } from '~/repositories'

export const useOfficeStore = defineStore('office', () => {
  const data = useDataStore()
  const db = computed(() => data.db)
  const recById = (id: string) => db.value.records.find(r => r.id === id)

  /* ---------- kontroll-meghívó (recall) ---------- */
  const recalls = computed(() => recallRows(db.value))
  function invite(patientId: string, typeId: string, channels: string[]) {
    db.value.recallInvites.push({ id: uid(), patientId, typeId, date: today(), channels })
  }
  /** „nem szükséges” (until = null) vagy „később” – a sor eltűnik, amíg az utolsó kezelés nem változik / a határidő le nem jár */
  function snoozeRecall(patientId: string, typeId: string, last: string, until: string | null, reason: string) {
    db.value.recallSnoozes.push({ id: uid(), patientId, typeId, last, until, reason, date: today() })
  }
  function undoSnooze(patientId: string, typeId: string, last: string) {
    db.value.recallSnoozes = db.value.recallSnoozes.filter(z => !(z.patientId === patientId && z.typeId === typeId && z.last === last))
  }

  /* ---------- páciens-tájékoztató: vázlat → orvosi jóváhagyás → küldés ---------- */
  function ensureInfo(rid: string) {
    const r = recById(rid); if (!r) return null
    if (!r.patientInfo) r.patientInfo = { text: patientInfoDraft(db.value, r), status: 'draft' }
    return r.patientInfo
  }
  function regenerateInfo(rid: string) { const r = recById(rid); if (r) r.patientInfo = { text: patientInfoDraft(db.value, r), status: 'draft' } }
  function setInfoText(rid: string, text: string) {
    const r = recById(rid); if (!r?.patientInfo) return
    // a jóváhagyott szöveg módosítása után újra jóvá kell hagyni
    r.patientInfo.text = text
    if (r.patientInfo.status === 'approved') { r.patientInfo.status = 'draft'; r.patientInfo.approvedBy = undefined; r.patientInfo.approvedAt = undefined }
  }
  function approveInfo(rid: string, doctorId: string) {
    const r = recById(rid); if (!r?.patientInfo) return
    Object.assign(r.patientInfo, { status: 'approved', approvedBy: doctorName(db.value, doctorId), approvedAt: today() })
  }
  function sendInfo(rid: string, channels: string[]) {
    const r = recById(rid); if (!r?.patientInfo || r.patientInfo.status !== 'approved') return false
    Object.assign(r.patientInfo, { status: 'sent', sentAt: today(), channels })
    return true
  }
  const pendingInfos = computed(() => db.value.records.filter(r => r.patientInfo?.status === 'draft' || r.patientInfo?.status === 'approved'))

  /* ---------- EESZT (szemléltetés) ---------- */
  function sendEeszt(rid: string) {
    const r = recById(rid); if (!r) return null
    r.eeszt = { status: 'sent', sentAt: today(), ref: eesztRef() }
    return r.eeszt.ref
  }
  const eesztPending = computed(() => db.value.records.filter(r => r.eeszt?.status === 'pending'))

  /* ---------- számla (szemléltetés) ---------- */
  const invoiceFor = (pid: string, date: string) => db.value.invoices.find(i => i.patientId === pid && i.date === date)
  function issueInvoice(inv: Omit<Invoice, 'id' | 'no'>) {
    const n: Invoice = { ...inv, id: uid(), no: nextInvoiceNo(db.value, inv.date) }
    db.value.invoices.push(n); return n
  }

  /* ---------- beleegyező nyilatkozat ---------- */
  async function saveConsent(c: Omit<Consent, 'id' | 'attachmentId' | 'signedAt'>, pdf: Blob, fileName: string) {
    const id = 'a' + uid()
    const ok = await useRepository().putFile(id, pdf)
    db.value.attachments.push({ id, patientId: c.patientId, recordId: c.recordId, sessKey: c.sessKey, type: 'nyilatkozat', name: fileName, mime: 'application/pdf', size: pdf.size, date: today(), note: c.title + ' – aláírva' })
    const n: Consent = { ...c, id: uid(), attachmentId: id, signedAt: new Date().toISOString() }
    db.value.consents.push(n)
    return { consent: n, memOnly: !ok }
  }
  const consentsOf = (pid: string) => db.value.consents.filter(c => c.patientId === pid).sort((a, b) => b.signedAt.localeCompare(a.signedAt))

  /* ---------- sterilizálás ---------- */
  const cycles = computed(() => db.value.sterCycles.slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)))
  const batches = computed(() => usableBatches(db.value))
  const bdToday = computed(() => bowieDickToday(db.value))
  function addCycle(c: Omit<SterCycle, 'id' | 'batch'>) {
    const n: SterCycle = { ...c, id: uid(), batch: batchNo(db.value, c.date) }
    db.value.sterCycles.push(n); return n
  }
  /** egy sterilizálási tétel csomagjaival kezelt páciensek (sikertelen ciklusnál visszakövetés) */
  const recordsOfBatch = (batch: string) => db.value.records.filter(r => r.sterBatch === batch)

  return {
    recalls, invite, snoozeRecall, undoSnooze,
    ensureInfo, regenerateInfo, setInfoText, approveInfo, sendInfo, pendingInfos,
    sendEeszt, eesztPending,
    invoiceFor, issueInvoice,
    saveConsent, consentsOf,
    cycles, batches, bdToday, addCycle, recordsOfBatch,
  }
})
