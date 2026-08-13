# SP: pSeleccionarContabilizacionTrasladoReng
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/09/2010>
-- Last Update: 2017-08-03
-- Description:	<pSeleccionarContabilizacionTrasladoReng>
-- =============================================
CREATE PROCEDURE [dbo].[pSeleccionarContabilizacionTrasladoReng]
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

        SELECT
            TRR.tras_num AS Co_Doc_Padre, TRR.reng_num AS Co_Doc, TR.fecha AS Fec_Emis, '' AS Co_Auxiliar,
            '' AS Descrip_Auxiliar, TRR.co_sucu_in AS Co_Sucu_Cont, TRR.co_art, TRR.total_art, TRR.stotal_art,
            TRR.co_uni, TRR.sco_uni, TRR.cost_unit, --TRR.cost_unit_om,
            TRR.lote_asignado, TRR.dis_cen AS dis_cen_saTrasladoReng, TR.co_us_in, TR.co_sucu_in, TR.fe_us_in,
            TR.co_us_mo, TRR.co_sucu_mo, TRR.fe_us_mo, TRR.revisado, TRR.trasnfe, TRR.validador, TRR.rowguid,
            TRR.costo_adi1, TRR.costo_adi2, TRR.costo_adi3, TR.co_mone, MO.mone_des, MO.relacion AS mone_relacion,
            AR.dis_cen AS dis_cen_saArticulo, TR.dis_cen AS dis_cen_saTraslado, TR.tasa
        FROM
            saTrasladoReng AS TRR
            INNER JOIN saTraslado AS TR ON TRR.tras_num = TR.tras_num
            INNER JOIN saMoneda AS MO ON TR.co_mone = MO.co_mone
            LEFT JOIN saArticulo AS AR ON TRR.co_art = AR.co_art
        WHERE
	
		TRR.tras_num = @sCo_Doc_Padre

        ORDER BY
            Fec_Emis ASC, Co_Doc ASC
    END
```
