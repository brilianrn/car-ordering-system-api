import { glob } from 'glob';
import { join } from 'path';

export const discoverSchedulers = async (): Promise<Function[]> => {
  const schedulerFiles = await glob(
    join(process.cwd(), 'dist', 'packages/**/scheduler/*.js'),
  );

  const schedulers: Function[] = [];

  for (const file of schedulerFiles) {
    const module = await import(file);

    Object.values(module).forEach((exported: any) => {
      if (
        typeof exported === 'function' &&
        exported.name.endsWith('Scheduler')
      ) {
        schedulers.push(exported as Function);
      }
    });
  }

  return schedulers;
};
