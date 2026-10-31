// Punto d'ingresso di RandAI. È PREDISPOSTO ma SPENTO.
// Finché VITE_FEATURE_RANDAI non è "true" non compare in nessun menu e non viene caricato.
// Quando lo accenderemo, tutto il codice di RandAI vive in questa cartella e si carica solo a richiesta.
import { FEATURES } from '../app/features.js'

export const randaiEnabled = FEATURES.randai

export const loadRandAI = () => import('./RandAI.jsx')
