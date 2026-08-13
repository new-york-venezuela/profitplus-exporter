# SP: pv_ObtenerArticulo
**Tipo**: Punto de Venta
**Módulo**: Inventario

## Tablas Referenciadas
- [`pvParEmp`](../tables/pvParEmp.md)
- [`saArtImagen`](../tables/saArtImagen.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saStockAlmacen`](../tables/saStockAlmacen.md)
- [`saTipoCliente`](../tables/saTipoCliente.md)

## Código (excerpt)
```sql
/**************************************************************************
		*NOMBRE			: [pv_ObtenerArticulo]
		*DESCRIPCIÓN	: SELECCIONA LOS PRIMEROS 100 ARTICULOS FILTRADOS POR CODIGO, DESCRIPCION, 
						  MODELO, REFERENCIA SIN ANULAR Y DEL TIPO SERVICIO O VENTA
		*AUTOR			: SOFTECH SISTEMAS
		**************************************************************************/
		CREATE PROCEDURE [dbo].[pv_ObtenerArticulo]
(
       @co_art                           CHAR(30)            = NULL,
       @art_des                   VARCHAR(120) = NULL, 
       @modelo                           VARCHAR(20)         = NULL,
       @ref                       VARCHAR(20)         = NULL,
       @sTipo_Cli                 CHAR(6)                    = NULL, 
       @dtFecha                   SMALLDATETIME = NULL, 
       @co_almacen                CHAR(6)                    = NULL
)
AS
BEGIN
    DECLARE @cod_art_aux   VARCHAR(32)
       DECLARE @art_des_aux       VARCHAR(122)
       DECLARE @modelo_aux        VARCHAR(32) 
       DECLARE @ref_aux           VARCHAR(22) 
       DECLARE @co_precio         CHAR(6) 
       DECLARE @co_imagen         CHAR(6) 
                           
       if @dtFecha IS NULL
             SET @dtFecha = GETDATE()

       SET @cod_art_aux = RTRIM(LTRIM(@co_art))+'%'
       SET @modelo_aux = '%'+RTRIM(LTRIM(@modelo))+'%'
       SET @art_des_aux = '%'+RTRIM(LTRIM(@art_des))+'%'
       SET @ref_aux = '%'+RTRIM(LTRIM(@ref))+'%'
       
       SELECT @co_precio = co_precio
             FROM saTipoCliente 
                    WHERE tip_cli = @sTipo_Cli
       
       SELECT @co_imagen = co_imagen
             from pvParEmp
       
       SELECT  TOP 100
             LTRIM(RTRIM(a.co_art)) co_Art,
             LTRIM(RTRIM(a.art_des)) art_des,
             LTRIM(RTRIM(modelo)) modelo,
             LTRIM(RTRIM(ref)) ref,
             dbo.PrecioAUnaFecha(LTRIM(RTRIM(a.co_art)), @dtFecha, @co_precio, @co_almacen,NULL,0,1,NULL) prec_vta1,
             A.tipo_imp,
             AU.co_uni uni,
             0.0 descuento,
             A.maneja_serial serial,
             A.maneja_lote,      
             A.maneja_lote fec_lote,
             0 SerDesp,
             AI.imagen_des,
             AU.co_uni uni_venta,
             AUS.co_uni suni_venta,
             prec_om AS PrecioOtraMoneda,
             --[dbo].[ConsultarStockActualxAlmacen](RTRIM(a.co_art),@co_almacen) AS stock,
             ISNULL(ST.sto
```
