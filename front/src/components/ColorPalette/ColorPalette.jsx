import styles from './ColorPalette.module.css'

// Des boutons radio natifs : le choix se fait au clavier (flèches) et chaque couleur est annoncée par son nom.
// À l'écran, seule la pastille se voit ; le nom apparaît au survol et reste lu par les lecteurs d'écran.
export function ColorPalette({ colors, value, onChange, disabled = false }) {
  return (
    <fieldset className={styles.palette} disabled={disabled}>
      <legend className="visually-hidden">Couleur</legend>
      {colors.map(({ color, name }) => (
        <label key={color} className={styles.option} title={name}>
          <input
            type="radio"
            name="pixel-color"
            value={color}
            checked={value === color}
            onChange={() => onChange(color)}
            className={styles.input}
          />
          <span className={styles.swatch} style={{ backgroundColor: color }} aria-hidden="true" />
          <span className="visually-hidden">{name}</span>
        </label>
      ))}
    </fieldset>
  )
}
