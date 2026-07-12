import { REPORTS }               from '@/lib/reports/registry';
import { getPreviousMonthRange } from '@/lib/dates';
import { ReportPage }            from '@/components/report-page';

export default function VentasPage() {
  return (
    <ReportPage
      config={REPORTS['ventas']}
      defaultDates={getPreviousMonthRange()}
    />
  );
}
