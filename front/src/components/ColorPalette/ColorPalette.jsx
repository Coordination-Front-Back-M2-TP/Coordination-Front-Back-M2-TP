import styles from './ColorPalette.module.css'

// Des boutons radio natifs : le choix se fait au clavier (flèches) et chaque couleur est annoncée par son nom.
export function ColorPalette({ colors, value, onChange, disabled = false }) {
  return (
    <fieldset className={styles.palette} disabled={disabled}>
      <legend>Couleur</legend>
      {colors.map(({ color, name }) => (
        <label key={color} className={styles.option}>
          <input
            type="radio"
            name="pixel-color"
            value={color}
            checked={value === color}
            onChange={() => onChange(color)}
            className={styles.input}
          />
          <span className={styles.swatch} style={{ backgroundColor: color }} aria-hidden="true" />
          <span>{name}</span>
        </label>
      ))}
    </fieldset>
  )
}
