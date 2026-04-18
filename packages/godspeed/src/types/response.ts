/**
 * response.ts
 *
 * Defines the strict structure of a Godspeed HTTP response. 
 *
 * It explicitly exposes `parsedBody` and hides the raw 
 * Fetch API `Response` object. This strictly enforces our Single-Pass Body 
 * consumption rule across the entire middleware pipeline.
 */

export interface GodspeedResponse<TData = unknown> {
  /**
   * The HTTP status code (e.g., 200, 404).
   */
  status: number;

  /**
   * The HTTP status text (e.g., 'OK', 'Not Found').
   */
  statusText: string;

  /**
   * The parsed response headers.
   */
  headers: Headers;

  /**
   * The single-pass materialized body of the response. 
   * Downstream consumers MUST read from this property instead of attempting
   * to access or clone raw streams.
   */
  parsedBody: TData;

  /**
   * Alias for parsedBody used by the Axios compatibility layer.
   */
  data: TData;
}
