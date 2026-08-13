# SP: RepEstadoCuentaCli
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <07-02-11>
-- Last Update: <2019-09-30>
-- Description:	<Estado de cuenta de Clientes>
-- =============================================
CREATE PROCEDURE [dbo].[RepEstadoCuentaCli]
	-- Add the parameters for the stored procedure here


    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_Cli CHAR(16) = NULL ,
    @sCo_Zon_d CHAR(6) = NULL ,
    @sCo_Zon_h CHAR(6) = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
    @sCo_Seg_d CHAR(6) = NULL ,
    @sCo_Seg_h CHAR(6) = NULL ,
    @sTipo_pro CHAR(6) = NULL ,
    @sDetalle CHAR(4) = NULL ,
    @sProve_sin_mov CHAR(4) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;


		DECLARE @fechadiff INT ;
        SET @fechadiff = DATEDIFF(dd, 00, GETDATE()) ;
 
        IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = DATEADD(ss, -60, DATEADD(day, 1, @dFecha_h))

        IF @dFecha_d IS NOT NULL 
            SET @dFecha_d = DATEADD(ss, -60, DATEADD(day, 1, @dFecha_d))
		
		--Sit 737912
		SET @dFecha_h = dbo.FechaSimple(@dFecha_h)
        SET @dFecha_d = dbo.FechaSimple(@dFecha_d)
        
		
        IF ( @sDetalle = 'SI'
             OR @sDetalle IS NULL
           )
            AND ( @sProve_sin_mov = 'NO'
                  OR @sProve_sin_mov IS NULL
                ) 
            SELECT
                A.*, B.*, 'Cliente' AS tipo_rep
            FROM
                ( SELECT   DISTINCT
                    DC.co_tipo_doc AS descrip, '' cob_num, DC.nro_doc, DC.fec_emis, DC.fec_venc, DC.co_tipo_doc,
                    DC.total_neto, 0.00 AS MONTO, DC.saldo, '' AS nro_fact, DC.nro_orig,                   
					
					-->>JN 02/09/2019	                    					 
		CONVERT(DECIMAL(18,2),	ISNULL(		CASE WHEN TD.tipo_mov = 'DE' THEN DC.total_neto
                         ELSE 0.00 END / (CASE WHEN @sCo_Moneda IS NULL THEN 1
						 ELSE DC.tasa END ) * (CASE WHEN DC.anulado = 1 THEN 0 ELSE 1 END ) , 0.00))
					AS tot_debe, 
		CONVERT(DECIMAL(18,2),	ISNULL(		( CASE WHEN TD.tipo_mov = 'CR' THEN DC.total_neto
                       ELSE 0.00
                    END ) / ( CASE WHEN @sCo_Moneda IS NULL THEN 1
									ELSE DC.tasa
								END ) * ( CASE WHEN DC.anulado = 1 THEN 0
											ELSE 1
										END ), 0.00))
```
