# SP: pInsertarUnidadTributaria
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saUnidadTributaria`](../tables/saUnidadTributaria.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pInsertarUnidadTributaria
DESCRIPCION: Dados los datos de una unidad tributaria inserta en la BD este nuevo registro.
CREADO POR: SOFTECH SISTEMAS
FECHA MODIFICACIÓN: <2020-02-18>
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pInsertarUnidadTributaria]
    (
      @sdCo_Fec smalldatetime ,
      @sUni_Gact CHAR(20) = NULL ,
      @dUni_Fecp DATETIME ,
      @deValor DECIMAL(18, 5) ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL
	
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
		
        INSERT  INTO saUnidadTributaria
                ( Co_Fec, Uni_Gact, Uni_Fecp, Valor, co_us_in, fe_us_in, co_us_mo, fe_us_mo, campo1, campo2, campo3,
                  campo4, campo5, campo6, campo7, campo8, revisado, trasnfe, co_sucu_in )
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sdCo_Fec, @sUni_Gact, @dUni_Fecp, @deValor, @sCo_Us_In, GETDATE(), @sCo_Us_In, GETDATE(), @sCampo1,
                  @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6, @sCampo7, @sCampo8, @sRevisado, @sTrasnfe,
                  @sCo_Sucu_In )    

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saUnidadTributaria', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sdCo_Fec


        SELECT
            *
```
