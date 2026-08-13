# SP: pActualizarBeneficiario
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saBeneficiario`](../tables/saBeneficiario.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pAcualizarBeneficios
*DESCRIPCIÓN	:	Actualiza un beneficio
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [pActualizarBeneficiario]
    (
      @sCod_Ben CHAR(10) ,
      @sCod_BenOri CHAR(10) ,
      @sBen_Des VARCHAR(60) ,
      @sRif VARCHAR(18) ,
      @sNit VARCHAR(18) ,
      @sTelefonos VARCHAR(60) ,
      @sDirec1 VARCHAR(MAX) ,
      @sDis_Cen VARCHAR(MAX)= NULL ,
      @bInactivo BIT ,
      @sCampo1 VARCHAR(60) ,
      @sCampo2 VARCHAR(60) ,
      @sCampo3 VARCHAR(60) ,
      @sCampo4 VARCHAR(60) ,
      @sCampo5 VARCHAR(60) ,
      @sCampo6 VARCHAR(60) ,
      @sCampo7 VARCHAR(60) ,
      @sCampo8 VARCHAR(60) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) ,
      @sCampos VARCHAR(MAX) ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @sTipo_Per CHAR(1) ,
      @sCo_Tab CHAR(20) ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER

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
            dbo.saBeneficiario
        SET cod_ben = @sCod_Ben, ben_des = @sBen_Des, rif = @sRif, nit = @sNit, telefonos = @sTelefonos,
            direc1 = @sDirec1, dis_cen = @sDis_Cen, inactivo = @bInactivo, campo1 = @sCampo1, campo2 = @sCampo2,
            campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6, campo7 = @sCampo7,
            campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(),
            revisado = @sRevisado, trasnfe = @sTrasnfe, tipo_per = @sTipo_Per, co_tab = @sCo_Tab
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            cod_ben = @sCod_BenOri
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
                EXEC [pInsertarPista] @sUsuari
```
