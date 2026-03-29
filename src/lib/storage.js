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

export function exportCSV(responses) {
  if (!responses.length) return alert('Aucune réponse à exporter.')
  const JOURS = ['lun','mar','mer','jeu','ven']
  const h = ['Nom','Prénom','Email','Filières','Matières','H/sem','Campus (priorité 1)',
    'Lun M','Lun APM','Mar M','Mar APM','Mer M','Mer APM','Jeu M','Jeu APM','Ven M','Ven APM',
    'Classes','Taux réussite cibles','Moyennes actuelles','Remarques','Soumis le']
  const q = v => `"${String(v ?? '').replace(/"/g,'""')}"`
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
  ].map(q).join(','))
  const csv = '\ufeff' + [h.map(q).join(','), ...rows].join('\r\n')
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),
    download: `voeux_profs_${new Date().getFullYear()}.csv`
  })
  a.click()
}
