# SP: pActualizarRenglonLoteEntrada
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLoteEntrada`](../tables/saLoteEntrada.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [[pActualizarRenglonLoteEntrada]]
DESCRIPCION: actualiza la información del lote dado su rowguid de origen
	empleado en Store Procedure de actailizar renglones
CREADO POR: SOFTECH SISTEMAS 
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarRenglonLoteEntrada]
    (
      @gRowguid_Reng UNIQUEIDENTIFIER ,
      @sRengNum INT ,
      @sTipo_doc CHAR(4) ,
      @sCoArtOri CHAR(30) ,
      @sCoArtNew CHAR(30) ,
      @sCoAlmaOri CHAR(6) ,
      @sCoAlmaNew CHAR(6) ,
      @sCoUniOri CHAR(6) ,
      @sCoUniNew CHAR(6) ,
      @sTotalArtOri DECIMAL(18, 5) ,
      @sTotalArtNew DECIMAL(18, 5) ,
      @sIsAnulado BIT
    )
AS 
    BEGIN
    
        IF EXISTS ( SELECT  *
                    FROM    dbo.saLoteEntrada
                    WHERE   rowguid_reng = @gRowguid_Reng
                            AND tipo_doc = @sTipo_doc ) 
            BEGIN
                DECLARE @MensajeError VARCHAR(256)
                
                IF @sIsAnulado = 1
                BEGIN
                        SET @MensajeError = 'El renglón '
                            + RTRIM(LTRIM(STR(@sRengNum)))
                            + ' posee lote asignado por lo que el documento no puede ser anulado.'
                        RAISERROR(@MensajeError,16,1)
                        RETURN ;
                    END
                
                IF @sCoArtOri <> @sCoArtNew 
                    BEGIN
                        SET @MensajeError = 'El renglón '
                            + RTRIM(LTRIM(STR(@sRengNum)))
                            + ' posee lote asignado por lo que el código de artículo no puede ser modificado.'
                        RAISERROR(@MensajeError,16,1)
                        RETURN ;
                    END
    
                IF @sCoAlmaOri <> @sCoAlmaNew 
                    BEGIN
                        SET @MensajeError = 'El renglón '
                            + RTRIM(LTRIM(STR(@sRengNum)))
                            + ' posee lote asignado por lo que el código de almacén no puede ser modificado.'
                        RAISERROR(@MensajeError,16,1)
                        RETURN ;
                    END
            
                IF @sCoUniOri <> @sCoUniNew 
                    BEGIN
```
