import { api } from './client';
import { withProgress } from '../utils/progressBarBus';

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || '';
      resolve(String(result).split(',')[1] || '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export const importApi = {
  parseFile: async (file) =>
    withProgress(async () => {
      const contentBase64 = await readFileAsBase64(file);
      return api.post('/import/parse', { filename: file.name, contentBase64 });
    }),
};
