import type { Monitor } from './monitor.types';

const monitor: Monitor = {
  id: 'mon_001',
  name: 'Production Website',
  url: 'https://example.com',
  method: 'GET',
  status: 'PENDING',
};

console.log(monitor);
