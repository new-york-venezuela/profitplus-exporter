# SP: RepAjusteESXArticulo
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <14/05/2010>
-- Description:	<Ajuste de Entrada y Salida Por Artículo>
-- =============================================
CREATE PROCEDURE [dbo].[RepAjusteESXArticulo] 
	-- Add the parameters for the stored procedure here
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @sCo_Numero_d CHAR(20) = NULL ,
    @sCo_Numero_h CHAR(20) = NULL ,
    @sCo_Fecha_d SMALLDATETIME = NULL ,
    @sCo_Fecha_h SMALLDATETIME = NULL ,
    @sCo_TipoAjuste CHAR(6) = NULL ,
    @sCo_Almacen_d CHAR(6) = NULL ,
    @sCo_Almacen_h CHAR(6) = NULL ,
    @sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @sCo_Categoria_d CHAR(6) = NULL ,
    @sCo_Categoria_h CHAR(6) = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
    @sCo_Anulado CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
    
        DECLARE @bRelacionMoneFiltro BIT ;

        IF ( @sCampOrderBy IS NULL ) 
            SET @sCampOrderBy = 'co_art'

        IF ( @sDir IS NULL ) 
            SET @sDir = 'ASC'

        IF ( @sCo_Anulado IS NULL ) 
            SET @sCo_Anulado = 'TODO' 
	
        SET @bRelacionMoneFiltro = ( SELECT
                                        relacion
                                     FROM
                                        saMoneda
                                     WHERE
                                        co_mone = @sCo_Moneda
                                   )
        SELECT
           CAST(CASE WHEN ( @sCo_Moneda IS NOT NULL )
                      THEN CASE WHEN ( @bRelacionMoneFiltro = 1 ) THEN AJ.tasa * AJR.cost_unit
                                ELSE AJR.cost_unit / AJ.tasa
                           END
                      ELSE AJR.cost_unit
                 END AS DECIMAL(18, 5)) AS FilMonePreciO,
				 
	        CASE WHEN TA.tipo_trans = 1 THEN AJR.total_art * -1
                 ELSE AJR.total_art END AS Total_art_reng,

            CASE WHEN ( TA.tipo_trans = 1 ) THEN ( dbo.ObtenerCostoPromedioPonderado(AJR.rowguid) )
                 ELSE AJR.cost_unit
            END  / ( CASE WHEN @sCo_Moneda IS NULL THEN 1
            ELSE AJ.tasa
            END ) AS Costo_Unit_reng, ART.modelo, ART.art_des, @sCo_Anulado AS FiltroAnulado, AJ.*, AJR.*

        FROM
```
