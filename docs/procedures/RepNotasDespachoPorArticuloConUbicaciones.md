# SP: RepNotasDespachoPorArticuloConUbicaciones
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUbicacion`](../tables/saArtUbicacion.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saNotaDespachoVenta`](../tables/saNotaDespachoVenta.md)
- [`saNotaDespachoVentaReng`](../tables/saNotaDespachoVentaReng.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saUbicacion`](../tables/saUbicacion.md)

## Código (excerpt)
```sql
/*============================================================
 Author:		SOFTECH SISTEMAS
 Create date:	<13-06-16>
 Description:	<Notas de Despacho x Artículo con su Ubicación>
 =============================================================*/
CREATE PROCEDURE [dbo].[RepNotasDespachoPorArticuloConUbicaciones]
	-- Add the parameters for the stored procedure here
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
	@dCo_Fecha_d SMALLDATETIME = NULL ,
    @dCo_Fecha_h SMALLDATETIME = NULL ,
	@sCo_Cli_d CHAR(16) = NULL ,
	@sCo_Cli_h CHAR(16) = NULL ,
	@sCo_Ven_d CHAR(6) = NULL ,
	@sCo_Ven_h CHAR(6) = NULL ,
	@sCo_Lin_d CHAR(6) = NULL ,
	@sCo_Lin_h CHAR(6) = NULL ,
	@sCo_Sub_d CHAR(6) = NULL ,
	@sCo_Sub_h CHAR(6) = NULL ,
	@sCo_Cat_d CHAR(6) = NULL ,
	@sCo_Cat_h CHAR(6) = NULL ,
    @sCo_Alma_d CHAR(6) = NULL ,
    @sCo_Alma_h CHAR(6) = NULL ,
	@sCo_Trans_d CHAR (6) = NULL ,
	@sCo_Trans_h CHAR (6) = NULL ,
	@sCo_Conduc_d CHAR (6) = NULL ,
	@sCo_Conduc_h CHAR (6) = NULL ,
    @sCo_Anul CHAR(4) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
		
        IF ( @sDir IS NULL ) 
            SET @sDir = 'ASC'

        IF ( @sCampOrderBy IS NULL ) 
            SET @sCampOrderBy = 'doc_num'
		
        IF @dCo_Fecha_d IS NOT NULL 
            SET @dCo_Fecha_d = dbo.FechaSimple(@dCo_Fecha_d)
        IF @dCo_Fecha_h IS NOT NULL 
            SET @dCo_Fecha_h = dbo.FechaSimple(@dCo_Fecha_h)
	 
        IF @sCo_Anul IS NULL 
            SET @sCo_Anul = 'TODO'
	 
        DECLARE @sCo_Anul2 BIT
	 
        IF @sCo_Anul = 'SIT' 
            SET @sCo_Anul2 = 1
        IF @sCo_Anul = 'NOT' 
            SET @sCo_Anul2 = 0
	 

        SELECT
			Nota.doc_num, Nota.co_cli, Nota.co_ven, Nota.fec_emis,
            Reng.reng_num, Reng.co_alma, Reng.co_art, Art.modelo, Art.art_des,
			Reng.co_uni, Reng.total_art,
			Ub1.co_ubicacion, Ub1.des_ubicacion,
			Ub2.co_ubicacion, Ub2.des_ubicacion,
			Ub3.co_ubicacion, Ub3.des_ubicacion,
			AU.orden,
			Nota.co_tran,
			Nota.co_conductor

        FROM
            saNotaDespachoVenta AS Nota
            JOIN saNotaDespachoVentaReng AS Reng ON Nota.doc_num = Reng.doc_num
			JOIN saArticulo AS Art ON Reng.co_art = Art.co_art
			LEFT JOIN saArtUbicacion AS AU ON Art.co_art = AU.co_art AND AU.co_alma = Reng.co_alma		
			LEFT JOIN saUbicacion AS Ub1 ON AU.co_ubicacion = Ub1.co_
```
