import { Injectable } from '@nestjs/common';
interface HealthResponse { status: 'ok'; service: string; timestamp: string; }
@Injectable()
export class AppService {
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'PulseWatch API',
      timestamp: new Date().toISOString(),
    };
  }
}
