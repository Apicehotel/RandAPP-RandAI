// Scheda unica per Segnalazioni e Interventi (elenchi e Operatività): stessa struttura, stesse misure.
// Riga 1: titolo + badge (urgenza per le segnalazioni, stato per gli interventi).
// Riga 2: luogo a sinistra, stato/data a destra. A destra, se c'è, la miniatura 58px.
export default function ItemCard({ href, title, badge, where, meta, thumb }) {
  const Tag = href ? 'a' : 'div'
  return (
    <Tag className={`card issue${thumb ? ' has-thumb' : ''}`} {...(href ? { href } : {})}>
      <div className="issue-main">
        <div className="row">
          <span className="title">{title}</span>
          {badge}
        </div>
        <div className="row muted">
          <span>{where}</span>
          <span className="issue-meta">{meta}</span>
        </div>
      </div>
      {thumb}
    </Tag>
  )
}
