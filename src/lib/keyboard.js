// Tastiera a schermo aperta: l'altezza visibile scende sotto il 75% di quella della finestra.
// Con la tastiera la barra in basso si nasconde per lasciare spazio ai campi.
export const isKeyboardOpen = (windowHeight, visibleHeight) =>
  windowHeight > 0 && visibleHeight > 0 && visibleHeight < windowHeight * 0.75
