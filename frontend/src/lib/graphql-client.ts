import { Client, cacheExchange, fetchExchange } from 'urql';

export function createGraphQLClient(): Client {
  return new Client({
    url: '/graphql',
    exchanges: [cacheExchange, fetchExchange],
  });
}
