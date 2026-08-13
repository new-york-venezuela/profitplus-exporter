# SP: RepValorActualInventarioxAlmacen
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
-- Author:        <Softech Consultores>
-- Create date: <24/08/2010>
-- Description:   <Valor Actual del Inventario por Almacen>
-- =============================================
CREATE PROCEDURE [dbo].[RepValorActualInventarioxAlmacen] 
      -- Add the parameters for the stored procedure here
    @sCo_Art_d char(30) = null,
      @sCo_Art_h char(30) = null,
      @sCo_Linea_d char(6) = null,
      @sCo_Linea_h char(6) = null,
      @sCo_Categoria_d char(6) = null,
      @sCo_Categoria_h char(6) = null,
      @sCo_Almacen char(6) = null,
      --@sCo_Almacen_h char(6) = null,
      @sCo_Moneda char(6) = null,
      @iTasa int = null,
      @dCo_fecha datetime = NULL,
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
      
IF @sCo_NivelStock is NULL        
      SET @sCo_NivelStock  = 'DIFE' 
--
if @sCo_Moneda is NULL
      SET @sCo_Moneda = 'BS  '

IF @sCriterio IS NULL
         SET @sCriterio = '1'  

DECLARE @bRelacionMoneFiltro bit;

--Trae la relación de la moneda para saber si divide o multiplica con la tasa
SET @bRelacionMoneFiltro = (SELECT relacion FROM saMoneda WHERE co_mone = @sCo_Moneda )

            IF (@dCo_fecha is not null)
            Begin
                  SET @dCo_fecha = dbo.fechasimple(@dCo_fecha)
                  SET @dCo_fecha = DATEADD(d,1,@dCo_fecha)
                  SET @dCo_fecha = DATEADD(mi,-1,@dCo_fecha)
            ENd

SELECT * FROM (SELECT 
            distinct CASE WHEN @sCriterio = '7' THEN 'SI' ELSE 'NO' END as tipo, 
            A.co_art, A.art_des,
            ALM.co_alma, ALM.des_alma,
            AU.co_uni,
            isnull(@bRelacionMoneFiltro,1) as Relacion,
            isnull(dbo.ConsultarStockActualxAlmacenxFecha(A.co_art,ALM.co_alma,@dCo_fecha,null),0) as StockActual,
            @iTasa as Tasa, 'criterio' = @sCriterio,
            CASE 
            WHEN @sCriterio = '7' THEN 
            ROUND(dbo.ConsultarCostoxAlmacenxFechaPEPSUEPS(A.co_art,ALM.co_alma,@dCo_fecha,AU.co_uni,@sCriterio,@sCo_Moneda),5) 
            ELSE ROUND(dbo.ConsultarCostoxAlmacenxFecha(A.co_art,ALM.co_alma,@dCo_fecha,A
```
