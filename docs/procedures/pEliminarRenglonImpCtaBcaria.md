# SP: pEliminarRenglonImpCtaBcaria
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saImpuestoCuentaBancaria`](../tables/saImpuestoCuentaBancaria.md)
- [`saTasa`](../tables/saTasa.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarRenglonImpCtaBcaria
*DESCRIPCIÓN	: Elimina un registro en la tabla saTasa
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [dbo].[pEliminarRenglonImpCtaBcaria]
    (
      @stipo_impOri CHAR(3) ,
	  @scod_ctaOri CHAR(6) ,
      @sdfecha_regisOri DATETIME ,
      @iRENG_NUMOri INT ,
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
            saImpuestoCuentaBancaria
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            cod_cta = @scod_ctaOri
            AND fecha_regis = @sdfecha_regisOri	

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
                    @sTablaOri = 'saImpuestoCuentaBancaria', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @scod_ctaOri
            END


    END
```
