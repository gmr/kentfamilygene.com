import { Client, cacheExchange, fetchExchange } from 'urql';
import { getAuthHeader } from './auth';

export function createGraphQLClient(): Client {
  return new Client({
    url: '/graphql',
    exchanges: [cacheExchange, fetchExchange],
    fetchOptions: () => {
      const authHeader = getAuthHeader();
      return authHeader
        ? { headers: { Authorization: authHeader } }
        : {};
    },
  });
}
