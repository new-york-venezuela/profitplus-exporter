# SP: pObtenerCostoManual
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerCostoManual]
DESCRIPCION: Obtiene el costo manual para un artículo de un almacén
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerCostoManual]
    (
      @gRowguid_Articulo UNIQUEIDENTIFIER ,
      @sCod_Manual CHAR(6) ,
      @sCod_Almacen CHAR(6) = NULL ,
      @sdFecha_Desde SMALLDATETIME = NULL ,
      @sdFecha_Hasta SMALLDATETIME = NULL
	
    )
AS 
    BEGIN	

        DECLARE @SqlString NVARCHAR(MAX)

        SET @SqlString = N'SELECT *, ''Manual'' as documento
			FROM saCostoHistoricoEntrada e
			WHERE e.cod_articulo_rowguid = ''' + CONVERT(NVARCHAR(100), @gRowguid_Articulo)
            + ''' and tipo_doc = ''' + CONVERT(NVARCHAR(6), @sCod_Manual) + '''' ;

        IF ( @sCod_Almacen IS NOT NULL ) 
            BEGIN
                SET @SqlString = @SqlString + N' and e.cod_almacen = ''' + CONVERT(NVARCHAR(6), @sCod_Almacen) + '''' ;
            END

        IF ( @sdFecha_Desde IS NOT NULL
             AND @sdFecha_Hasta IS NOT NULL
           ) 
            BEGIN
                SET @SqlString = @SqlString + N' and (e.fecha_emision >=''' + CONVERT(NVARCHAR(100), @sdFecha_Desde, 121)
                    + '''' ; 
                SET @SqlString = @SqlString + N' and e.fecha_emision <=''' + CONVERT(NVARCHAR(100), @sdFecha_Hasta, 121)
                    + ''')' ;
            END

        SET @SqlString = @SqlString + N' ORDER BY e.fecha_emision DESC' ;

        EXEC sp_executesql @SQLString
    END
```
