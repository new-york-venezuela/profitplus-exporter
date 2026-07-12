import { REPORTS }               from '@/lib/reports/registry';
import { getPreviousMonthRange } from '@/lib/dates';
import { ReportPage }            from '@/components/report-page';

export default function ComprasPage() {
  return (
    <ReportPage
      config={REPORTS['compras']}
      defaultDates={getPreviousMonthRange()}
    />
  );
}
