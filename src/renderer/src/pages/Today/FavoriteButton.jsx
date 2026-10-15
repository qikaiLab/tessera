export default function FavoriteButton({ favorite, onToggle, name }) {
  return (
    <button
      type="button"
      className={`favorite-btn ${favorite ? 'is-active' : ''}`}
      onClick={onToggle}
      aria-pressed={favorite}
      aria-label={favorite ? `取消收藏${name}` : `收藏${name}`}
      title={favorite ? '取消收藏' : '收藏这天的这个版块'}
    >
      {favorite ? '★' : '☆'}
    </button>
  )
}
