// Données communes aux maquettes (issue #168). Tout est fictif, sauf la palette
// (front/src/api/palette.js), la taille de la toile (101 × 101) et le délai (10 s).
const PALETTE = [
  ['#000000', 'Noir'], ['#4B5563', 'Gris foncé'], ['#9CA3AF', 'Gris clair'], ['#FFFFFF', 'Blanc'],
  ['#D93A3A', 'Rouge'], ['#F472B6', 'Rose'], ['#F59E0B', 'Orange'], ['#92400E', 'Marron'],
  ['#FACC15', 'Jaune'], ['#FDE68A', 'Beige'], ['#22C55E', 'Vert'], ['#166534', 'Vert foncé'],
  ['#22D3EE', 'Cyan'], ['#2563EB', 'Bleu'], ['#1E3A8A', 'Bleu marine'], ['#9333EA', 'Violet'],
]

const TAILLE = 101

// Lettres 3 × 5 du logotype, dessinées en pixels.
const LETTRES = {
  P: ['111', '101', '111', '100', '100'],
  1: ['010', '110', '010', '010', '111'],
  X: ['101', '101', '010', '101', '101'],
  3: ['111', '001', '011', '001', '111'],
  L: ['100', '100', '100', '100', '111'],
}

// Petit générateur pseudo-aléatoire : la même toile à chaque affichage.
function aleatoire(graine) {
  let s = graine
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function dessinerToile(canvas) {
  canvas.width = TAILLE
  canvas.height = TAILLE
  const ctx = canvas.getContext('2d')
  const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1) }
  const rnd = aleatoire(42)
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, TAILLE, TAILLE)

  // Zones disputées : des taches qui se chevauchent, comme après une heure de jeu.
  const taches = [[18, 20, '#D93A3A', 16], [78, 24, '#2563EB', 18], [30, 76, '#22C55E', 15], [74, 78, '#FACC15', 14], [52, 50, '#9333EA', 9]]
  for (const [cx, cy, c, r] of taches) {
    for (let i = 0; i < r * r * 3; i++) {
      const a = rnd() * Math.PI * 2
      const d = Math.sqrt(rnd()) * r
      px(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), c)
    }
  }
  // Un coeur rouge.
  const coeur = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000']
  coeur.forEach((l, y) => [...l].forEach((v, x) => v === '1' && px(12 + x, 15 + y, '#000000')))
  coeur.forEach((l, y) => [...l].forEach((v, x) => v === '1' && px(26 + x, 15 + y, '#F472B6')))
  // Le nom du jeu, posé par l'équipe bleue.
  let ox = 62
  for (const ch of 'P1X3L') {
    LETTRES[ch].forEach((l, y) => [...l].forEach((v, x) => v === '1' && px(ox + x, 12 + y, '#FFFFFF')))
    ox += 4
  }
  // Un arbre vert et un soleil jaune.
  for (let y = 0; y < 9; y++) for (let x = -y; x <= y; x++) if (rnd() > 0.15) px(30 + x, 66 + y, '#166534')
  for (let y = 75; y < 80; y++) px(30, y, '#92400E')
  for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (x * x + y * y <= 16) px(76 + x, 76 + y, '#F59E0B')
  // Pixels isolés partout.
  for (let i = 0; i < 260; i++) px(Math.floor(rnd() * TAILLE), Math.floor(rnd() * TAILLE), PALETTE[Math.floor(rnd() * 16)][0])
}

function dessinerLogo(el, couleur, taille) {
  el.setAttribute('role', 'img')
  el.setAttribute('aria-label', 'Pixel')
  el.style.display = 'grid'
  el.style.gridTemplateColumns = `repeat(19, ${taille}px)`
  el.style.gridAutoRows = `${taille}px`
  const grille = Array.from({ length: 5 }, () => Array(19).fill('0'))
  let ox = 0
  for (const ch of 'P1X3L') {
    LETTRES[ch].forEach((l, y) => [...l].forEach((v, x) => { grille[y][ox + x] = v }))
    ox += 4
  }
  for (const ligne of grille) for (const v of ligne) {
    const c = document.createElement('span')
    if (v === '1') c.style.background = couleur
    el.append(c)
  }
}

function remplirPalette(el, choisie = 13) {
  PALETTE.forEach(([c, nom], i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'nuance'
    b.style.setProperty('--c', c)
    b.title = nom
    b.setAttribute('aria-label', nom)
    if (i === choisie) b.setAttribute('aria-pressed', 'true')
    el.append(b)
  })
}

document.querySelectorAll('canvas.toile').forEach(dessinerToile)
document.querySelectorAll('[data-palette]').forEach((el) => remplirPalette(el))
