// Force dynamic rendering for all dashboard routes
export const dynamic = 'force-dynamic';

export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return children;
}
