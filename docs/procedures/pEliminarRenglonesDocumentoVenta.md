# SP: pEliminarRenglonesDocumentoVenta
**Tipo**: Eliminar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVentaReng`](../tables/saDocumentoVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pEliminarRenglonesDocumentoVenta
DESCRIPCION	: Inserta un registro de la tabla saDocumentoVentaReng
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pEliminarRenglonesDocumentoVenta]
    (
      @iReng_NumOri INT ,
      @sCo_Tipo_DocOri CHAR(6) ,
      @sNro_DocOri CHAR(20) ,
      @sCo_Us_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @gRowguid UNIQUEIDENTIFIER = NULL
    )
AS 
    BEGIN
		
        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )

        DELETE FROM
            saDocumentoVentaReng
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            nro_doc = @sNro_DocOri
            AND co_tipo_doc = @sCo_Tipo_DocOri
            AND reng_num = @iReng_NumOri	
		
        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
		DECLARE @sCampos varchar(max)
		set @sCampos  =  ltrim(rtrim(@sNro_DocOri)) +' [TipoDoc:'+  ltrim(rtrim(@sCo_Tipo_DocOri))+']' +' [NumReng:'+  ltrim(rtrim(@iReng_NumOri))+']'

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_De IS NOT NULL 
            BEGIN
		-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saDocumentoVentaReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E',
                    @sMaquina = @sMaquina, @sCampos = @sCampos --@sCo_Tipo_DocOri
            END

    END
```
