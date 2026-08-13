# SP: pEliminarRenglonesLoteSalida
**Tipo**: Eliminar
**Módulo**: Inventario

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saLoteSalida`](../tables/saLoteSalida.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pEliminarRenglonesLoteSalida]
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS 
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pEliminarRenglonesLoteSalida]
    (
      @gRowguid_RengOri UNIQUEIDENTIFIER ,
      @iReng_NumOri INT ,
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

        DELETE FROM
            saLoteSalida
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            rowguid_reng = @gRowguid_RengOri
            AND reng_num = @iReng_NumOri

		DECLARE @Tipo_Doc CHAR(4)
		SET @Tipo_Doc = 
		(
			SELECT
				tipo_doc
			FROM
				saLoteSalida
			WHERE
				rowguid_reng = @gRowguid_RengOri
				AND reng_num = @iReng_NumOri
		)
		
		DECLARE @TipoCosto CHAR(1) 
        SELECT
            @TipoCosto = i_costo_inventario
        FROM
            par_emp

		EXEC [dbo].[pCostoActualizarSalida] @RowGuid_Doc_Orig = @gRowguid_RengOri, @strTipo_doc = @Tipo_Doc,
                    @TipoCosto = @TipoCosto

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
                    @sTablaOri = 'saLoteSalida', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @gRowguid_RengOri
            END
    END
```
