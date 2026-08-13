# SP: RepValorActualInventario
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saStockAlmacen`](../tables/saStockAlmacen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<Softech Sistemas>
-- Create date: <24/08/2010>
-- Description:	<Valor Actual del Inventario por Almacen>
-- =============================================
CREATE  PROCEDURE [dbo].[RepValorActualInventario] 
       -- Add the parameters for the stored procedure here
		@sCo_Art_d char(30) = null,
       @sCo_Art_h char(30) = null,
       @sCo_Linea_d char(6) = null,
       @sCo_Linea_h char(6) = null,
       @sCo_Categoria_d char(6) = null,
       @sCo_Categoria_h char(6) = null,
       @sCo_Almacen char(6) = null,
       @sCo_Moneda char(6) = null,
       @iTasa int = null,
       --@dCo_fecha datetime = NULL,
       @sCo_NivelStock char(4)= NULL,
       @sCo_Sucursal char(6) = null,
       @sCriterio char(6) = NULL,
       @sCo_Mone char(6) = null,

       @sCampOrderBy varchar(16) = NULL,
       @sDir varchar(6) = NULL,
       @bHeaderRep bit = 0

AS
BEGIN
       SET NOCOUNT ON;
    -- Insert statements for procedure here
   
if @iTasa is NULL 
       set @iTasa = 1
       
IF @sCo_NivelStock IS NULL        
       SET @sCo_NivelStock  = 'TODO' 
--
if @sCo_Moneda is NULL
       SET @sCo_Moneda = 'BS  '

IF @sCriterio IS NULL
          SET @sCriterio = '1'  

DECLARE @bRelacionMoneFiltro bit;

--Trae la relación de la moneda para saber si divide o multiplica con la tasa
SET @bRelacionMoneFiltro = (SELECT relacion FROM saMoneda WHERE co_mone = @sCo_Moneda )

--SET @dCo_fecha = dbo.fechasimple(@dCo_fecha)

SELECT * FROM (SELECT 
             distinct CASE WHEN @sCriterio = '7' THEN 'SI' ELSE 'NO' END as tipo, 
             A.co_art, A.art_des,
             ALM.co_alma, ALM.des_alma,
             AU.co_uni,
             isnull(@bRelacionMoneFiltro,1) as Relacion,
-- Sit.#818464 (10/11/2016) - HZ-1: Se reactivó la llamada a la función dbo.ConsultarCostoUltimaFecha() por Null
             --isnull(dbo.ConsultarStockActualxAlmacenxFechaxTipoDoc(A.co_art,ALM.co_alma,NULL,null,null),0) as StockActual,
				--isnull(dbo.ConsultarStockActualxAlmacenxFechaxTipoDoc(A.co_art,ALM.co_alma,dbo.ConsultarCostoUltimaFecha(A.rowguid),NULL,null),0) as StockActual,
				--Sit.#16866 rrumbaut: se modifico el proceso de calcular el stock actual para el reporte
					isnull(dbo.ConsultarStockActualxAlmacen(A.co_art,ALM.co_alma),0) as StockActual,
-- FIN Sit.#818464-1
             @iTasa as Tasa, 'criterio' = @sCriterio,
-- Sit.#818464 (10/11/2016) - HZ-2: Se rea
```
