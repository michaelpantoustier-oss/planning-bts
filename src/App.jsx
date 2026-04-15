import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { MATIERES, FILIERES_ORDER, CAMPUS_OPTIONS } from './data/matieres.js'
import {
  loadResponses, saveResponse, deleteResponse, copyToSheets, isSupabaseEnabled, exportLocalJSON, importJSONToSupabase
} from './lib/storage.js'

// ── PALETTE ──────────────────────────────────────────────────────
const C = {
  bg: '#07060B', bg2: '#110F1A', bg3: '#1A1726',
  border: '#2A2440', violet: '#C57AFF', violetD: '#902EDB',
  violetDim: '#3D1F6E', text: '#F0ECF8', textDim: '#9589B0',
  green: '#4AE89A', orange: '#FF9B4A', red: '#FF5C7A', blue: '#4AC8FF',
}

// ── CONFIG ────────────────────────────────────────────────────────
const ADMIN_PWD    = 'aurlom2025'
const TOTAL_STEPS  = 5
const JOURS        = ['lun','mar','mer','jeu','ven']
const JOURS_LABELS = ['Lun.','Mar.','Mer.','Jeu.','Ven.']
const SLOTS        = ['matin','apm']
const SLOT_LABELS  = ['🌅 Matin','🌇 Après-midi']
const DISPO_CYCLE  = ['dispo','demi','indispo']
const DISPO_ICON   = { dispo:'✓', demi:'⚡', indispo:'✗' }
const DISPO_STYLE  = {
  dispo:   { bg:'rgba(74,232,154,.13)', border:'rgba(74,232,154,.35)', color:'#4AE89A' },
  demi:    { bg:'rgba(255,155,74,.13)', border:'rgba(255,155,74,.35)', color:'#FF9B4A' },
  indispo: { bg:'rgba(255,92,122,.08)', border:'rgba(255,92,122,.18)', color:'rgba(255,92,122,.5)' },
}

function initDispo() {
  return Object.fromEntries(JOURS.map(d => [d, { matin:'dispo', apm:'dispo' }]))
}
const INIT_FORM = {
  nom:'', prenom:'', email:'',
  filieres:[], matieres:[], autresFilieres:'',
  heuresHebdo:18, tauxHoraire:'', campus:[],
  dispo: initDispo(),
  classes:[], remarques:'',
}

// ── SHARED UI ─────────────────────────────────────────────────────
function Btn({ children, onClick, variant='primary', style={}, disabled=false, type='button' }) {
  const base = {
    padding:'.72rem 1.5rem', borderRadius:'11px', fontSize:'.88rem', fontWeight:700,
    cursor: disabled ? 'not-allowed' : 'pointer', border:'none', transition:'opacity .18s',
    opacity: disabled ? .45 : 1, ...style,
  }
  const vars = {
    primary:   { background:`linear-gradient(135deg,${C.violetD},${C.violet})`, color:'#fff' },
    secondary: { background:'transparent', border:`1px solid ${C.border}`, color:C.textDim },
    ghost:     { background:C.bg3, color:C.text, border:`1px solid ${C.border}` },
    danger:    { background:'rgba(255,92,122,.15)', color:C.red, border:`1px solid rgba(255,92,122,.3)` },
    green:     { background:'rgba(74,232,154,.15)', color:C.green, border:`1px solid rgba(74,232,154,.3)` },
  }
  return <button type={type} onClick={onClick} disabled={disabled} style={{...base,...vars[variant]}}>{children}</button>
}

function Card({ children, style={} }) {
  return <div style={{ background:C.bg2, border:`1px solid ${C.border}`, borderRadius:18, overflow:'hidden', ...style }}>{children}</div>
}

function Field({ label, children, hint, error }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {label && <label style={{ fontSize:'.75rem', fontWeight:700, color:C.textDim, textTransform:'uppercase', letterSpacing:'.04em' }}>{label}</label>}
      {children}
      {hint  && <span style={{ fontSize:'.72rem', color:C.textDim }}>{hint}</span>}
      {error && <span style={{ fontSize:'.72rem', color:C.red }}>{error}</span>}
    </div>
  )
}

function Input({ value, onChange, placeholder='', type='text', min, max }) {
  return (
    <input
      type={type} value={value} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder} min={min} max={max}
      style={{ background:C.bg3, border:`1px solid ${C.border}`, borderRadius:10, padding:'.65rem .9rem',
        color:C.text, fontSize:'.9rem', outline:'none', width:'100%',
        transition:'border-color .2s' }}
      onFocus={e=>e.target.style.borderColor=C.violet}
      onBlur={e=>e.target.style.borderColor=C.border}
    />
  )
}

function Badge({ children, color }) {
  return (
    <span style={{ display:'inline-block', padding:'.18rem .55rem', borderRadius:6,
      fontSize:'.7rem', fontWeight:700,
      background:`${color}22`, color, marginRight:4, marginBottom:2 }}>
      {children}
    </span>
  )
}

// ── PROGRESS BAR ─────────────────────────────────────────────────
const STEP_LABELS = ['Identité','Filières & matières','Volume & campus','Disponibilités','Objectifs']

function ProgressBar({ step }) {
  return (
    <div style={{ padding:'1rem 1.75rem', borderBottom:`1px solid ${C.border}`,
      display:'flex', alignItems:'center', gap:8, overflowX:'auto' }}>
      {STEP_LABELS.map((label, i) => {
        const n = i + 1
        const done   = n < step
        const active = n === step
        return (
          <React.Fragment key={n}>
            {i > 0 && <div style={{ flex:1, minWidth:16, height:1, background:C.border }} />}
            <div style={{ display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
              <div style={{
                width:24, height:24, borderRadius:'50%', flexShrink:0,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'.7rem', fontWeight:700,
                background: done ? C.violet : active ? C.violetDim : C.bg3,
                color:       done ? '#fff'  : active ? C.violet    : C.textDim,
                border:      active ? `2px solid ${C.violet}` : 'none',
              }}>
                {done ? '✓' : n}
              </div>
              <span style={{ fontSize:'.74rem', fontWeight:600,
                color: active ? C.violet : C.textDim }}>
                {label}
              </span>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ── STEP 1 — IDENTITÉ ─────────────────────────────────────────────
function Step1({ data, set, errors }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Field label="Nom" error={errors.nom}>
          <Input value={data.nom} onChange={v=>set('nom',v)} placeholder="Dupont" />
        </Field>
        <Field label="Prénom" error={errors.prenom}>
          <Input value={data.prenom} onChange={v=>set('prenom',v)} placeholder="Marie" />
        </Field>
      </div>
      <Field label="Adresse e-mail professionnelle" error={errors.email}>
        <Input value={data.email} onChange={v=>set('email',v)} placeholder="m.dupont@aurlom.fr" type="email" />
      </Field>
    </div>
  )
}

// ── STEP 2 — FILIÈRES & MATIÈRES ─────────────────────────────────
function Step2({ data, set, errors }) {
  function toggleFiliere(key) {
    const next = data.filieres.includes(key)
      ? data.filieres.filter(f=>f!==key)
      : [...data.filieres, key]
    // Remove matieres that no longer belong to any selected filière
    const allowed = new Set(next.flatMap(f => MATIERES[f]?.items || []))
    set('filieres', next)
    set('matieres', data.matieres.filter(m => allowed.has(m)))
  }
  function toggleMatiere(name) {
    set('matieres', data.matieres.includes(name)
      ? data.matieres.filter(m=>m!==name)
      : [...data.matieres, name])
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:22 }}>
      {/* Filières */}
      <div>
        <div style={{ fontSize:'.78rem', fontWeight:700, color:C.textDim, textTransform:'uppercase',
          letterSpacing:'.04em', marginBottom:10 }}>
          Filières souhaitées l'an prochain
        </div>
        {errors.filieres && <p style={{ fontSize:'.78rem', color:C.red, marginBottom:8 }}>{errors.filieres}</p>}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(215px,1fr))', gap:8 }}>
          {FILIERES_ORDER.map(key => {
            const f = MATIERES[key]
            const sel = data.filieres.includes(key)
            return (
              <div key={key} onClick={()=>toggleFiliere(key)} style={{
                border:`2px solid ${sel ? f.color : C.border}`,
                borderRadius:12, padding:'10px 14px', cursor:'pointer',
                background: sel ? `${f.color}0F` : 'transparent',
                display:'flex', alignItems:'center', gap:10, transition:'all .15s',
              }}>
                <div style={{
                  width:20, height:20, borderRadius:6, flexShrink:0,
                  border:`2px solid ${sel ? f.color : C.border}`,
                  background: sel ? f.color : 'transparent',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'.7rem', color:'#fff', transition:'all .15s',
                }}>
                  {sel && '✓'}
                </div>
                <div>
                  <div style={{ fontSize:'.86rem', fontWeight:600 }}>{f.label}</div>
                  <div style={{ fontSize:'.72rem', color:C.textDim }}>{f.code} · {f.ref}</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Champ libre autres filières */}
        <div style={{ marginTop:12 }}>
          <div style={{ fontSize:'.75rem', fontWeight:700, color:C.textDim, textTransform:'uppercase',
            letterSpacing:'.04em', marginBottom:6 }}>
            Filière sur d'autres campus
          </div>
          <textarea
            value={data.autresFilieres || ''}
            onChange={e=>set('autresFilieres', e.target.value)}
            placeholder="Ex : BTS MCO, BTS NDRC, BTS SIO, BTS CG, BTS Communication, BTS SP3S, BTS Tourisme, BTS Audiovisuel…"
            rows={2}
            style={{ width:'100%', background:C.bg3, border:`1px solid ${C.border}`, borderRadius:10,
              padding:'.6rem .8rem', color:C.text, fontSize:'.84rem', resize:'vertical',
              outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}
            onFocus={e=>e.target.style.borderColor=C.violet}
            onBlur={e=>e.target.style.borderColor=C.border}
          />
        </div>
      </div>

      {/* Matières dynamiques */}
      {data.filieres.length > 0 && (
        <div>
          <div style={{ fontSize:'.78rem', fontWeight:700, color:C.textDim, textTransform:'uppercase',
            letterSpacing:'.04em', marginBottom:10 }}>
            Matières à enseigner
          </div>
          {errors.matieres && <p style={{ fontSize:'.78rem', color:C.red, marginBottom:8 }}>{errors.matieres}</p>}
          {FILIERES_ORDER.filter(k => data.filieres.includes(k)).map(key => {
            const f = MATIERES[key]
            return (
              <div key={key} style={{ marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px',
                  background:C.bg3, borderRadius:9, border:`1px solid ${C.border}`, marginBottom:8 }}>
                  <div style={{ width:9, height:9, borderRadius:'50%', background:f.color, flexShrink:0 }} />
                  <span style={{ fontSize:'.83rem', fontWeight:700 }}>{f.label}</span>
                  <span style={{ fontSize:'.72rem', color:C.textDim, marginLeft:'auto' }}>
                    {data.matieres.filter(m=>f.items.includes(m)).length} / {f.items.length} sélectionnées
                  </span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:5 }}>
                  {f.items.map(name => {
                    const checked = data.matieres.includes(name)
                    return (
                      <div key={name} onClick={()=>toggleMatiere(name)} style={{
                        display:'flex', alignItems:'center', gap:8,
                        border:`1px solid ${checked ? C.violet : C.border}`,
                        borderRadius:9, padding:'6px 10px', cursor:'pointer',
                        background: checked ? `${C.violet}0C` : 'transparent',
                        transition:'all .13s',
                      }}>
                        <div style={{
                          width:15, height:15, borderRadius:4, flexShrink:0,
                          border:`2px solid ${checked ? C.violet : C.border}`,
                          background: checked ? C.violet : 'transparent',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:'.6rem', color:'#fff',
                        }}>
                          {checked && '✓'}
                        </div>
                        <span style={{ fontSize:'.81rem', fontWeight:500 }}>{name}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {data.filieres.length === 0 && (
        <div style={{ padding:'1.5rem', textAlign:'center', border:`1px dashed ${C.border}`,
          borderRadius:12, fontSize:'.85rem', color:C.textDim }}>
          Sélectionnez au moins une filière pour voir les matières
        </div>
      )}
    </div>
  )
}

// ── STEP 3 — VOLUME & CAMPUS ─────────────────────────────────────
function Step3({ data, set, errors }) {
  function toggleCampus(name) {
    set('campus', data.campus.includes(name)
      ? data.campus.filter(c=>c!==name)
      : [...data.campus, name])
  }
  function moveCampus(i, dir) {
    const arr = [...data.campus]
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    set('campus', arr)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:22 }}>
      {/* Volume hebdo */}
      <div>
        <div style={{ fontSize:'.78rem', fontWeight:700, color:C.textDim, textTransform:'uppercase',
          letterSpacing:'.04em', marginBottom:12 }}>
          Volume d'enseignement souhaité
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div style={{ background:C.bg3, border:`1px solid ${C.border}`, borderRadius:13, padding:'1rem 1.1rem' }}>
            <div style={{ fontSize:'.73rem', fontWeight:700, color:C.textDim, textTransform:'uppercase', marginBottom:8 }}>
              Heures de cours / semaine
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <input
                type="number" value={data.heuresHebdo} min={1} max={40}
                onChange={e=>set('heuresHebdo', +e.target.value)}
                style={{ width:70, background:C.bg2, border:`1px solid ${C.border}`, borderRadius:8,
                  padding:'.5rem .6rem', color:C.text, fontSize:'1.2rem', fontWeight:700,
                  textAlign:'center', outline:'none' }}
                onFocus={e=>e.target.style.borderColor=C.violet}
                onBlur={e=>e.target.style.borderColor=C.border}
              />
              <span style={{ fontSize:'.85rem', color:C.textDim }}>h / semaine</span>
            </div>
            <div style={{ fontSize:'.72rem', color:C.textDim, marginTop:6 }}>Face-à-face pédagogique</div>
          </div>

          {/* Taux horaire */}
          <div style={{ background:C.bg3, border:`1px solid ${errors.tauxHoraire ? C.red : C.border}`, borderRadius:13, padding:'1rem 1.1rem' }}>
            <div style={{ fontSize:'.73rem', fontWeight:700, color:C.textDim, textTransform:'uppercase', marginBottom:8 }}>
              Taux horaire 2024/25 <span style={{ color:C.red }}>*</span>
            </div>
            {errors.tauxHoraire && <p style={{ fontSize:'.78rem', color:C.red, margin:'0 0 6px' }}>{errors.tauxHoraire}</p>}
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <input
                type="number" value={data.tauxHoraire} min={0}
                onChange={e=>set('tauxHoraire', +e.target.value)}
                style={{ width:80, background:C.bg2, border:`1px solid ${C.border}`, borderRadius:8,
                  padding:'.5rem .6rem', color:C.text, fontSize:'1.2rem', fontWeight:700,
                  textAlign:'center', outline:'none' }}
                onFocus={e=>e.target.style.borderColor=C.violet}
                onBlur={e=>e.target.style.borderColor=C.border}
              />
              <span style={{ fontSize:'.85rem', color:C.textDim }}>€ / h</span>
            </div>
          </div>

          {/* Matière principale */}
          <div style={{ background:C.bg3, border:`1px solid ${C.border}`, borderRadius:13, padding:'1rem 1.1rem' }}>
            <div style={{ fontSize:'.73rem', fontWeight:700, color:C.textDim, textTransform:'uppercase', marginBottom:8 }}>
              Discipline principale
            </div>
            <select
              value={data.matierePrincipale || ''}
              onChange={e=>set('matierePrincipale', e.target.value)}
              style={{ width:'100%', background:C.bg2, border:`1px solid ${C.border}`, borderRadius:8,
                padding:'.5rem .7rem', color: data.matierePrincipale ? C.text : C.textDim,
                fontSize:'.85rem', outline:'none' }}
            >
              <option value="">— Choisir —</option>
              {data.matieres.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <div style={{ fontSize:'.72rem', color:C.textDim, marginTop:6 }}>Parmi vos matières cochées</div>
          </div>
        </div>
      </div>

      {/* Campus */}
      <div>
        <div style={{ fontSize:'.78rem', fontWeight:700, color:C.textDim, textTransform:'uppercase',
          letterSpacing:'.04em', marginBottom:6 }}>
          Campus d'intervention
        </div>
        <p style={{ fontSize:'.82rem', color:C.textDim, marginBottom:12 }}>
          Cochez les campus où vous intervenez, puis ordonnez-les du plus prioritaire au moins prioritaire.
        </p>
        {errors.campus && <p style={{ fontSize:'.78rem', color:C.red, marginBottom:8 }}>{errors.campus}</p>}

        {/* Checkboxes */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:14 }}>
          {CAMPUS_OPTIONS.map(name => {
            const sel = data.campus.includes(name)
            return (
              <div key={name} onClick={()=>toggleCampus(name)} style={{
                padding:'6px 14px', borderRadius:99,
                border:`1px solid ${sel ? C.violet : C.border}`,
                background: sel ? `${C.violet}18` : C.bg3,
                color: sel ? C.violet : C.textDim,
                fontSize:'.82rem', fontWeight:600, cursor:'pointer', transition:'all .15s',
              }}>
                {sel && '✓ '}{name}
              </div>
            )
          })}
        </div>

        {/* Ordered list */}
        {data.campus.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <div style={{ fontSize:'.73rem', color:C.textDim, marginBottom:2 }}>Ordre de priorité :</div>
            {data.campus.map((name, i) => (
              <div key={name} style={{ display:'flex', alignItems:'center', gap:10,
                background:C.bg3, border:`1px solid ${C.border}`, borderRadius:10,
                padding:'.6rem .9rem' }}>
                <div style={{ width:26, height:26, borderRadius:8, background:C.violetDim,
                  color:C.violet, fontWeight:700, fontSize:'.82rem',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {i+1}
                </div>
                <span style={{ flex:1, fontSize:'.88rem', fontWeight:500 }}>{name}</span>
                <div style={{ display:'flex', gap:4 }}>
                  <button onClick={()=>moveCampus(i,-1)} disabled={i===0}
                    style={{ background:'transparent', border:'none', color: i===0?C.border:C.textDim,
                      cursor: i===0?'default':'pointer', fontSize:'.85rem', padding:'2px 5px' }}>▲</button>
                  <button onClick={()=>moveCampus(i,1)} disabled={i===data.campus.length-1}
                    style={{ background:'transparent', border:'none',
                      color: i===data.campus.length-1?C.border:C.textDim,
                      cursor: i===data.campus.length-1?'default':'pointer', fontSize:'.85rem', padding:'2px 5px' }}>▼</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── STEP 4 — DISPONIBILITÉS ───────────────────────────────────────
function Step4({ data, set }) {
  function toggle(jour, slot) {
    const cur = data.dispo[jour][slot]
    const next = DISPO_CYCLE[(DISPO_CYCLE.indexOf(cur) + 1) % 3]
    set('dispo', { ...data.dispo, [jour]: { ...data.dispo[jour], [slot]: next } })
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <p style={{ fontSize:'.83rem', color:C.textDim }}>
        Cliquez sur chaque créneau pour basculer entre{' '}
        <span style={{ color:C.green, fontWeight:600 }}>Disponible</span>,{' '}
        <span style={{ color:C.orange, fontWeight:600 }}>Sur demande</span> et{' '}
        <span style={{ color:'rgba(255,92,122,.7)', fontWeight:600 }}>Indisponible</span>.
      </p>

      <div style={{ border:`1px solid ${C.border}`, borderRadius:13, overflow:'hidden' }}>
        {/* Header */}
        <div style={{ display:'grid', gridTemplateColumns:'110px repeat(5,1fr)',
          background:C.bg3, borderBottom:`1px solid ${C.border}` }}>
          <div style={{ padding:'.6rem .8rem', fontSize:'.72rem', fontWeight:700, color:C.textDim }} />
          {JOURS_LABELS.map(l => (
            <div key={l} style={{ padding:'.6rem .3rem', textAlign:'center',
              fontSize:'.72rem', fontWeight:700, color:C.textDim, textTransform:'uppercase' }}>
              {l}
            </div>
          ))}
        </div>

        {/* Rows */}
        {SLOTS.map((slot, si) => (
          <div key={slot} style={{ display:'grid', gridTemplateColumns:'110px repeat(5,1fr)',
            borderBottom: si === 0 ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ padding:'.7rem .8rem', fontSize:'.8rem', fontWeight:600,
              borderRight:`1px solid ${C.border}`, display:'flex', alignItems:'center' }}>
              {SLOT_LABELS[si]}
            </div>
            {JOURS.map(jour => {
              const state = data.dispo[jour][slot]
              const ds = DISPO_STYLE[state]
              return (
                <div key={jour} style={{ padding:'.35rem .25rem', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <button onClick={()=>toggle(jour, slot)} style={{
                    width:'100%', padding:'.35rem .2rem', borderRadius:8,
                    background:ds.bg, border:`1px solid ${ds.border}`, color:ds.color,
                    fontSize:'.72rem', fontWeight:700, cursor:'pointer', transition:'all .13s',
                  }}>
                    {DISPO_ICON[state]}
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Légende */}
      <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
        {[['dispo',C.green,'Disponible'],['demi',C.orange,'Sur demande'],['indispo','rgba(255,92,122,.6)','Indisponible']].map(([k,color,label]) => (
          <div key={k} style={{ display:'flex', alignItems:'center', gap:6, fontSize:'.75rem', color }}>
            <span style={{ display:'inline-block', width:10, height:10,
              background:DISPO_STYLE[k].bg, border:`1px solid ${DISPO_STYLE[k].border}`, borderRadius:3 }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── STEP 5 — OBJECTIFS ────────────────────────────────────────────
function Step5({ data, set }) {
  function addClasse() {
    set('classes', [...data.classes, { nom:'', taux:'', moy:'' }])
  }
  function removeClasse(i) {
    set('classes', data.classes.filter((_,j)=>j!==i))
  }
  function updateClasse(i, field, val) {
    const next = [...data.classes]
    next[i] = { ...next[i], [field]: val }
    set('classes', next)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div>
        <div style={{ fontSize:'.78rem', fontWeight:700, color:C.textDim, textTransform:'uppercase',
          letterSpacing:'.04em', marginBottom:8 }}>
          Classes actuelles — objectifs pédagogiques
        </div>
        <p style={{ fontSize:'.82rem', color:C.textDim, marginBottom:14 }}>
          Pour chaque classe dont vous avez la charge cette année.
        </p>

        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {data.classes.map((cl, i) => (
            <div key={i} style={{ background:C.bg3, border:`1px solid ${C.border}`,
              borderRadius:12, padding:'1rem 1.1rem',
              display:'grid', gridTemplateColumns:'1fr 120px 120px 36px', gap:10, alignItems:'end' }}>
              <Field label={i===0?'Nom de la classe':undefined}>
                <Input value={cl.nom} onChange={v=>updateClasse(i,'nom',v)} placeholder="ex : BTS BM 1ère année" />
              </Field>
              <Field label={i===0?'Taux réussite cible':undefined}>
                <Input value={cl.taux} onChange={v=>updateClasse(i,'taux',v)} placeholder="85 %" />
              </Field>
              <Field label={i===0?'Moyenne actuelle':undefined}>
                <Input value={cl.moy} onChange={v=>updateClasse(i,'moy',v)} placeholder="12,4 / 20" />
              </Field>
              <button onClick={()=>removeClasse(i)} style={{
                background:'rgba(255,92,122,.1)', border:'1px solid rgba(255,92,122,.2)',
                borderRadius:8, color:C.red, cursor:'pointer', height:38, fontSize:'.85rem',
                alignSelf:'flex-end',
              }}>✕</button>
            </div>
          ))}
        </div>

        <button onClick={addClasse} style={{ marginTop:10, background:C.bg3,
          border:`1px dashed ${C.border}`, borderRadius:10, padding:'.6rem 1rem',
          color:C.textDim, fontSize:'.83rem', cursor:'pointer', width:'100%',
          transition:'all .15s' }}
          onMouseOver={e=>{e.target.style.borderColor=C.violet;e.target.style.color=C.violet}}
          onMouseOut={e=>{e.target.style.borderColor=C.border;e.target.style.color=C.textDim}}>
          + Ajouter une classe
        </button>
      </div>

      <Field label="Remarques libres (facultatif)">
        <textarea
          value={data.remarques} onChange={e=>set('remarques',e.target.value)}
          rows={4} placeholder="Contraintes particulières, souhaits de collaboration, observations…"
          style={{ background:C.bg3, border:`1px solid ${C.border}`, borderRadius:10,
            padding:'.65rem .9rem', color:C.text, fontSize:'.88rem', resize:'vertical',
            outline:'none', width:'100%', lineHeight:1.6 }}
          onFocus={e=>e.target.style.borderColor=C.violet}
          onBlur={e=>e.target.style.borderColor=C.border}
        />
      </Field>
    </div>
  )
}

// ── FORM WRAPPER ──────────────────────────────────────────────────
function ProfForm({ onComplete }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(INIT_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function validate() {
    const e = {}
    if (step === 1) {
      if (!form.nom.trim())    e.nom    = 'Le nom est requis'
      if (!form.prenom.trim()) e.prenom = 'Le prénom est requis'
      if (!form.email.trim() || !form.email.includes('@')) e.email = 'Email invalide'
    }
    if (step === 2) {
      if (!form.filieres.length) e.filieres = 'Sélectionnez au moins une filière'
      if (!form.matieres.length) e.matieres  = 'Sélectionnez au moins une matière'
    }
    if (step === 3) {
      if (!form.campus.length) e.campus = 'Sélectionnez au moins un campus'
      if (!form.tauxHoraire)   e.tauxHoraire = 'Le taux horaire est requis'
    }
    setErrors(e)
    return !Object.keys(e).length
  }

  async function next() {
    if (!validate()) return
    if (step < TOTAL_STEPS) { setStep(s => s + 1); return }
    setSubmitting(true)
    try {
      await saveResponse(form)
      fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }).catch(() => {})
      onComplete(form)
    } catch(err) {
      console.error('Erreur lors de la sauvegarde:', err)
      alert('Erreur de sauvegarde. Vos données ont été conservées localement.')
      onComplete(form)
    } finally {
      setSubmitting(false)
    }
  }

  const stepProps = { data: form, set: setField, errors }

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:C.bg }}>
      {/* Header */}
      <div style={{ padding:'1.25rem 2rem', borderBottom:`1px solid ${C.border}`,
        display:'flex', alignItems:'center', gap:12,
        background:`linear-gradient(135deg,rgba(144,46,219,.15) 0%,transparent 100%)` }}>
        <div style={{ width:42, height:42, borderRadius:11, background:C.violetDim,
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem', flexShrink:0 }}>
          📋
        </div>
        <div>
          <div style={{ fontWeight:700, fontSize:'1.05rem' }}>Vœux d'enseignement 2025–2026</div>
          <div style={{ fontSize:'.78rem', color:C.textDim }}>Aurlom Éducation · À remplir avant le 30 avril 2025</div>
        </div>
      </div>

      <ProgressBar step={step} />

      {/* Résumé étape 1 si step > 1 */}
      {step > 1 && (
        <div style={{ padding:'.75rem 1.75rem', borderBottom:`1px solid ${C.border}`,
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
          background:C.bg3 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:'50%', background:C.violetDim,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontWeight:700, color:C.violet, fontSize:'.85rem', flexShrink:0 }}>
              {form.prenom[0]}{form.nom[0]}
            </div>
            <div>
              <div style={{ fontWeight:600, fontSize:'.88rem' }}>{form.prenom} {form.nom}</div>
              <div style={{ fontSize:'.75rem', color:C.textDim }}>{form.email}</div>
            </div>
          </div>
          <button onClick={()=>setStep(1)} style={{ background:'transparent',
            border:`1px solid ${C.border}`, borderRadius:8, padding:'.25rem .65rem',
            color:C.textDim, fontSize:'.73rem', cursor:'pointer' }}>
            Modifier
          </button>
        </div>
      )}

      {/* Body */}
      <div style={{ flex:1, padding:'1.75rem', maxWidth:780, width:'100%', margin:'0 auto', alignSelf:'stretch' }}>
        <div style={{ marginBottom:10, fontSize:'.75rem', fontWeight:700, color:C.textDim,
          textTransform:'uppercase', letterSpacing:'.04em' }}>
          Étape {step} / {TOTAL_STEPS} — {STEP_LABELS[step-1]}
        </div>
        {step === 1 && <Step1 {...stepProps} />}
        {step === 2 && <Step2 {...stepProps} />}
        {step === 3 && <Step3 {...stepProps} />}
        {step === 4 && <Step4 {...stepProps} />}
        {step === 5 && <Step5 {...stepProps} />}
      </div>

      {/* Footer */}
      <div style={{ padding:'1.25rem 1.75rem', borderTop:`1px solid ${C.border}`,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        background:C.bg2, position:'sticky', bottom:0 }}>
        <Btn variant="secondary" onClick={()=>setStep(s=>s-1)} style={{ visibility: step===1?'hidden':'visible' }}>
          ← Précédent
        </Btn>
        <span style={{ fontSize:'.78rem', color:C.textDim }}>{step} / {TOTAL_STEPS}</span>
        <Btn onClick={next} disabled={submitting}>
          {submitting ? '⏳ Envoi en cours…' : step < TOTAL_STEPS ? 'Étape suivante →' : '✓ Envoyer mes vœux'}
        </Btn>
      </div>
    </div>
  )
}

// ── CONFIRMATION ──────────────────────────────────────────────────
function Confirmation({ data, onNew }) {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      padding:'2rem', background:C.bg }}>
      <div style={{ textAlign:'center', maxWidth:480 }}>
        <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>✅</div>
        <h2 style={{ fontSize:'1.4rem', fontWeight:800, marginBottom:'.6rem', color:C.green }}>
          Vœux enregistrés — merci !
        </h2>
        <p style={{ color:C.textDim, fontSize:'.9rem', marginBottom:'1.5rem' }}>
          Vos vœux ont bien été enregistrés.
        </p>
        <div style={{ background:C.bg2, border:`1px solid ${C.border}`, borderRadius:14,
          padding:'1.25rem', marginBottom:'1.5rem', textAlign:'left' }}>
          <div style={{ fontSize:'.78rem', fontWeight:700, color:C.textDim,
            textTransform:'uppercase', marginBottom:'.75rem' }}>Récapitulatif</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <div style={{ fontSize:'.85rem' }}>👤 <strong>{data.prenom} {data.nom}</strong></div>
            <div style={{ fontSize:'.85rem' }}>
              📚 {data.filieres.map(k=>MATIERES[k]?.code).join(', ')}
            </div>
            <div style={{ fontSize:'.85rem' }}>⏱ {data.heuresHebdo}h / semaine</div>
            <div style={{ fontSize:'.85rem' }}>🏫 {data.campus[0]}{data.campus.length>1?` (+${data.campus.length-1})`:''}
            </div>
            <div style={{ fontSize:'.85rem', color:C.textDim }}>
              {data.matieres.length} matière{data.matieres.length>1?'s':''} sélectionnée{data.matieres.length>1?'s':''}
            </div>
          </div>
        </div>
        <Btn variant="secondary" onClick={onNew}>Soumettre un autre formulaire</Btn>
      </div>
    </div>
  )
}

// ── ADMIN LOGIN ───────────────────────────────────────────────────
function AdminLogin({ onAuth }) {
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState(false)
  function submit(e) {
    e.preventDefault()
    if (pwd === ADMIN_PWD) onAuth()
    else { setErr(true); setPwd('') }
  }
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      padding:'2rem', background:C.bg }}>
      <Card style={{ width:'100%', maxWidth:380 }}>
        <div style={{ padding:'2rem 2rem 0', textAlign:'center' }}>
          <div style={{ fontSize:'2rem', marginBottom:'.75rem' }}>🔒</div>
          <h2 style={{ fontSize:'1.2rem', fontWeight:700, marginBottom:'.4rem' }}>Accès administration</h2>
          <p style={{ fontSize:'.83rem', color:C.textDim }}>Aurlom Éducation — Planning BTS</p>
        </div>
        <form onSubmit={submit} style={{ padding:'1.5rem 2rem 2rem' }}>
          <Field label="Mot de passe" error={err ? 'Mot de passe incorrect' : undefined}>
            <input
              type="password" value={pwd} onChange={e=>{setPwd(e.target.value);setErr(false)}}
              placeholder="••••••••"
              style={{ background:C.bg3, border:`1px solid ${err?C.red:C.border}`, borderRadius:10,
                padding:'.65rem .9rem', color:C.text, fontSize:'.9rem', outline:'none', width:'100%' }}
              autoFocus
            />
          </Field>
          <Btn type="submit" style={{ width:'100%', marginTop:14 }}>Accéder au tableau de bord</Btn>
        </form>
      </Card>
    </div>
  )
}

// ── ADMIN DASHBOARD ───────────────────────────────────────────────
function AdminDashboard({ onLogout }) {
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('tous')
  const [search, setSearch] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try { setResponses(await loadResponses()) }
    catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function handleDelete(id) {
    if (!confirm('Supprimer cette réponse ?')) return
    await deleteResponse(id)
    setResponses(r => r.filter(x => x.id !== id))
  }

  const filtered = useMemo(() => {
    let r = responses
    if (filter !== 'tous') r = r.filter(x => x.filieres?.includes(filter))
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(x => `${x.nom} ${x.prenom} ${x.email}`.toLowerCase().includes(q))
    }
    return r
  }, [responses, filter, search])

  // Heatmap
  const heatmap = useMemo(() => {
    const counts = {}
    JOURS.forEach(d => {
      counts[d] = {}
      SLOTS.forEach(s => { counts[d][s] = 0 })
    })
    responses.forEach(r => {
      JOURS.forEach(d => SLOTS.forEach(s => {
        if (r.dispo?.[d]?.[s] === 'dispo') counts[d][s]++
      }))
    })
    return counts
  }, [responses])

  const total = responses.length
  const allFilieres = [...new Set(responses.flatMap(r=>r.filieres||[]))]

  return (
    <div style={{ minHeight:'100vh', background:C.bg }}>
      {/* Admin nav */}
      <div style={{ padding:'0 2rem', height:60, display:'flex', alignItems:'center',
        justifyContent:'space-between', borderBottom:`1px solid ${C.border}`,
        background:'rgba(7,6,11,.9)', position:'sticky', top:0, zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:.6+'rem' }}>
          <span style={{ fontSize:1+'rem' }}>🎓</span>
          <span style={{ color:C.violet, fontWeight:700 }}>Aurlom</span>
          <span style={{ fontWeight:700 }}> · Admin Planning BTS</span>
          <span style={{ fontSize:'.73rem', color:C.textDim, marginLeft:8,
            background:C.violetDim, padding:'2px 8px', borderRadius:4 }}>🔒</span>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Btn variant="ghost" onClick={refresh} style={{ padding:'.4rem .9rem', fontSize:'.8rem' }}>⟳ Actualiser</Btn>
          <Btn variant="green"  onClick={()=>copyToSheets(responses)} style={{ padding:'.4rem .9rem', fontSize:'.8rem' }}>📋 Copier pour Google Sheets</Btn>
          {!isSupabaseEnabled() && (
            <Btn variant="secondary" onClick={exportLocalJSON} style={{ padding:'.4rem .9rem', fontSize:'.8rem' }}>📤 Exporter JSON</Btn>
          )}
          {isSupabaseEnabled() && (
            <Btn variant="secondary" onClick={async()=>{
              const json = prompt('Colle le JSON exporté depuis l\'ancien site :')
              if (!json) return
              const r = await importJSONToSupabase(json)
              alert(r.msg)
              refresh()
            }} style={{ padding:'.4rem .9rem', fontSize:'.8rem' }}>📥 Importer JSON</Btn>
          )}
          <Btn variant="secondary" onClick={onLogout} style={{ padding:'.4rem .9rem', fontSize:'.8rem' }}>Déconnexion</Btn>
        </div>
      </div>

      <div style={{ maxWidth:1150, margin:'0 auto', padding:'2rem' }}>

        {/* Loading indicator */}
        {loading && (
          <div style={{ textAlign:'center', padding:'3rem', color:C.textDim }}>
            <div style={{ fontSize:'1.5rem', marginBottom:8 }}>⏳</div>
            Chargement des réponses{isSupabaseEnabled() ? ' depuis Supabase' : ''}…
          </div>
        )}

        {/* Stat cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:12, marginBottom:24 }}>
          {[
            { val: total,                               label:'Réponses reçues',    color:C.violet },
            { val: allFilieres.length,                  label:'Filières couvertes', color:C.blue   },
            { val: responses.filter(r=>r.campus?.length>1).length, label:'Multi-campus', color:C.orange },
            { val: total ? Math.round(responses.reduce((s,r)=>s+(+r.heuresHebdo||0),0)/total) : 0,
              label:'H/sem. moyen', color:C.green },
          ].map(({ val, label, color }) => (
            <div key={label} style={{ background:C.bg2, border:`1px solid ${C.border}`, borderRadius:14, padding:'1.1rem 1.25rem' }}>
              <div style={{ fontSize:'2rem', fontWeight:800, color }}>{val}</div>
              <div style={{ fontSize:'.78rem', color:C.textDim, marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Filters + search */}
        <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
          {['tous',...FILIERES_ORDER].map(k => {
            const label = k==='tous' ? `Tous (${total})` : (MATIERES[k]?.code || k)
            const count = k==='tous' ? total : responses.filter(r=>r.filieres?.includes(k)).length
            if (k !== 'tous' && count === 0) return null
            return (
              <button key={k} onClick={()=>setFilter(k)} style={{
                padding:'.32rem .8rem', borderRadius:99, fontSize:'.78rem', fontWeight:600,
                cursor:'pointer', border:`1px solid ${filter===k?C.violet:C.border}`,
                background: filter===k ? C.violetDim : C.bg3,
                color: filter===k ? C.violet : C.textDim,
              }}>
                {label}{k!=='tous' ? ` (${count})` : ''}
              </button>
            )
          })}
          <input
            value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Rechercher un nom…"
            style={{ marginLeft:'auto', background:C.bg3, border:`1px solid ${C.border}`,
              borderRadius:99, padding:'.32rem 1rem', color:C.text, fontSize:'.8rem',
              outline:'none', minWidth:180 }}
          />
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{ padding:'3rem', textAlign:'center', background:C.bg2,
            border:`1px solid ${C.border}`, borderRadius:16 }}>
            <div style={{ fontSize:'1.5rem', marginBottom:'.5rem' }}>📭</div>
            <div style={{ color:C.textDim, fontSize:'.9rem' }}>Aucune réponse{filter!=='tous'?' pour ce filtre':''}</div>
          </div>
        ) : (
          <div style={{ background:C.bg2, border:`1px solid ${C.border}`, borderRadius:16, overflow:'auto', marginBottom:24 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
              <thead>
                <tr style={{ background:C.bg3 }}>
                  {['Enseignant','Filières','Matières','H/sem','Taux horaire','Campus prioritaire','Lun','Mar','Mer','Jeu','Ven','Taux réussite',''].map(h => (
                    <th key={h} style={{ padding:'.7rem .9rem', textAlign:'left', fontSize:'.72rem',
                      fontWeight:700, color:C.textDim, textTransform:'uppercase',
                      borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} style={{ borderBottom:`1px solid ${C.border}` }}
                    onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,.02)'}
                    onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'.8rem .9rem' }}>
                      <div style={{ fontWeight:600, fontSize:'.87rem' }}>{r.prenom} {r.nom}</div>
                      <div style={{ fontSize:'.73rem', color:C.textDim }}>{r.email}</div>
                    </td>
                    <td style={{ padding:'.8rem .9rem' }}>
                      {(r.filieres||[]).map(k => (
                        <Badge key={k} color={MATIERES[k]?.color||C.textDim}>
                          {MATIERES[k]?.code||k}
                        </Badge>
                      ))}
                    </td>
                    <td style={{ padding:'.8rem .9rem', fontSize:'.77rem', color:C.textDim, maxWidth:160 }}>
                      {(r.matieres||[]).slice(0,3).join(', ')}{r.matieres?.length>3?` +${r.matieres.length-3}`:''}
                    </td>
                    <td style={{ padding:'.8rem .9rem', fontWeight:700, color:C.violet }}>
                      {r.heuresHebdo}h
                    </td>
                    <td style={{ padding:'.8rem .9rem', fontWeight:600, color:C.green }}>
                      {r.tauxHoraire ? `${r.tauxHoraire} €/h` : <span style={{ color:C.textDim }}>—</span>}
                    </td>
                    <td style={{ padding:'.8rem .9rem', fontSize:'.83rem' }}>
                      {(r.campus||[])[0] || <span style={{ color:C.textDim }}>—</span>}
                    </td>
                    {JOURS.map(jour => {
                      const m = r.dispo?.[jour]?.matin || 'indispo'
                      const a = r.dispo?.[jour]?.apm   || 'indispo'
                      const dot = (s) => (
                        <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%',
                          background: s==='dispo'?C.green : s==='demi'?C.orange : 'rgba(255,92,122,.35)',
                          margin:'0 1px' }} />
                      )
                      return (
                        <td key={jour} style={{ padding:'.8rem .6rem', textAlign:'center' }}>
                          <div title={`Matin: ${m}`}>{dot(m)}</div>
                          <div title={`APM: ${a}`}>{dot(a)}</div>
                        </td>
                      )
                    })}
                    <td style={{ padding:'.8rem .9rem', fontSize:'.8rem', color:C.textDim }}>
                      {(r.classes||[]).map(c=>c.taux).filter(Boolean).join(', ') || '—'}
                    </td>
                    <td style={{ padding:'.8rem .6rem' }}>
                      <button onClick={()=>handleDelete(r.id)}
                        style={{ background:'transparent', border:'none', color:'rgba(255,92,122,.4)',
                          cursor:'pointer', fontSize:'.85rem' }}
                        title="Supprimer">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Heatmap */}
        {total > 0 && (
          <div style={{ background:C.bg2, border:`1px solid ${C.border}`, borderRadius:16, padding:'1.5rem', marginBottom:24 }}>
            <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:'1.1rem' }}>
              Heatmap disponibilités —{' '}
              <span style={{ color:C.textDim, fontWeight:400, fontSize:'.85rem' }}>
                {total} réponse{total>1?'s':', 0'}
              </span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'90px repeat(5,1fr)', gap:6, alignItems:'center' }}>
              <div />
              {JOURS_LABELS.map(l => (
                <div key={l} style={{ textAlign:'center', fontSize:'.72rem', color:C.textDim, fontWeight:700 }}>{l}</div>
              ))}
              {SLOTS.map((slot, si) => (
                <React.Fragment key={slot}>
                  <div style={{ fontSize:'.78rem', color:C.textDim }}>{SLOT_LABELS[si]}</div>
                  {JOURS.map(jour => {
                    const n = heatmap[jour]?.[slot] || 0
                    const pct = total > 0 ? n / total : 0
                    const bg = pct >= .7 ? `rgba(74,232,154,${.2+pct*.4})`
                             : pct >= .4 ? `rgba(255,155,74,${.2+pct*.4})`
                             :             `rgba(255,92,122,${.1+pct*.3})`
                    return (
                      <div key={jour} style={{ background:bg, borderRadius:9, height:40,
                        display:'flex', flexDirection:'column', alignItems:'center',
                        justifyContent:'center', gap:2 }}>
                        <span style={{ fontSize:'.8rem', fontWeight:700 }}>{n}</span>
                        <span style={{ fontSize:'.6rem', color:C.textDim }}>{Math.round(pct*100)}%</span>
                      </div>
                    )
                  })}
                </React.Fragment>
              ))}
            </div>
            <div style={{ marginTop:10, fontSize:'.72rem', color:C.textDim }}>
              Nombre de profs disponibles / total des réponses
            </div>
          </div>
        )}

        {/* Matières synthèse */}
        {total > 0 && (
          <div style={{ background:C.bg2, border:`1px solid ${C.border}`, borderRadius:16, padding:'1.5rem' }}>
            <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:'1rem' }}>Synthèse des matières demandées</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {Object.entries(
                responses.flatMap(r=>r.matieres||[]).reduce((acc,m)=>({...acc,[m]:(acc[m]||0)+1}),{})
              ).sort((a,b)=>b[1]-a[1]).slice(0,30).map(([m,n]) => (
                <div key={m} style={{ background:C.bg3, border:`1px solid ${C.border}`,
                  borderRadius:99, padding:'4px 12px', fontSize:'.77rem',
                  display:'flex', alignItems:'center', gap:6 }}>
                  <span>{m}</span>
                  <span style={{ background:C.violetDim, color:C.violet, borderRadius:99,
                    padding:'1px 6px', fontSize:'.68rem', fontWeight:700 }}>{n}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── ACCUEIL ───────────────────────────────────────────────────────
function Accueil({ onProf, onAdmin }) {
  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', padding:'2rem', background:C.bg,
      backgroundImage:`radial-gradient(ellipse 80% 40% at 50% 0%, rgba(197,122,255,.1) 0%, transparent 70%)` }}>

      <div style={{ textAlign:'center', marginBottom:'3rem' }}>
        <div style={{ display:'inline-block', padding:'.3rem .9rem',
          border:`1px solid ${C.violetDim}`, borderRadius:99,
          fontSize:'.75rem', fontWeight:600, color:C.violet, marginBottom:'1.25rem' }}>
          Aurlom Éducation · Planning 2025–2026
        </div>
        <h1 style={{ fontSize:'clamp(1.8rem,5vw,2.8rem)', fontWeight:800,
          lineHeight:1.15, marginBottom:'.9rem' }}>
          Recueil des vœux<br/>
          <span style={{ color:C.violet }}>professeurs BTS</span>
        </h1>
        <p style={{ color:C.textDim, maxWidth:480, margin:'0 auto',
          fontSize:'.95rem', lineHeight:1.7 }}>
          Filières : BTS BM · OL · FED C · Prothèse · BIOALC<br/>
          Disponibilités, matières, campus et objectifs pédagogiques
        </p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',
        gap:16, width:'100%', maxWidth:600 }}>
        {/* Carte prof */}
        <div onClick={onProf} style={{ background:C.bg2, border:`2px solid ${C.border}`,
          borderRadius:18, padding:'2rem', cursor:'pointer', textAlign:'center',
          transition:'all .2s' }}
          onMouseOver={e=>{ e.currentTarget.style.borderColor=C.violet; e.currentTarget.style.transform='translateY(-3px)' }}
          onMouseOut={e=>{ e.currentTarget.style.borderColor=C.border; e.currentTarget.style.transform='none' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'1rem' }}>📝</div>
          <div style={{ fontWeight:700, fontSize:'1.05rem', marginBottom:'.4rem' }}>Je suis professeur</div>
          <div style={{ fontSize:'.83rem', color:C.textDim, marginBottom:'1.25rem', lineHeight:1.6 }}>
            Remplir le formulaire de vœux pour l'année prochaine (5 étapes, ~5 min)
          </div>
          <div style={{ padding:'.6rem 1.25rem', background:`linear-gradient(135deg,${C.violetD},${C.violet})`,
            borderRadius:10, color:'#fff', fontWeight:700, fontSize:'.88rem', display:'inline-block' }}>
            Commencer →
          </div>
        </div>

        {/* Carte admin */}
        <div onClick={onAdmin} style={{ background:C.bg2, border:`2px solid ${C.border}`,
          borderRadius:18, padding:'2rem', cursor:'pointer', textAlign:'center',
          transition:'all .2s' }}
          onMouseOver={e=>{ e.currentTarget.style.borderColor=C.border; e.currentTarget.style.transform='translateY(-3px)' }}
          onMouseOut={e=>{ e.currentTarget.style.borderColor=C.border; e.currentTarget.style.transform='none' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'1rem' }}>🔒</div>
          <div style={{ fontWeight:700, fontSize:'1.05rem', marginBottom:'.4rem' }}>Administration</div>
          <div style={{ fontSize:'.83rem', color:C.textDim, marginBottom:'1.25rem', lineHeight:1.6 }}>
            Consulter toutes les réponses, heatmap, export Google Sheets
          </div>
          <div style={{ padding:'.6rem 1.25rem', background:C.bg3,
            border:`1px solid ${C.border}`, borderRadius:10, color:C.textDim,
            fontWeight:700, fontSize:'.88rem', display:'inline-block' }}>
            Accès restreint
          </div>
        </div>
      </div>

      <p style={{ marginTop:'2rem', fontSize:'.75rem', color:C.textDim }}>
        Vos réponses sont confidentielles et ne sont visibles que par l'administration
      </p>
    </div>
  )
}

// ── APP ROOT ──────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState('accueil') // accueil | form | done | adminlogin | admin
  const [lastForm, setLastForm] = useState(null)
  const [adminAuth, setAdminAuth] = useState(false)

  function handleFormComplete(data) {
    setLastForm(data)
    setPage('done')
  }

  if (page === 'form')      return <ProfForm onComplete={handleFormComplete} />
  if (page === 'done')      return <Confirmation data={lastForm} onNew={()=>{ setPage('form') }} />
  if (page === 'adminlogin') return <AdminLogin onAuth={()=>{ setAdminAuth(true); setPage('admin') }} />
  if (page === 'admin' && adminAuth) return <AdminDashboard onLogout={()=>{ setAdminAuth(false); setPage('accueil') }} />

  return <Accueil onProf={()=>setPage('form')} onAdmin={()=>setPage('adminlogin')} />
}
