// Il codice del link del tecnico: 64 caratteri esadecimali dopo «#/t/».
export const tokenFromPortalRoute = (route) => (String(route || '').match(/^\/t\/([0-9a-f]{64})/) || [])[1] || ''
