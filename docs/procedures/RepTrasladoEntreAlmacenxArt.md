# SP: RepTrasladoEntreAlmacenxArt
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <28/04/2010>
-- Description:	<Formato de Traslados entre Almacenes Por Artículos>
-- =============================================
CREATE PROCEDURE [dbo].[RepTrasladoEntreAlmacenxArt] 
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
    @sCo_Co_Art_d CHAR(30) = NULL ,
    @sCo_Co_Art_h CHAR(30) = NULL ,
    @sCo_Co_Linea_d CHAR(6) = NULL ,
    @sCo_Co_Linea_h CHAR(6) = NULL ,
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
            @sCo_Anulado AS Filtro_anulado, T.fecha, T.alm_orig, T.alm_dest, T.confirma, T.fec_conf, T.anulado,
            TR.tras_num, TR.reng_num, TR.co_art, TR.total_art, TR.co_uni, AR.modelo, AR.art_des, AR.modelo,
            AORI.des_alma AS des_alma_ori, ADEST.des_alma AS des_alma_tmp,
			Transp.co_tran,
			Transp2.co_tran AS Conductor

        FROM
            saTraslado AS T
            INNER JOIN saTrasladoReng AS TR ON TR.tras_num = T.tras_num
            INNER JOIN saArticulo AS AR ON AR.co_art = TR.co_art
            INNER JOIN saLineaArticulo AS LA ON LA.co_lin = AR.co_lin
            INNER JOIN saAlmacen AS AORI ON AORI.co_alma = T.alm_orig
            LEFT JOIN saAlmacen AS A
```
