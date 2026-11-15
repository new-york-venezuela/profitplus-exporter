import { REPORTS }               from '@/lib/reports/registry';
import { getPreviousMonthRange } from '@/lib/dates';
import { ReportPage }            from '@/components/report-page';

export default function RetencionesPage() {
  return (
    <ReportPage
      config={REPORTS['retenciones']}
      defaultDates={getPreviousMonthRange()}
    />
  );
}
