import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider as UrqlProvider } from 'urql';
import { AuthProvider } from './lib/auth';
import { createGraphQLClient } from './lib/graphql-client';
import App from './app/App';
import './styles/index.css';

const client = createGraphQLClient();

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <UrqlProvider value={client}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </UrqlProvider>
  </AuthProvider>
);
