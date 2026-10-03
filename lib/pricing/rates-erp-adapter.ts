import type { ConnectionPool } from 'mssql';
import type { RatesErp } from './lists-service';
import * as erp from './rates-erp';

export function realRatesErp(pool: ConnectionPool): RatesErp {
  return {
    listLists: () => erp.listPriceLists(pool),
    getList: c => erp.getPriceList(pool, c),
    listCodes: () => erp.listPriceListCodes(pool),
    listCurrencies: () => erp.listCurrencies(pool),
    readListRates: c => erp.readListRates(pool, c),
    readArticleRates: a => erp.readArticleRates(pool, a),
    dominantWarehouse: c => erp.dominantWarehouse(pool, c),
    listArticles: p => erp.listArticles(pool, p),
    getCustomerPriceList: c => erp.getCustomerPriceList(pool, c),
    applyRatePeriod: a => erp.applyRatePeriodErp(pool, a),
    applyPlanned: (a, plan) => erp.applyPlannedErp(pool, a, plan),
    createList: p => erp.createListErp(pool, p),
    updateList: p => erp.updateListErp(pool, p),
    cloneList: p => erp.cloneListErp(pool, p),
  };
}
