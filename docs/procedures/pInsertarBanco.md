# SP: pInsertarBanco
**Tipo**: Insertar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pInsertarBancos
*DESCRIPCIÓN	:	Inserta un banco
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pInsertarBanco]
    (
      @sCo_Ban CHAR(6) ,
      @sDes_Ban VARCHAR(60) ,
      @sTelefonos VARCHAR(60) = NULL ,
      @iPlazo1 INT ,
      @iPlazo2 INT ,
      @iPlazo3 INT ,
      @iPlazo4 INT ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1),
	  @deComisMismoBanco DECIMAL(18,2) = 0,
	  @deComisOtrosBancos DECIMAL(18,2) = 0
    )
AS 
    BEGIN
		
        DECLARE @Tabletimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        INSERT  INTO saBanco
                ( co_ban, des_ban, telefonos, plazo1, plazo2, plazo3, plazo4, campo1, campo2, campo3, campo4, campo5,
                  campo6, campo7, campo8, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado,
                  trasnfe, comisMismoBanco, comisOtrosBancos )
        OUTPUT  Inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_ban, @sDes_Ban, @sTelefonos, @iPlazo1, @iPlazo2, @iPlazo3, @iPlazo4, @sCampo1, @sCampo2, @sCampo3,
                  @sCampo4, @sCampo5, @sCampo6, @sCampo7, @sCampo8, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In,
                  @sCo_Sucu_In, GETDATE(), @sRevisado, @sTrasnfe, @deComisMismoBanco,@deComisOtrosBancos  )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saBanco', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I'
```
