# SP: RepMovimientoInventarioxArticuloXlote
**Tipo**: Reporte
**Módulo**: Inventario

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date: <10/09/2010>
 Modify date: <12/01/2018>
 Last Update: 2021-02-20
 Description:	<Movimientos de Inventarios por Articulo X Lote Asignados>
=============================================*/
CREATE PROCEDURE [dbo].[RepMovimientoInventarioxArticuloXlote]
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @dCo_fecha_d DATETIME = NULL ,
    @dCo_fecha_h DATETIME = NULL ,
    @sCo_Almacen CHAR(6) = NULL ,
	@sCo_Sucursal CHAR(6) = NULL ,
    @sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @sCo_Categoria_d CHAR(6) = NULL ,
    @sCo_Categoria_h CHAR(6) = NULL ,
    @sCo_Movimiento CHAR(4) = NULL ,
	 @sNumero_Lote_d CHAR(20) = NULL ,
	 @sNumero_Lote_h  CHAR(20) = NULL ,
    @sAsignacion CHAR(20) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;


        IF ( @sCo_Movimiento IS NULL  OR @sCo_Movimiento = 'TODO'
           ) 
            SET @sCo_Movimiento = NULL

        IF @sAsignacion IS NULL 
            SET @sAsignacion = '4'

        IF @dCo_fecha_h IS NOT NULL 
            SET @dCo_fecha_h = DATEADD(ss, -1, DATEADD(day, 1, @dCo_fecha_h))


        SET @dCo_fecha_d = dbo.fechasimple(@dCo_fecha_d)
        SET @dCo_fecha_h = dbo.fechasimple(@dCo_fecha_h)

 

     
     
        DECLARE @temp TABLE
            (
			  co_art char (50), 
			  art_des char (50),
			  total_art decimal (18,8),
			  total_art_entrada    decimal (18,8),
			  total_art_salida	    decimal (18,8),
			  co_uni char (50),
			  total            decimal (18,8),
			  total_entrada	    decimal (18,8),
			  total_salida     decimal (18,8),
			  co_uni_base char (50),
			  co_alma char (50),
			  fecha smalldatetime,
			  reng_num int ,
			  doc_num char (20),
			  anulado bit ,
			  co_prov char (50),
			  co_cli char (50),
			  tipo Char(50),
			  numero_lote char (20) ,
			  StockInic   decimal (18,8),
			  StockFinal  decimal (18,8),
			  detalle char (50),
			  Existencia int,
			  TipoE char (1),
			  rowguid uniqueidentifier 
			)
			DECLARE
			 @co_art char (50), 
			 @art_des char (50),
			 @total_art decimal (18,8),
			 @total_art_entrada    decimal (18,8),
			 @totalart_salida	    decimal (18,8),
			 @co_uni char (50),
			 @total            decimal (18,8),
			 @total_entrada	    decimal (18,
```
