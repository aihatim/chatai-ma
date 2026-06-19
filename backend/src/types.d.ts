/// <reference types="@prisma/client" />

declare module 'bullmq' {
  import { Redis } from 'ioredis';
  type RedisConnection = { url?: string; host?: string; port?: number } | Redis;

  export interface QueueOptions {
    connection?: RedisConnection;
    defaultJobOptions?: {
      attempts?: number;
      backoff?: { type: string; delay: number };
      removeOnComplete?: boolean | { age: number; count: number };
      removeOnFail?: boolean | { age: number; count: number };
    };
  }

  export interface WorkerOptions {
    connection?: RedisConnection;
    concurrency?: number;
    lockDuration?: number;
  }

  export interface Job<T = any> {
    id: string;
    data: T;
    attemptsMade: number;
    update(data: T): Promise<void>;
    updateProgress(progress: number): Promise<void>;
    log(logRow: string): Promise<void>;
    remove(): Promise<void>;
    discard(): Promise<void>;
    moveToDelayed(delay: number, token?: string): Promise<void>;
    moveToCompleted(data: any, token?: string): Promise<void>;
    moveToFailed(err: Error, token?: string): Promise<void>;
  }

  export class Queue {
    constructor(name: string, opts?: QueueOptions);
    add(name: string, data: any, opts?: Record<string, unknown>): Promise<Job>;
    close(): Promise<void>;
    getJobCounts(): Promise<Record<string, number>>;
    getActive(): Promise<Job[]>;
    getWaiting(): Promise<Job[]>;
    getDelayed(): Promise<Job[]>;
    getCompleted(): Promise<Job[]>;
    getFailed(): Promise<Job[]>;
    empty(): Promise<void>;
  }

  export class Worker<T = any> {
    constructor(name: string, processor: (job: Job<T>) => Promise<any>, opts?: WorkerOptions);
    on(event: 'completed', listener: (job: Job<T>, result: any) => void): this;
    on(event: 'failed', listener: (job: Job<T>, err: Error) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    close(): Promise<void>;
  }

  export class QueueEvents {
    constructor(name: string, opts?: { connection?: { url?: string; host?: string; port?: number } });
    on(event: string, listener: (...args: any[]) => void): this;
    close(): Promise<void>;
  }

  export type Processor<T = any> = (job: Job<T>) => Promise<any>;
}

declare module 'pdf-parse' {
  interface PDFData {
    text: string;
    numpages: number;
    info: Record<string, any>;
    metadata: Record<string, any>;
    version: string;
  }
  function pdfParse(dataBuffer: Buffer, options?: any): Promise<PDFData>;
  export default pdfParse;
}

declare module 'mammoth' {
  interface MammothResult {
    value: string;
    messages: any[];
  }
  export function extractRawText(input: { buffer: Buffer }): Promise<MammothResult>;
}
