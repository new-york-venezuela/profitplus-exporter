# SP: RepTrasladoEntreAlmacenxNum
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saTraslado`](../tables/saTraslado.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <26/04/2010>
-- Description:	<Formato de Traslados entre Almacénes por Número>
-- =============================================
CREATE PROCEDURE [dbo].[RepTrasladoEntreAlmacenxNum] 
	-- Add the parameters for the stored procedure here
    @sCo_Numero_d CHAR(20) = NULL ,
    @sCo_Numero_h CHAR(20) = NULL ,
    @dCo_FechaEmi_d SMALLDATETIME = NULL ,
    @dCo_FechaEmi_h SMALLDATETIME = NULL ,
    @dCo_FechaConf_d SMALLDATETIME = NULL ,
    @dCo_FechaConf_h SMALLDATETIME = NULL ,
    @sCo_AlmacenOri_d CHAR(6) = NULL ,
    @sCo_AlmacenOri_h CHAR(6) = NULL ,
    @sCo_AlmacenDest_d CHAR(6) = NULL ,
    @sCo_AlmacenDest_h CHAR(6) = NULL ,
	@sCo_Transporte_d CHAR(6) = NULL ,
    @sCo_Transporte_h CHAR(6) = NULL ,
	@sCo_Conductor_d CHAR (6) = NULL ,
	@sCo_Conductor_h CHAR (6) = NULL ,
    @sCo_Confirmado CHAR(6) = NULL ,
    @sCo_Anulado CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0

AS 
    BEGIN
        SET NOCOUNT ON ;
    -- Insert statements for procedure here
    
        IF ( @sCo_Confirmado IS NULL ) 
            SET @sCo_Confirmado = 'TODO'

        IF ( @sCo_Anulado IS NULL ) 
            SET @sCo_Anulado = 'TODO'

        IF @dCo_FechaEmi_h IS NOT NULL 
            SET @dCo_FechaEmi_h = DATEADD(ss, -1, DATEADD(day, 1, @dCo_FechaEmi_h))

        IF @dCo_FechaConf_h IS NOT NULL 
            SET @dCo_FechaConf_h = DATEADD(ss, -1, DATEADD(day, 1, @dCo_FechaConf_h))

        SELECT
            @sCo_Anulado AS Filtro_anulado, *, AORI.des_alma AS des_alma_ori, ATEMP.des_alma AS des_alma_tmp,
            ADES.des_alma AS des_alma_dest,
			Transp.co_tran,
			Transp2.co_tran AS Conductor
        FROM
            saTraslado AS T
            INNER JOIN saAlmacen AS AORI ON AORI.co_alma = T.alm_orig
            LEFT JOIN saAlmacen AS ATEMP ON ATEMP.co_alma = T.alm_tmp
            LEFT JOIN saAlmacen AS ADES ON ADES.co_alma = T.alm_dest

			LEFT JOIN saTransporte AS Transp ON T.co_tran = Transp.co_tran
			LEFT JOIN saTransporte AS Transp2 ON T.co_cond = Transp2.co_tran

        WHERE
            ( @sCo_Numero_d IS NULL
              OR T.tras_num >= @sCo_Numero_d
            )
            AND ( @sCo_Numero_h IS NULL
                  OR T.tras_num <= @sCo_Numero_h
                )
            AND ( @dCo_FechaEmi_d
```
