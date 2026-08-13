# SP: pObtenerResInventario
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saAlmacen`](../tables/saAlmacen.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saInventarioFisico`](../tables/saInventarioFisico.md)
- [`saResInventario`](../tables/saResInventario.md)
- [`saResInventarioReng`](../tables/saResInventarioReng.md)

## Código (excerpt)
```sql
/*******************************************************************************************************************
*NOMBRE			: [pObtenerResInventario]
*DESCRIPCIÓN	: obtiene el numero de resultado de inventario a partir del codigo de inventario fisico asociado
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2022-01-27
*******************************************************************************************************************/


CREATE PROCEDURE [dbo].[pObtenerResInventario]
    (
      @sCo_InvFisico CHAR(20) ,
      @bCeroNoIngresados BIT = 0
    )
AS 
    BEGIN
        DECLARE @Fecha AS DATETIME
		DECLARE @FechaF AS DATETIME
        DECLARE @intDecimalesStock AS INT
        DECLARE @MoneBase AS CHAR(6)

        SELECT
            @Fecha = IFIS.inicio, @FechaF = IFIS.cierre
        FROM
            saInventarioFisico IFIS
        WHERE
            IFIS.co_invfisico = @sCo_InvFisico

        SELECT
            @intDecimalesStock = i_dec_stock, @MoneBase = g_moneda
        FROM
            par_emp
-- No se debe permitir dos articulos y almacenes ingresados a fechas distintas
        SELECT
            R.co_art, E.co_alma, R.co_uni, SUM(R.total_art) AS total_art_real,
           CONVERT(DECIMAL(18,5) , ROUND(dbo.ConsultarStockActualxAlmacenxFecha(R.co_art, E.co_alma, E.fecha, NULL) / dbo.ArtUnidadBase(R.co_art,
                                                                                                        R.co_uni, 1),
                  @intDecimalesStock) )
				  
				  AS total_art_teorico,SUM(R.stotal_art) AS stotal_art_real,
                   ROUND(dbo.ConsultarStockActualxAlmacenxFechaSecundiario(R.co_art, E.co_alma, E.fecha, NULL) ,
                  @intDecimalesStock) AS stotal_art_teorico,
                   @MoneBase AS co_mone,
            dbo.[ObtenerUltimoCosto](R.co_art, E.co_alma, E.fecha, R.co_uni) AS costo,R.sco_uni
        FROM
            dbo.saResInventarioReng R
            INNER JOIN saResInventario E ON R.num_resinv = E.num_resinv
        WHERE
            E.co_invfisico = @sCo_InvFisico
        GROUP BY
            R.co_art, E.co_alma, E.fecha, R.co_uni,R.sCo_uni
        UNION
        SELECT
            ARTI.co_art, ARTI.co_alma, U.co_uni, 0.00000 AS total_art_real, 
           CONVERT(DECIMAL(18,5) , ROUND(dbo.ConsultarStockActualxAlmacenxFecha(ARTI.co_art, ARTI.co_alma, @FechaF, NULL)
                  / dbo.ArtUnidadBase(ARTI.co_art, U.co_uni, 1), @intDecimalesStock)
```
