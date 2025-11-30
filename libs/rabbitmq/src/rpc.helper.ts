import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { RequestTimeoutException } from '@nestjs/common';

export interface RpcOptions {
  timeout?: number;
}

const DEFAULT_TIMEOUT = 5000;

/**
 * RPC 요청 헬퍼 함수
 * firstValueFrom + timeout 패턴을 간소화
 */
export async function rpcSend<TResult, TInput = unknown>(
  client: ClientProxy,
  pattern: string,
  data: TInput,
  options?: RpcOptions,
): Promise<TResult> {
  const timeoutMs = options?.timeout ?? DEFAULT_TIMEOUT;

  return firstValueFrom(
    client.send<TResult>(pattern, data).pipe(
      timeout(timeoutMs),
      catchError((error) => {
        if (error.name === 'TimeoutError') {
          throw new RequestTimeoutException(
            `RPC request to "${pattern}" timed out after ${timeoutMs}ms`,
          );
        }
        throw error;
      }),
    ),
  );
}

/**
 * RPC 이벤트 발행 헬퍼 함수 (응답 불필요한 경우)
 */
export function rpcEmit<TInput = unknown>(
  client: ClientProxy,
  pattern: string,
  data: TInput,
): void {
  client.emit(pattern, data);
}
