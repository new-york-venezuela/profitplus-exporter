# SP: pEliminarImpuestoMunicipal
**Tipo**: Eliminar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saImpMun`](../tables/saImpMun.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarImpuestoMunicipal
DESCRIPCION: Seleccionar Impuesto  Municipal
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarImpuestoMunicipal]
    (
      @sCo_ImunOri CHAR(15) ,
      @sCo_SucurOri CHAR(6) ,
      @tsValidador TIMESTAMP ,
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
            saImpMun
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_imun = @sCo_ImunOri
            AND co_sucur = @sCo_SucurOri
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
                    @sTablaOri = 'saImpMun', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_ImunOri
            END	
    END
```
