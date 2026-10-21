import { createBrowserRouter, RouterProvider } from 'react-router';
import { routes } from '@/routes/routes';
import { Providers } from './providers';

const router = createBrowserRouter(routes);

export function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}
