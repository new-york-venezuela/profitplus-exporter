# SP: pActualizarTablaFacturaVentaExt
**Tipo**: Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`pvFacturaVentaExt`](../tables/pvFacturaVentaExt.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pActualizarTablaFacturaVentaExt]
    @rowguidFact UNIQUEIDENTIFIER,
    @bActualizarTablaExt BIT,
    @sCo_Us_Mo VARCHAR(50),
  
    @sCo_Sucu_Mo VARCHAR(50),
    @sMaquina VARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @TableTimestampTablaExt TABLE (
	    estadoAnterior VARCHAR(10) , 
        validador VARCHAR(50),
        fe_us_in DATETIME,
        fe_us_mo DATETIME,
        rowguid UNIQUEIDENTIFIER 
		
    );

    UPDATE pvFacturaVentaExt
    SET estado = 'P'
    OUTPUT 
	Deleted.estado AS estadoAnterior,
	Inserted.validador, 
	Inserted.fe_us_in, 
	Inserted.fe_us_mo,
	Inserted.rowguid
    INTO @TableTimestampTablaExt
    WHERE rowguid_doc_num = @rowguidFact;

    DECLARE @dtFe_In2 DATETIME;
    DECLARE @rowGuidOri2 UNIQUEIDENTIFIER;
    DECLARE @sPistaMensaje2 VARCHAR(MAX);

	DECLARE @estadoAnterior VARCHAR(10);

    SELECT
        @dtFe_In2 = fe_us_in,
        @rowGuidOri2 = rowguid ,  @estadoAnterior = estadoAnterior
    FROM @TableTimestampTablaExt;

    -- Si se actualizó correctamente
    IF @dtFe_In2 IS NOT NULL
    BEGIN
        SET @sPistaMensaje2 = 'Act. estado Procesado Tabla Extendida';

        IF @bActualizarTablaExt = 1
        BEGIN
            SET @sPistaMensaje2 = @sPistaMensaje2 + ' [Estado]: ' + @estadoAnterior + ' -> P';

            EXEC [pInsertarPista]
                @sUsuario_Id = @sCo_Us_Mo,
                @dtFecha = @dtFe_In2,
                @sCo_Sucu = @sCo_Sucu_Mo,
                @sTablaOri = 'pvFacturaVentaExt',
                @rowguidOri = @rowGuidOri2,
                @sTipo_Op = 'M',
                @sMaquina = @sMaquina,
                @sCampos = @sPistaMensaje2;
        END
    END
END
```
