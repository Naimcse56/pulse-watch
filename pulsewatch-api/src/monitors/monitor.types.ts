export type MonitorStatus = 'UP' | 'DOWN' | 'PENDING';

export type HttpMethod = 'GET' | 'POST' | 'HEAD';

export interface Monitor {
  id: string;
  name: string;
  url: string;
  method: HttpMethod;
  status: MonitorStatus;
  keyword?: string;
  timeoutMs?: number;
}
