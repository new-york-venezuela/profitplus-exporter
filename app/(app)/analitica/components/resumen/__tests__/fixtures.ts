import type { ResumenKPIs } from '../../../types';

export function makeKpis(over: Partial<ResumenKPIs> = {}): ResumenKPIs {
  return {
    salesGross: { bs: 1_000_000, usd: 100000 },
    returns: { bs: 40_000, usd: 4000 },
    salesNet: { bs: 960_000, usd: 96000 },
    returnRate: 0.04,
    collected: { bs: 500_000, usd: 50000 },
    activeCustomers: 90,
    activeCustomersPrevPeriod: 80,
    churnRate: 0.1,
    unitsSold: 12400,
    receivable: { bs: 2_000_000, usd: 200000 },
    unitsReturned: 480,
    customersWithSales: 95,
    customersWithReturns: 22,
    customersNet: 88,
    customersTotal: 100,
    activeCustomerCodes: 85,
    customersNew: 7,
    receivableOpening: { bs: 1_500_000, usd: 150000 },
    billed: { bs: 1_000_000, usd: 100000 },
    ...over,
  };
}
