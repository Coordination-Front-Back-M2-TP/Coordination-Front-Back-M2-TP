import { ServerStatus } from './ServerStatus.jsx'

export const Connecte = () => <ServerStatus status="ok" />
export const EnVerification = () => <ServerStatus status="vérification…" />
export const Injoignable = () => <ServerStatus status="injoignable" />
