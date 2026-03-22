import { bootRenderer } from './utils/boot-renderer'

void bootRenderer('main', () => import('./main'))
