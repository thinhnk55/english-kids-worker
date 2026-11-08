import { errorResponse } from '../utils/response.ts';

export async function routeUserRequest(
  _request: Request,
  _env: Env,
  origin: string,
  _pathname: string,
  _userId: string,
): Promise<Response> {
  return errorResponse(404, 'NOT_FOUND', undefined, origin);
}
