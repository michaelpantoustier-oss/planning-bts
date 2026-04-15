import { Resend } from 'resend'

const apiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY
const resend = new Resend(apiKey)

const JOURS_LABEL = { lun:'Lundi', mar:'Mardi', mer:'Mercredi', jeu:'Jeudi', ven:'Vendredi' }
const DISPO_LABEL = { dispo:'Disponible', demi:'Demi-journée', indispo:'Indisponible' }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { nom, prenom, email, filieres, matieres, heuresHebdo, campus, dispo, classes, remarques } = req.body

  const dispoRows = Object.entries(dispo || {}).map(([j, v]) =>
    `<tr><td style="padding:4px 8px;font-weight:600">${JOURS_LABEL[j]}</td>
     <td style="padding:4px 8px">Matin : ${DISPO_LABEL[v.matin] || v.matin}</td>
     <td style="padding:4px 8px">Après-midi : ${DISPO_LABEL[v.apm] || v.apm}</td></tr>`
  ).join('')

  const classesRows = (classes || []).map(c =>
    `<tr><td style="padding:4px 8px">${c.nom}</td>
     <td style="padding:4px 8px">${c.taux}%</td>
     <td style="padding:4px 8px">${c.moy}/20</td></tr>`
  ).join('')

  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
  <div style="background:#07060B;padding:24px;border-radius:12px 12px 0 0;text-align:center">
    <span style="color:#C57AFF;font-weight:800;font-size:1.3rem">Aurlom Éducation</span>
    <p style="color:#9589B0;margin:4px 0 0">Récapitulatif de vos vœux planning</p>
  </div>
  <div style="background:#f9f9f9;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e0e0e0">
    <h2 style="margin:0 0 16px">Bonjour ${prenom} ${nom},</h2>
    <p>Voici le récapitulatif de vos vœux pour l'année prochaine.</p>

    <h3 style="color:#902EDB">Filières & matières</h3>
    <p><strong>Filières :</strong> ${(filieres || []).join(', ')}</p>
    <p><strong>Matières :</strong> ${(matieres || []).join(', ')}</p>

    <h3 style="color:#902EDB">Volume & campus</h3>
    <p><strong>Heures hebdo souhaitées :</strong> ${heuresHebdo}h</p>
    <p><strong>Campus (par ordre de préférence) :</strong> ${(campus || []).join(' → ')}</p>

    <h3 style="color:#902EDB">Disponibilités</h3>
    <table style="border-collapse:collapse;width:100%">
      <thead><tr style="background:#e8e8e8">
        <th style="padding:4px 8px;text-align:left">Jour</th>
        <th style="padding:4px 8px;text-align:left">Matin</th>
        <th style="padding:4px 8px;text-align:left">Après-midi</th>
      </tr></thead>
      <tbody>${dispoRows}</tbody>
    </table>

    ${classesRows ? `
    <h3 style="color:#902EDB">Objectifs par classe</h3>
    <table style="border-collapse:collapse;width:100%">
      <thead><tr style="background:#e8e8e8">
        <th style="padding:4px 8px;text-align:left">Classe</th>
        <th style="padding:4px 8px;text-align:left">Taux de réussite visé</th>
        <th style="padding:4px 8px;text-align:left">Moyenne actuelle</th>
      </tr></thead>
      <tbody>${classesRows}</tbody>
    </table>` : ''}

    ${remarques ? `<h3 style="color:#902EDB">Remarques</h3><p>${remarques}</p>` : ''}

    <p style="color:#666;font-size:.85rem;margin-top:24px">
      Ces vœux ont bien été transmis à l'équipe Aurlom. Pour toute modification, contactez-nous.
    </p>
  </div>
</div>`

  try {
    await resend.emails.send({
      from: 'Aurlom Éducation <onboarding@resend.dev>',
      to: email,
      subject: `Récapitulatif de vos vœux planning – ${prenom} ${nom}`,
      html,
    })
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}
