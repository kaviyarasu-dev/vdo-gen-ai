import { nanoid } from 'nanoid';

const DEFAULT_ID_SIZE = 21;

export function generateId(size: number = DEFAULT_ID_SIZE): string {
  return nanoid(size);
}
