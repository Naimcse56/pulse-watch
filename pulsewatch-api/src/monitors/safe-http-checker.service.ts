import { Injectable } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import * as http from 'node:http';
import * as https from 'node:https';
import { performance } from 'node:perf_hooks';
import { isIP } from 'node:net';
import * as ipaddr from 'ipaddr.js';

export interface HttpCheckResult {
  status: 'UP' | 'DOWN';
  httpStatusCode: number | null;
  responseTimeMs: number;
}

@Injectable()
export class SafeHttpCheckerService {
    private isPublicIp(address: string): boolean {
        if (!ipaddr.isValid(address)) return false;
        const parsed = ipaddr.process(address);
        return parsed.range() === 'unicast';
    }

    private async resolvePublicAddresses(hostname: string) {
        if (hostname.endsWith('.') && hostname.length === 1) {
            throw new Error('Invalid hostname');
        }

        if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
            throw new Error('Local hostnames are not allowed');
        }

        if (isIP(hostname)) {
        if (!this.isPublicIp(hostname)) throw new Error('Non-public IP is not allowed');
            return [{ address: hostname, family: isIP(hostname) }];
        }

        const records = await lookup(hostname, { all: true, verbatim: true });
        if (!records.length || records.some((record) => !this.isPublicIp(record.address))) {
            throw new Error('Hostname resolves to a non-public IP');
        }
        return records;
    }

    async check(rawUrl: string, method: 'GET' | 'POST' | 'HEAD'): Promise<HttpCheckResult> {
        const startedAt = performance.now();

        try {
        const url = new URL(rawUrl);

        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS are allowed');
        if (url.username || url.password) throw new Error('Credentials in URLs are not allowed');
        if (!url.hostname) throw new Error('Hostname is required');

        const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
        const addresses = await this.resolvePublicAddresses(hostname);
        const pinnedAddress = addresses[0];

        const httpStatusCode = await new Promise<number>((resolve, reject) => {
            const transport = url.protocol === 'https:' ? https : http;
            const request = transport.request(url, {
            method,
            agent: false,
            lookup: (_host, options, callback) => {
                if (options && typeof options === 'object' && 'all' in options && options.all) {
                    callback(null, addresses);
                    return;
                }
                const chosen = options && typeof options === 'object' && 'family' in options && options.family ? addresses.find((item) => item.family === options.family) : pinnedAddress;
                if (!chosen) {
                    callback(new Error('No validated address for requested IP family'), '', 0);
                    return;
                }
                callback(null, chosen.address, chosen.family);
            },
            }, (response) => {
                response.resume();
                resolve(response.statusCode ?? 0);
            });

            request.setTimeout(5000, () => request.destroy(new Error('Request timed out')));
            request.on('error', reject);
            request.end();
        });

        return {
            status: httpStatusCode >= 200 && httpStatusCode < 400 ? 'UP' : 'DOWN',
            httpStatusCode,
            responseTimeMs: Math.round(performance.now() - startedAt),
        };
        } catch {
        return {
            status: 'DOWN',
            httpStatusCode: null,
            responseTimeMs: Math.round(performance.now() - startedAt),
        };
        }
    }
}
