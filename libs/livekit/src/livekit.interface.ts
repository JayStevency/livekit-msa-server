import { ModuleMetadata } from '@nestjs/common';

export interface LivekitModuleOptions {
  apiKey: string;
  apiSecret: string;
  wsUrl: string;
}

export interface LivekitModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (
    ...args: any[]
  ) => Promise<LivekitModuleOptions> | LivekitModuleOptions;
  inject?: any[];
}

export interface CreateTokenOptions {
  roomName: string;
  identity: string;
  name?: string;
  metadata?: string;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
  ttl?: number;
}
