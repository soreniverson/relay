import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@relay/api/routers';

export const trpc = createTRPCReact<AppRouter>();
