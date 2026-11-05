export type MonitorStatus = 'UP' | 'DOWN' | 'PENDING';

export type HttpMethod = 'GET' | 'POST' | 'HEAD';

export interface MonitorRecord {
  id: string;
  name: string;
  url: string;
  method: HttpMethod;
  intervalSeconds: 30 | 60 | 300;
  enabled: boolean;
  status: MonitorStatus;
  createdAt: string;
}
