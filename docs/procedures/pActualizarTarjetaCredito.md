# SP: pActualizarTarjetaCredito
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saTarjetaCredito`](../tables/saTarjetaCredito.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pActualizarTarjetaCredito
*DESCRIPCIÓN	: Actualiza una Tarjeta de Crédito
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [pActualizarTarjetaCredito]
    (
      @sCo_Tar CHAR(6) ,
      @sCo_TarOri CHAR(6) ,
      @sDes_Tar VARCHAR(60) ,
      @sTelefono VARCHAR(60) ,
      @deComision DECIMAL(18, 5) ,
      @deImpuesto DECIMAL(18, 5) ,
      @deRecargo DECIMAL(18, 5) ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
    )
AS 
    BEGIN	

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        UPDATE
            saTarjetaCredito
        SET co_tar = @sCo_Tar, des_tar = @sDes_Tar, telefono = @sTelefono, comision = @deComision,
            impuesto = @deImpuesto, recargo = @deRecargo, campo1 = @sCampo1, campo2 = @sCampo2, campo3 = @sCampo3,
            campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6, campo7 = @sCampo7, campo8 = @sCampo8,
            co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(), revisado = @sRevisado,
            trasnfe = @sTrasnfe
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_tar = @sCo_TarOri
            AND validador = @tsValidador

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
```
