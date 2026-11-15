import { REPORTS }               from '@/lib/reports/registry';
import { getPreviousMonthRange } from '@/lib/dates';
import { ReportPage }            from '@/components/report-page';

export default function CxcPendientesPage() {
  return (
    <ReportPage
      config={REPORTS['cxc-pendientes']}
      defaultDates={getPreviousMonthRange()}
    />
  );
}
