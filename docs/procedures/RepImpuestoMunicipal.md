# SP: RepImpuestoMunicipal
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saImpMun`](../tables/saImpMun.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <24-02-11>
-- Description:	<Reporte de Impuesto Municipal>
-- =============================================
CREATE PROCEDURE [RepImpuestoMunicipal]
    @sNumero_d CHAR(6) = NULL ,
    @sNumero_h CHAR(6) = NULL ,
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @sCo_lin_d CHAR(6) = NULL ,
    @sCo_lin_h CHAR(6) = NULL ,
    @sCo_sblin_d CHAR(6) = NULL ,
    @sCo_sblin_h CHAR(6) = NULL ,
    @sCo_cat_d CHAR(6) = NULL ,
    @sCo_cat_h CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
		
		IF @dFecha_h IS NOT NULL 
            SET @dFecha_h =  (DATEADD(ss, -60, DATEADD(day, 1, @dFecha_h)))
		
        SELECT
            IM.co_imun, '1' AS co_art, ISNULL(IM.imp_des, 'No posee Impuesto Municipal') AS imp_des, IM.co_sucur,
            IM.alicuota,
            SUM(ISNULL(( ( FVR.prec_vta * FVR.total_art ) - FVR.monto_desc - FVR.monto_desc_glob + FVR.monto_reca_glob
                         + FVR.otros1_glob + FVR.otros2_glob + FVR.otros3_glob ), 0)) AS total
        FROM
            saFacturaVentaReng AS FVR
            INNER JOIN saFacturaVenta AS FV ON FV.doc_num = FVR.doc_num
                                               AND FV.anulado = 0
            INNER JOIN saArticulo AS A ON FVR.co_Art = A.co_Art
            LEFT  JOIN saImpMun AS IM ON IM.co_sucur = (CASE WHEN ((SELECT v_maneja_sucursales FROM par_emp)= 1) THEN  FV.co_sucu_in ELSE (SELECT IMP.co_sucur FROM saImpMun IMP where IMP.co_imun = (select [dbo].[ObtenerImpuestoMunicipal](A.co_art))) END)
                                         AND [dbo].[ObtenerImpuestoMunicipal](A.co_art) = IM.co_imun
        WHERE
            ( @dFecha_d IS NULL
              OR FV.fec_emis >= @dFecha_d
            )
            AND ( @dFecha_h IS NULL
                  OR FV.fec_emis <= @dFecha_h
                )
            AND ( @sNumero_d IS NULL
                  OR IM.co_imun >= @sNumero_d
                )
            AND ( @sNumero_h IS NULL
                  OR IM.co_imun <= @sNumero_h
                )
            AND ( @sCo_art_d IS NULL
                  OR FVR.co_art >= @sCo_art_d
                )
            AND ( @sCo_art_h IS NULL
```
