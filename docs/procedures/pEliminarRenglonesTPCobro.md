# SP: pEliminarRenglonesTPCobro
**Tipo**: Eliminar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobroTPReng`](../tables/saCobroTPReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pEliminarOrdenCobro
DESCRIPCION	: Elimina un registro de la tabla saCobroTPReng
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarRenglonesTPCobro]
    (
      @sCob_NumOri CHAR(20) ,
      @iReng_NumOri INT ,
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
            saCobroTPReng
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            Cob_num = @sCob_numOri
            AND reng_num = @iReng_NumOri	
		
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
                    @sTablaOri = 'saCobroTPReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCob_numOri
            END

    END
```
