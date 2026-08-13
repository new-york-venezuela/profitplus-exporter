# SP: pActualizarRenglonConsecutivoTipo
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saConsecutivoTipo`](../tables/saConsecutivoTipo.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pActualizarRenglonConsecutivoTipo]
    (
      @sCo_Consecutivo CHAR(16) ,
      @sCo_ConsecutivoOri CHAR(16) ,
      @bUsoEmpresa BIT ,
      @bUsoSucursal BIT ,
      @iRENG_NUM INT ,
      @iRENG_NUMOri INT ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
    
        UPDATE
            saConsecutivoTipo
        SET UsoEmpresa = @bUsoEmpresa, UsoSucursal = @bUsoSucursal, co_us_mo = @sCo_Us_Mo, fe_us_mo = GETDATE(),
            revisado = @sRevisado, co_sucu_mo = @sCo_Sucu_Mo, trasnfe = @sTrasnfe
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_consecutivo = @sCo_ConsecutivoOri		
			

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saConsecuti', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                    @sCampos = @sCampos
            END


        SELECT
            *
        FROM
            @TableTimestamp

    END
```
