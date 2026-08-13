# SP: pObtenerListaCosto
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerUltimoCosto]
DESCRIPCION: OBTIENE UNA LISTA DE LOS COSTOS DE UN ARTICULO DADO, COSTO POR REPOSICION, PROVEEDOR O ULTIMO COSTO (PARA ARTICULOS DE SERVICIO)
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerListaCosto]
    (
      @gRowguid_Articulo	UNIQUEIDENTIFIER ,
      @sCod_Almacen			CHAR(6)					= NULL ,
      @sdFecha_Desde		SMALLDATETIME			= NULL ,
      @sdFecha_Hasta		SMALLDATETIME			= NULL ,
      @sCod_Uni				CHAR(6)					= NULL ,
      @sTipoCosto			CHAR(2)					= NULL ,  -- 1 ULTIMO, 5 REPOSICION, 6 PROVEEDOR
      @sCo_Mone				CHAR(6)					= NULL
    )
AS 
    BEGIN	
        DECLARE @Total_ArtUniPrim DECIMAL(18, 5)
	
        IF ( @sTipoCosto IS NULL ) 
            BEGIN
                SELECT
                    @sTipoCosto = tipo_cos
                FROM
                    saArticulo
                WHERE
                    rowguid = @gRowguid_Articulo
            END
	
        IF ( @sCod_Uni IS NOT NULL ) 
            SET @Total_ArtUniPrim = dbo.ArtUnidadBase(( SELECT
                                                            co_art
                                                        FROM
                                                            saArticulo
                                                        WHERE
                                                            rowguid = @gRowguid_Articulo
                                                      ), @sCod_Uni, 1)
		
        IF ( @Total_ArtUniPrim IS NULL ) 
            SET @Total_ArtUniPrim = 1

        SELECT 
            cod_costo_historico_entrada, cod_articulo_rowguid, cod_almacen, tipo_doc, doc_orig, cantidad, cantidad_usada,
            ROUND(@Total_ArtUniPrim * costo * CASE WHEN @sCo_Mone IS NULL THEN 1
                                                 ELSE 1 / dbo.TasaProceso(e.doc_orig, e.tipo_doc, @sCo_Mone)
                                            END, 5) costo, fecha_emision, fecha_registro, fecha_recepcion, rengNum,
            validador, CASE e.tipo_doc
                         WHEN 'AJUS' THEN 'Ajuste'
                         WHEN 'TRAS' THEN 'Traslado'
                         WHEN 'GCOM' THEN 'Compuesto'
                         WHEN 'REPO' THEN 'Reposición'
```
