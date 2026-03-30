import { createClient } from '@supabase/supabase-js'

// ── CONFIG ─────────────────────────────────────────────────────────
const STORAGE_KEY = 'aurlom_planning_2026'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY
const useSupabase  = !!(supabaseUrl && supabaseKey)

const supabase = useSupabase
  ? createClient(supabaseUrl, supabaseKey)
  : null

// ── LOCAL FALLBACK ─────────────────────────────────────────────────
function localLoad() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}
function localSave(data) {
  const all = localLoad()
  const entry = { ...data, id: Date.now(), submittedAt: new Date().toISOString() }
  all.push(entry)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  return entry
}
function localDelete(id) {
  const all = localLoad().filter(r => r.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

// ── PUBLIC API ─────────────────────────────────────────────────────
export async function loadResponses() {
  if (!useSupabase) return localLoad()
  const { data, error } = await supabase
    .from('planning_responses')
    .select('*')
    .order('submitted_at', { ascending: false })
  if (error) { console.error('Supabase load error:', error); return localLoad() }
  return data.map(row => ({
    id:          row.id,
    submittedAt: row.submitted_at,
    nom:         row.nom,
    prenom:      row.prenom,
    email:       row.email,
    filieres:    row.filieres,
    matieres:    row.matieres,
    heuresHebdo: row.heures_hebdo,
    campus:      row.campus,
    dispo:       row.dispo,
    classes:     row.classes,
    remarques:   row.remarques,
  }))
}

export async function saveResponse(data) {
  if (!useSupabase) return localSave(data)
  const { data: row, error } = await supabase
    .from('planning_responses')
    .insert({
      nom:         data.nom,
      prenom:      data.prenom,
      email:       data.email,
      filieres:    data.filieres,
      matieres:    data.matieres,
      heures_hebdo: data.heuresHebdo,
      campus:      data.campus,
      dispo:       data.dispo,
      classes:     data.classes,
      remarques:   data.remarques,
    })
    .select()
    .single()
  if (error) {
    console.error('Supabase save error:', error)
    return localSave(data) // fallback
  }
  return row
}

export async function deleteResponse(id) {
  if (!useSupabase) return localDelete(id)
  const { error } = await supabase
    .from('planning_responses')
    .delete()
    .eq('id', id)
  if (error) { console.error('Supabase delete error:', error); localDelete(id) }
}

export function isSupabaseEnabled() {
  return useSupabase
}

export async function exportLocalJSON() {
  const local = localLoad()
  if (!local.length) return alert('Aucune donnée locale à exporter.')
  await navigator.clipboard.writeText(JSON.stringify(local, null, 2))
  alert(`✅ ${local.length} réponse(s) copiée(s) en JSON.\nColle-les dans "Importer JSON" sur le nouveau site.`)
}

export async function importJSONToSupabase(jsonText) {
  if (!useSupabase) return { ok: false, msg: 'Supabase non configuré sur ce site.' }
  let records
  try { records = JSON.parse(jsonText) }
  catch { return { ok: false, msg: 'JSON invalide.' } }
  if (!Array.isArray(records) || !records.length) return { ok: false, msg: 'Aucune donnée à importer.' }
  let success = 0
  for (const r of records) {
    const { error } = await supabase.from('planning_responses').insert({
      nom: r.nom, prenom: r.prenom, email: r.email,
      filieres: r.filieres, matieres: r.matieres,
      heures_hebdo: r.heuresHebdo, campus: r.campus,
      dispo: r.dispo, classes: r.classes, remarques: r.remarques,
    })
    if (!error) success++
  }
  return { ok: true, msg: `✅ ${success}/${records.length} réponse(s) importée(s) dans Supabase.` }
}

export async function copyToSheets(responses) {
  if (!responses.length) return alert('Aucune réponse à exporter.')
  const JOURS = ['lun','mar','mer','jeu','ven']
  const h = ['Nom','Prénom','Email','Filières','Matières','H/sem','Campus (priorité 1)',
    'Lun M','Lun APM','Mar M','Mar APM','Mer M','Mer APM','Jeu M','Jeu APM','Ven M','Ven APM',
    'Classes','Taux réussite cibles','Moyennes actuelles','Remarques','Soumis le']
  const rows = responses.map(r => [
    r.nom, r.prenom, r.email,
    (r.filieres||[]).join(' | '),
    (r.matieres||[]).join(' | '),
    r.heuresHebdo,
    (r.campus||[])[0] || '',
    ...JOURS.flatMap(d => [r.dispo?.[d]?.matin||'', r.dispo?.[d]?.apm||'']),
    (r.classes||[]).map(c=>c.nom).join(' | '),
    (r.classes||[]).map(c=>c.taux).join(' | '),
    (r.classes||[]).map(c=>c.moy).join(' | '),
    r.remarques || '',
    r.submittedAt ? new Date(r.submittedAt).toLocaleString('fr-FR') : '',
  ])
  const tsv = [h, ...rows].map(row => row.join('\t')).join('\r\n')
  await navigator.clipboard.writeText(tsv)
  alert('✅ Données copiées ! Ouvre Google Sheets et colle avec Ctrl+V.')
}
