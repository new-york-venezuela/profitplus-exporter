# SP: pActualizarUnidadTributaria
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saUnidadTributaria`](../tables/saUnidadTributaria.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pActualizarUnidadTributaria
DESCRIPCION: Dados los datos de una unidad tributaria, actualiza el el registro.
CREADO POR: SOFTECH SISTEMAS
FECHA MODIFICACIÓN: <2020-02-18>
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pActualizarUnidadTributaria]
    (
      @sdCo_Fec smalldatetime,
      @sdCo_FecOri smalldatetime ,
      @sUni_Gact CHAR(20) = NULL ,
      @dUni_Fecp DATETIME ,
      @deValor DECIMAL(18, 5) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sCo_Us_Mo CHAR(6) ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL ,
      @tsValidador TIMESTAMP
	
    )
AS 
    BEGIN
        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            ) ;
        UPDATE
            saUnidadTributaria
        SET Co_Fec = @sdCo_Fec, Uni_Gact = @sUni_Gact, Uni_Fecp = @dUni_Fecp, co_us_mo = @sCo_Us_Mo, Valor = @deValor,
            fe_us_mo = GETDATE(), campo1 = @sCampo1, campo2 = @sCampo2, campo3 = @sCampo3, campo4 = @sCampo4,
            campo5 = @sCampo5, campo6 = @sCampo6, campo7 = @sCampo7, campo8 = @sCampo8, co_sucu_mo = @sCo_Sucu_Mo,
            revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            Inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            Co_Fec = @sdCo_FecOri
            AND Validador = @tsValidador

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @
```
