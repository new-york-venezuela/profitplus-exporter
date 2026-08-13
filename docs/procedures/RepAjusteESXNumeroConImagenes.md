# SP: RepAjusteESXNumeroConImagenes
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <17/05/2010>
-- Description:	<Ajuste de Entrada y Salida Por Numero>
-- =============================================
CREATE PROCEDURE [dbo].[RepAjusteESXNumeroConImagenes] 
	-- Add the parameters for the stored procedure here
    @sCo_Numero_d CHAR(20) = NULL ,
    @sCo_Numero_h CHAR(20) = NULL ,
    @sCo_Fecha_d SMALLDATETIME = NULL ,
    @sCo_Fecha_h SMALLDATETIME = NULL ,
	@sCo_tipo_img_d char(6) = NULL,
	@sCo_tipo_img_h char(6) = NULL,
    @sCo_TipoAjuste CHAR(6) = NULL ,
    @sCo_Anulado CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(20) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
    -- Insert statements for procedure here

        DECLARE @sTipo_trans CHAR(6)
---Valores por defecto---
        IF ( @sCampOrderBy IS NULL ) 
            SET @sCampOrderBy = 'ajue_num'

        IF ( @sDir IS NULL ) 
            SET @sDir = 'ASC'

        IF ( @sCo_Anulado IS NULL ) 
            SET @sCo_Anulado = 'TODO' 

        SET @sTipo_trans = ( SELECT
                                tipo_trans
                             FROM
                                saTipoAjuste
                             WHERE
                                co_tipo = @sCo_TipoAjuste
                           )
---Valores por defecto---

        SELECT
		aj.ajue_num, aj.fecha, aj.motivo, aj.co_mone, MO.mone_des,
			  DI.co_imag, DI.des_imag, DI.picture, TI.co_tipo_imag, TI.descrip as descripImagen
        FROM
            saAjuste AS AJ
			INNER JOIN saMoneda MO ON MO.co_mone = AJ.co_mone
			left outer join saDocumentoImagen DI 
			inner join saTipoImagen TI ON DI.co_tipo_imag = TI.co_tipo_imag ON AJ.rowguid = DI.rowguidDoc
        WHERE
		DI.co_tipo_imag is not null and
            ( @sCo_Numero_d IS NULL
              OR AJ.ajue_num >= @sCo_Numero_d
            )
            AND ( @sCo_Numero_h IS NULL
                  OR AJ.ajue_num <= @sCo_Numero_h
                )
            AND ( ( @sCo_fecha_d IS NULL
                    OR DATEADD(dd, 00, AJ.fecha) >= @sCo_fecha_d
                  )
                  AND ( @sCo_fecha_h IS NULL
                        OR DATEDIFF(dd, 00, AJ.fecha) <= @sCo_fecha_h
                      )
                )

            AND ( ( @sCo_Anulado = 'TODO' )
                  OR ( @sCo_Anulado = 'SIT'
```
