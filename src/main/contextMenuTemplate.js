// The renderer describes a menu as plain data ({ label, id | role, enabled, visible, type });
// this turns it into a native template. Choosing an item with an `id` sends it back to the
// renderer together with the `context` the menu was opened with.
export function buildContextMenuTemplate(items, context, sender) {
  if (!Array.isArray(items)) return []

  return items
    .filter(item => item && item.visible !== false)
    .map(item => {
      if (item.type === 'separator') return { type: 'separator' }

      const menuItem = {
        label: String(item.label || ''),
        enabled: item.enabled !== false
      }

      if (item.role) {
        menuItem.role = item.role
      } else if (item.id) {
        menuItem.click = () => {
          sender.send('context-menu:command', { id: item.id, context: context || {} })
        }
      }

      return menuItem
    })
}
