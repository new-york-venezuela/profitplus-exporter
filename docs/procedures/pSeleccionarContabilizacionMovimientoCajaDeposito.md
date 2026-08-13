# SP: pSeleccionarContabilizacionMovimientoCajaDeposito
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCaja`](../tables/saCaja.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)
- [`saDepositoBanco`](../tables/saDepositoBanco.md)
- [`saDepositoBancoReng`](../tables/saDepositoBancoReng.md)
- [`saMoneda`](../tables/saMoneda.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pSeleccionarContabilizacionMovimientoCajaDeposito]
    (
      @sdFechaDesde SMALLDATETIME ,
      @sdFechHasta SMALLDATETIME ,
      @sCo_Sucu_Desde CHAR(6) = NULL ,
      @sCo_Sucu_Hasta CHAR(6) = NULL ,
      @bDocnoint BIT --Documentos no Contabilizados
	
    )
AS 
    BEGIN
	
        IF @sdFechaDesde IS NOT NULL 
            SET @sdFechaDesde = dbo.FechaSimple(@sdFechaDesde)
        IF @sdFechHasta IS NOT NULL 
            SET @sdFechHasta = dbo.FechaSimple(@sdFechHasta)
        SELECT
            DB.dep_num AS Co_Doc, DB.deposito, DB.fecha AS Fec_Emis, DB.co_sucu_in AS Co_Sucu_Cont, DB.cod_cta,
            DB.cod_caja, DB.mov_num_b, DB.mov_num_c, 
            ROUND(DB.total_efec *  DB.tasa, 2) AS total_efec,
            ROUND((DB.total_efec + ISNULL(DBR.monto,0))*  DB.tasa, 2) AS monto,
            ROUND((ISNULL(DBR.comision,0) + ISNULL(DBR.impuesto,0))*  DB.tasa, 2) AS comi_imp,
            DB.che_dev, DB.co_cta_ingr_egr, '' AS Co_Auxiliar,
            '' AS Descrip_Auxiliar, DB.feccom, DB.numcom, DB.dis_cen AS dis_cen_saDepositoBanco, DB.tasa, DB.aux01,
            DB.aux02, DB.activado, DB.campo1, DB.campo2, DB.campo3, DB.campo4, DB.campo5, DB.campo6, DB.campo7,
            DB.campo8, DB.co_us_in, DB.co_sucu_in, DB.fe_us_in, DB.co_us_mo, DB.co_sucu_mo, DB.fe_us_mo, DB.revisado,
            DB.trasnfe, DB.validador, DB.rowguid, CC.dis_cen AS dis_cen_saCaja, CB.dis_cen AS dis_cen_saCuentaBancaria,
            CIE.dis_cen AS dis_cen_saCuentaIngEgr, CB.co_mone, MO.mone_des, MO.relacion AS mone_relacion
        FROM
            saDepositoBanco AS DB
            LEFT JOIN (SELECT dep_num, SUM(monto) AS monto, SUM(comision) AS comision, SUM(impuesto) AS impuesto
            FROM saDepositoBancoReng GROUP BY dep_num) DBR ON DB.dep_num = DBR.dep_num
            LEFT JOIN saCaja AS CC ON DB.cod_caja = CC.cod_caja
            LEFT JOIN saCuentaIngEgr AS CIE ON DB.co_cta_ingr_egr = CIE.co_cta_ingr_egr
            LEFT JOIN saCuentaBancaria AS CB ON DB.cod_cta = CB.cod_cta
            INNER JOIN saMoneda AS MO ON CB.co_mone = MO.co_mone
        WHERE
            --(DATEDIFF(DAY, DB.fecha , @sdFechaDesde) <= 0 AND DATEDIFF(DAY, DB.fecha , @sdFechHasta) >= 0)
            ( ( @sdFechaDesde IS NULL
                OR dbo.FechaSimple(DB.fecha) >= @sdFechaDesde
              )
              AND ( @sdFechHasta IS NULL
                    OR dbo.FechaSimple(DB.fecha) <= @sdFechHasta
                  )
```
