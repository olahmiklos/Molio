// Kiinduló törzsadatok: anyagok, kezelési csomagok, értesítési sablonok.
// Forrás: a 07_Demo/index.html defaultItems() és defaultTypes() része, a v1.9 specifikáció kiegészítéseivel
// (felszínenkénti anyagok és díjak, ráhagyási idő, színkód).
// A beszállítók kitaláltak, az egységárak és díjak becsült, bemutató célú értékek.
import type { Item, NotifySettings, TreatmentType } from './types'

export const SITE_ID = 'site-buda'
export const ROOM_ID = 'room-1'

export function defaultItems(): Item[] {
  const DP = 'Dentál Partner Kft.', MD = 'MedDent Nagykereskedés Zrt.', HM = 'Higiénia-Med Kft.', EL = 'Endo-Line Kft.'
  const I = (id: string, group: string, name: string, unit: string, target: number, stock: number, lead: number, price: number, supplier: string, kw: string[], generic = false): Item =>
    ({ id, siteId: SITE_ID, group, name, unit, target, stock, lead, price, supplier, kw, generic })
  return [
    I('amp', 'Érzéstelenítők', 'Artikain 4% + adrenalin 1:100 000 (1,7 ml)', 'ampulla', 200, 120, 7, 260, DP, ['ampull*', 'erzestelenit*', 'artikain*', 'karpul*'], true),
    I('amp2', 'Érzéstelenítők', 'Artikain 4% + adrenalin 1:200 000 (1,7 ml)', 'ampulla', 100, 60, 7, 270, DP, ['200 000', 'ketszazezr*', 'enyhebb adrenalin*']),
    I('lido', 'Érzéstelenítők', 'Lidokain 2% + adrenalin 1:100 000 (1,8 ml)', 'ampulla', 100, 45, 7, 210, MD, ['lidokain*', 'lidocain*']),
    I('mepi', 'Érzéstelenítők', 'Mepivakain 3%, érösszehúzó nélkül (1,8 ml)', 'ampulla', 60, 30, 10, 290, DP, ['mepivakain*', 'mepivacain*', 'adrenalinmentes*']),
    I('topik', 'Érzéstelenítők', 'Felületi érzéstelenítő gél (benzokain 20%)', 'adag', 100, 70, 7, 45, MD, ['feluleti*', 'benzokain*', 'zsele*']),
    I('tu', 'Injekciós tűk', 'Injekciós tű 27G rövid (0,4 × 25 mm) – infiltrációs', 'db', 100, 8, 5, 35, DP, ['injekcios', 'tu', 'tut', 'tuk', 'tuvel', 'tuket'], true),
    I('tu2', 'Injekciós tűk', 'Injekciós tű 27G hosszú (0,4 × 35 mm) – vezetéses érzéstelenítéshez', 'db', 100, 60, 5, 38, DP, ['hosszu tu', 'hosszu tut', 'hosszu tuvel', 'hosszu injekcios', 'vezeteses*', 'mandibular*']),
    I('tu3', 'Injekciós tűk', 'Injekciós tű 30G extra rövid (0,3 × 12 mm) – palatinális, intraligamentáris', 'db', 100, 40, 14, 42, MD, ['30 g*', '30g*', 'harmincas tu*', 'extra rovid*', 'intraligament*']),
    I('tu4', 'Injekciós tűk', 'Endodonciás öblítőtű 30G, oldalnyílású', 'db', 100, 50, 14, 55, EL, ['oblitotu*', 'endodoncias tu*']),
    I('tamp', 'Kötszerek és tamponok', 'Vattatampon (vattatekercs) Nr. 2', 'db', 500, 380, 5, 6, HM, ['tampon*', 'vattatekercs*', 'vatta*'], true),
    I('gez', 'Kötszerek és tamponok', 'Gézlap 5 × 5 cm, steril', 'db', 300, 150, 5, 18, HM, ['gezlap*', 'gez', 'gezt', 'gezzel', 'gezek*', 'gezes*']),
    I('hemo', 'Kötszerek és tamponok', 'Vérzéscsillapító kollagénszivacs', 'db', 40, 18, 14, 650, DP, ['verzescsillapit*', 'kollagen*', 'szivacs*']),
    I('varrat', 'Kötszerek és tamponok', 'Sebészi varróanyag 4-0, felszívódó', 'db', 36, 14, 14, 900, MD, ['varrat*', 'varro*', 'varrt*', 'varrom*', 'oltes*']),
    I('komp', 'Tömőanyagok és ragasztók', 'Kompozit tömőanyag, univerzális (A2)', 'kapszula', 100, 60, 14, 520, DP, ['kompozit*', 'kapszul*']),
    I('bond', 'Tömőanyagok és ragasztók', 'Bond (adhezív ragasztó)', 'adag', 100, 55, 14, 180, DP, ['bond*', 'ragaszt*', 'adheziv*']),
    I('sav', 'Tömőanyagok és ragasztók', 'Savazó gél (37% foszforsav)', 'adag', 100, 50, 10, 60, MD, ['savaz*', 'savgel*']),
    I('ideig', 'Tömőanyagok és ragasztók', 'Ideiglenes tömőanyag', 'adag', 50, 4, 7, 120, MD, ['ideiglenes*']),
    I('resz', 'Gyökérkezelés', 'Gyökércsatorna-tágító K-reszelő (25 mm)', 'db', 60, 30, 14, 450, EL, ['reszelo*', 'tagit*']),
    I('gutta', 'Gyökérkezelés', 'Gyökértöltő csúcs (guttapercha)', 'db', 120, 70, 14, 25, EL, ['gutta*', 'csucs*', 'csuccsal', 'gyokertolt*']),
    I('obl', 'Gyökérkezelés', 'Gyökérkezelő öblítő oldat (nátrium-hipoklorit 2,5%)', 'ml', 1000, 600, 7, 4, EL, ['oblit*', 'hipoklorit*', 'natriumhipoklorit*', 'natrium hipoklorit*']),
    I('leny', 'Lenyomatanyagok', 'A-szilikon lenyomatanyag', 'adag', 40, 22, 10, 1500, MD, ['lenyomat*', 'szilikon*']),
    I('polir', 'Profilaxis', 'Polírpaszta', 'adag', 200, 25, 21, 90, HM, ['polirpaszt*', 'paszt*']),
    I('nyal', 'Egyszer használatos eszközök', 'Nyálszívó', 'db', 300, 210, 5, 15, HM, ['nyalsziv*', 'szivo*']),
    I('kesz', 'Egyszer használatos eszközök', 'Nitril kesztyű', 'pár', 500, 300, 5, 45, HM, ['keszty*']),
  ]
}

export function defaultTypes(): TreatmentType[] {
  return [
    { id: 'kontroll', name: 'Állapotfelmérés, kontroll', dur: 30, buffer: 0, price: 15000, color: '#13b0a5', kw: ['kontroll*', 'allapotfelmer*', 'vizsgal*', 'szures*'],
      mats: [{ item: 'kesz', qty: 2, per: 'visit' }, { item: 'nyal', qty: 1, per: 'visit' }, { item: 'tamp', qty: 2, per: 'visit' }] },
    { id: 'tomes', name: 'Esztétikus (kompozit) tömés', dur: 60, buffer: 0, price: 25000, priceBySurf: [25000, 32000, 38000], needsSurface: true, statusAfter: 'tomott', color: '#2a8ccc',
      kw: ['tomes*', 'tomt*', 'tomo*', 'tomni*', 'tomunk*'], notAfter: ['ideiglenes*'],
      mats: [{ item: 'amp', qty: 1, per: 'visit' }, { item: 'tu', qty: 1, per: 'visit' }, { item: 'kesz', qty: 2, per: 'visit' }, { item: 'nyal', qty: 1, per: 'visit' },
        { item: 'tamp', qty: 3, per: 'tooth' }, { item: 'sav', qty: 1, per: 'tooth' }, { item: 'bond', qty: 1, per: 'surface' }, { item: 'komp', qty: 1, per: 'surface' }, { item: 'polir', qty: 1, per: 'tooth' }] },
    { id: 'fogko', name: 'Fogkő-eltávolítás és polírozás', dur: 60, buffer: 0, price: 20000, color: '#9aa5b1', kw: ['fogko*', 'depural*', 'ultrahang*'],
      mats: [{ item: 'kesz', qty: 2, per: 'visit' }, { item: 'nyal', qty: 1, per: 'visit' }, { item: 'tamp', qty: 4, per: 'visit' }, { item: 'polir', qty: 3, per: 'visit' }] },
    { id: 'huzas', name: 'Foghúzás', dur: 30, buffer: 30, price: 22000, statusAfter: 'hianyzik', color: '#e8344e', kw: ['foghuz*', 'huzas*', 'kihuz*', 'huzt*', 'extrakci*'],
      mats: [{ item: 'amp', qty: 1, per: 'visit' }, { item: 'tu', qty: 1, per: 'visit' }, { item: 'kesz', qty: 2, per: 'visit' }, { item: 'nyal', qty: 1, per: 'visit' }, { item: 'tamp', qty: 2, per: 'tooth' }, { item: 'gez', qty: 2, per: 'tooth' }] },
    { id: 'korona', name: 'Koronához fogelőkészítés és lenyomatvétel', dur: 90, buffer: 30, price: 45000, statusAfter: 'korona', color: '#f5b31f', kw: ['koron*', 'csiszol*', 'preparal*'],
      mats: [{ item: 'amp', qty: 1, per: 'visit' }, { item: 'tu', qty: 1, per: 'visit' }, { item: 'kesz', qty: 2, per: 'visit' }, { item: 'nyal', qty: 1, per: 'visit' }, { item: 'leny', qty: 2, per: 'visit' },
        { item: 'tamp', qty: 3, per: 'tooth' }, { item: 'ideig', qty: 1, per: 'tooth' }] },
    { id: 'gyoker', name: 'Gyökérkezelés', dur: 90, buffer: 30, price: 58000, statusAfter: 'gyokerkezelt', color: '#8b4fe0', kw: ['gyokerkezel*', 'gyokercsatorn*', 'trepanal*'],
      mats: [{ item: 'amp', qty: 1, per: 'visit' }, { item: 'tu', qty: 1, per: 'visit' }, { item: 'kesz', qty: 2, per: 'visit' }, { item: 'nyal', qty: 1, per: 'visit' },
        { item: 'tamp', qty: 3, per: 'tooth' }, { item: 'resz', qty: 3, per: 'tooth' }, { item: 'obl', qty: 10, per: 'tooth' }, { item: 'tu4', qty: 1, per: 'tooth' }, { item: 'gutta', qty: 4, per: 'tooth' }, { item: 'ideig', qty: 1, per: 'tooth' }] },
  ]
}

export function defaultNotify(): NotifySettings {
  return {
    sms: true, email: false, timing: '24',
    smsTpl: 'Kedves {név}! Emlékeztetjük, hogy {dátum} {idő}-kor időpontja van a {klinika} rendelőjében ({orvos}). Ha nem tud jönni, kérjük, jelezze: {telefon}. Válaszoljon IGEN-nel, ha jön.',
    mailSubj: 'Emlékeztető: fogorvosi időpont – {dátum} {idő}',
    mailTpl: 'Kedves {név}!\n\nEzúton emlékeztetjük, hogy {dátum} {idő}-kor {orvos} várja Önt a {klinika} rendelőjében ({cím}).\nKezelés: {kezelés}\n\nHa nem tud eljönni, kérjük, legalább 24 órával előtte jelezze a {telefon} telefonszámon.\n\nÜdvözlettel:\n{klinika}',
  }
}

/** a dokumentumtípusok (2.2.3) */
export const DOC_TYPES: [string, string][] = [
  ['rtg_pa', 'Röntgen – periapikális (fogfelvétel)'],
  ['rtg_bw', 'Röntgen – szárnyas (bitewing) felvétel'],
  ['opg', 'Panorámaröntgen (OPG)'],
  ['cbct', 'CBCT / 3D röntgen (DICOM)'],
  ['scan3d', 'Intraorális 3D szkennelés (STL / PLY)'],
  ['foto_io', 'Intraorális fotó'],
  ['foto_eo', 'Arc- és mosolyfotó (extraorális)'],
  ['lelet', 'Lelet, szakorvosi vélemény'],
  ['labor', 'Laborlelet'],
  ['beutalo', 'Beutaló'],
  ['terv', 'Kezelési terv, árajánlat'],
  ['nyilatkozat', 'Beleegyező nyilatkozat'],
  ['fogtech', 'Fogtechnikai munkalap, megrendelő'],
  ['egyeb', 'Egyéb dokumentum'],
]
export const XRAY_TYPES = ['opg', 'rtg_pa', 'rtg_bw']
export const ATT_ACCEPT = 'image/*,.pdf,.stl,.ply,.obj,.dcm,.dicom,.zip,.doc,.docx,.txt'
export const docTypeName = (k: string) => (DOC_TYPES.find(d => d[0] === k) || [k, k])[1]
export function guessDocType(name: string, sel: string) {
  const ext = (name.split('.').pop() || '').toLowerCase()
  if (['stl', 'ply', 'obj'].includes(ext)) return 'scan3d'
  if (['dcm', 'dicom'].includes(ext)) return 'cbct'
  return sel
}

/** a fogtérkép jelmagyarázata: állapotok színe */
export const STATUS_STYLE: Record<string, { color: string; label: string }> = {
  ep: { color: '#e9eef2', label: 'ép' },
  szuvas: { color: '#f5891f', label: 'szuvas' },
  tomott: { color: '#2a8ccc', label: 'tömött' },
  gyokerkezelt: { color: '#8b4fe0', label: 'gyökérkezelt' },
  korona: { color: '#f5b31f', label: 'korona' },
  hidtag: { color: '#f5b31f', label: 'hídtag' },
  implantatum: { color: '#13b0a5', label: 'implantátum' },
  hianyzik: { color: '#64748b', label: 'hiányzik' },
  gyokermaradvany: { color: '#c08457', label: 'gyökérmaradvány' },
}
