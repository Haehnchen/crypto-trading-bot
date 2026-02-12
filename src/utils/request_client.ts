import request = require('request');

export interface Logger {
  error(message: string): void;
}

export interface RequestResult {
  error?: any;
  response?: {
    statusCode?: number;
  };
  body?: any;
}

export class RequestClient {
  constructor(private readonly logger?: Logger) {}

  executeRequest(options: any): Promise<RequestResult> {
    return new Promise(resolve => {
      request(options, (error: any, response: any, body: any) => {
        resolve({
          error: error,
          response: response,
          body: body
        });
      });
    });
  }

  executeRequestRetry(
    options: any,
    retryCallback: (result: RequestResult) => boolean,
    retryMs: number = 500,
    retries: number = 10
  ): Promise<RequestResult> {
    const wait = (time: number) => {
      return new Promise<void>(resolve => {
        setTimeout(() => {
          resolve(undefined);
        }, time);
      });
    };

    return new Promise(async resolve => {
      let lastResult: RequestResult;

      for (let retry = 1; retry <= retries; retry++) {
        const result = (lastResult = await this.executeRequest(options));

        const shouldRetry = retryCallback(result);

        if (shouldRetry !== true) {
          resolve(result);
          return;
        }

        if (this.logger) {
          const debug = JSON.stringify([
            options.url ? options.url : '',
            result && result.response && result.response.statusCode ? result.response.statusCode : '',
            options.body ? options.body.substring(0, 50) : ''
          ]);

          this.logger.error(`Request: error retry (${retry}) in ${retryMs}ms ${debug}`);
        }

        await wait(retryMs);
      }

      resolve(lastResult);
    });
  }
}
