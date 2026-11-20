// Styles communs chargés dans Ladle, comme main.jsx les charge dans l'application :
// sans eux, les stories n'auraient ni les variables de design ni les styles de base.
import '../src/styles/tokens.css'
import '../src/styles/base.css'

export const Provider = ({ children }) => children
