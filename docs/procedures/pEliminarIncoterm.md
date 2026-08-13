# SP: pEliminarIncoterm
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saIncoterm`](../tables/saIncoterm.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pEliminarTablaMoneda
DESCRIPCION: Eliminar Tabla Moneda
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pEliminarIncoterm]
    (
      @tsValidador TIMESTAMP = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) = NULL ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL		
	
    )
AS 
    BEGIN  	

        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )
		DECLARE @sCo_IncotermOri CHAR(20)
		SET @sCo_IncotermOri = (SELECT TOP(1) Co_Incoterm FROM saIncoterm WHERE Rowguid = @gRowguid)
        DELETE FROM
            saIncoterm
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            Rowguid = @gRowguid
            AND validador = @tsValidador
    
        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp


        IF @dtFe_De IS NOT NULL 
            BEGIN
		-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saIncoterm', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_IncotermOri
            END
    
    END
```
