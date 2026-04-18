import { GodspeedClient as BaseClient } from '../core/GodspeedClient';
import { axiosAdapter } from './interceptorAdapter';
import type { GodspeedConfig, GodspeedResponse } from '../types';

/**
 * AxiosCompatClient
 * 
 * A specialized version of GodspeedClient that implements the Axios interceptors API.
 * It automatically initializes the axiosAdapter middleware on construction.
 */
export class AxiosCompatClient extends BaseClient {
  public interceptors: ReturnType<typeof axiosAdapter>;

  constructor(config: GodspeedConfig = {}) {
    super(config);
    this.interceptors = axiosAdapter();
    this.use(this.interceptors.middleware);
  }

  // Allow the instance to be called as a function: api(config)
  public request(config: any): Promise<GodspeedResponse<unknown>> {
    const { url, method = 'GET', data, ...options } = config;
    if (!url) throw new Error('Godspeed Compat: "url" is required for direct calls.');
    return (this as any)[method.toLowerCase()](url, { ...options, body: data });
  }
}

/**
 * Creates an Axios-compatible client instance.
 * Returns a function that is also an instance of AxiosCompatClient.
 */
export function createInstance(config: GodspeedConfig = {}) {
  const context = new AxiosCompatClient(config);
  const instance = context.request.bind(context) as any;

  // Copy all methods from the context and its prototype chain to the instance
  let proto = Object.getPrototypeOf(context);
  while (proto && proto !== Object.prototype) {
    Object.getOwnPropertyNames(proto).forEach(name => {
      if (name !== 'constructor' && typeof (context as any)[name] === 'function') {
        instance[name] = (context as any)[name].bind(context);
      }
    });
    proto = Object.getPrototypeOf(proto);
  }

  // Copy instance properties (like interceptors)
  Object.assign(instance, context);
  
  return instance;
}

export { createInstance as GodspeedClient };
export * from './interceptorAdapter';
