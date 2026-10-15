import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

// Opcional: Configurar o worker para ignorar pedidos a recursos externos se necessário,
// mas por defeito o MSW apenas avisa e faz bypass automático.
