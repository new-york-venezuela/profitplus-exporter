# SP: pInsertarBeneficiario
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saBeneficiario`](../tables/saBeneficiario.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pInsertarBeneficios
*DESCRIPCIÓN	:	Inserta un beneficio
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [pInsertarBeneficiario]
    (
      @sCod_Ben CHAR(10) ,
      @sBen_Des VARCHAR(60) ,
      @sRif VARCHAR(18) ,
      @sNit VARCHAR(18) ,
      @sTelefonos VARCHAR(60) ,
      @sDirec1 VARCHAR(MAX) ,
      @sDis_Cen VARCHAR(MAX) ,
      @bInactivo BIT ,
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
      @sTrasnfe CHAR(1) ,
      @sTipo_Per CHAR(1) ,
      @sCo_Tab CHAR(20)
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
	
        INSERT  INTO saBeneficiario
                ( cod_ben, ben_des, rif, nit, telefonos, direc1, dis_cen, inactivo, campo1, campo2, campo3, campo4,
                  campo5, campo6, campo7, campo8, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo,
                  revisado, trasnfe, tipo_per, co_tab )
        OUTPUT  inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCod_Ben, @sBen_Des, @sRif, @sNit, @sTelefonos, @sDirec1, @sDis_Cen, @bInactivo, @sCampo1, @sCampo2,
                  @sCampo3, @sCampo4, @sCampo5, @sCampo6, @sCampo7, @sCampo8, @sCo_Us_In, @sCo_Sucu_In, GETDATE(),
                  @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sRevisado, @sTrasnfe, @sTipo_Per, @sCo_Tab )
		
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saBeneficiario', @rowguidOri = @rowGuid
```
