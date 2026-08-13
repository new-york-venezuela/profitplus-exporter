# SP: pSeleccionarContabilizacionMovimientoCajaDepReng
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCaja`](../tables/saCaja.md)
- [`saDepositoBanco`](../tables/saDepositoBanco.md)
- [`saDepositoBancoReng`](../tables/saDepositoBancoReng.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pSeleccionarContabilizacionMovimientoCajaDepReng]
    (
      @sCo_Doc_Padre CHAR(20) = NULL ,
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
            DBR.dep_num AS Co_Doc_Padre, DBR.reng_num AS Co_Doc, CB.fecha AS Fec_Emis, DBR.codigo, DBR.mov_afec_c,
            DBR.mov_gene_c, '' AS Co_Auxiliar, '' AS Descrip_Auxiliar, DBR.co_sucu_in AS Co_Sucu_Cont, 
            ROUND(DBR.monto * MC1.tasa , 2) AS monto,
            DBR.comision, DBR.impuesto, DBR.tipo_plazo, DBR.co_us_in, DBR.co_sucu_in, DBR.fe_us_in, DBR.co_us_mo,
            DBR.co_sucu_mo, DBR.fe_us_mo, DBR.revisado, DBR.trasnfe, DBR.rowguid, CB.dis_cen AS dis_cen_saCuentaBanco,
            MC.dis_cen AS dis_cen_saMovimientoCajaAfec,MC.forma_pag , MC1.dis_cen AS dis_cen_saMovimientoCajaGene,
            CC.dis_cen AS dis_cen_saCaja, CC.co_mone, CB.tasa
        FROM
            saDepositoBancoReng AS DBR
            INNER JOIN saDepositoBanco AS CB ON DBR.dep_num = CB.dep_num
            INNER JOIN saMovimientoCaja AS MC ON DBR.mov_afec_c = MC.mov_num
            INNER JOIN saMovimientoCaja AS MC1 ON DBR.mov_gene_c = MC1.mov_num
            INNER JOIN saCaja AS CC ON MC.cod_caja = CC.cod_caja
        WHERE
            DBR.dep_num = @sCo_Doc_Padre
        ORDER BY
            Fec_Emis ASC, Co_Doc ASC
    END
```
