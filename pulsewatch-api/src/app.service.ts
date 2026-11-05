import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): any {
    return {
      status: 'ok',
      service: 'PulseWatch API',
      timestamp: new Date().toISOString(),
    };
  }
}
