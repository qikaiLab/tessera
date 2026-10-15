// "常驻" / "激发" tag. An activated section that holds nothing yet gets a × on its tag: the tag
// itself closes the section, so a misclicked "add record" button is undone where the eye already
// is, without another control in the header. Once there is content the × goes away.
export default function SectionTypeBadge({ section, closable, onClose }) {
  if (section.resident) return <span className="section-type-badge resident">常驻</span>
  if (!closable) return <span className="section-type-badge activated">激发</span>
  return (
    <button
      type="button"
      className="section-type-badge activated is-closable"
      onClick={onClose}
      title="这个板块还没有内容，点击关闭"
      aria-label={`关闭${section.name}`}
    >
      激发
      <span className="section-type-badge-close" aria-hidden="true">×</span>
    </button>
  )
}
