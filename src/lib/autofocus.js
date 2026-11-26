// autoFocus solo dove c'è un mouse (desktop): sul telefono aprirebbe la tastiera e coprirebbe il modulo.
export const autoFocusOnDesktop = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches
