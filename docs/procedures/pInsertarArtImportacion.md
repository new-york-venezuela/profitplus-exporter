# SP: pInsertarArtImportacion
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saArtCaracteristica`](../tables/saArtCaracteristica.md)
- [`saArtImportacion`](../tables/saArtImportacion.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
CREADO			:	<2011-12-12>
MODIFICADO		:	<2020-07-27>
NOMBRE: pInsertarArtImportacion
DESCRIPCION: Insertar Tabla Incoterm
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pInsertarArtImportacion]
    (
      @sCo_Incoterm CHAR(6) ,
	  @sCo_Art CHAR(30),
      @deCalculo int ,
	  @deTasa Decimal(21,8),
	  @sTipo_Imp CHAR(1) = NULL,
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
      @sTrasnfe CHAR(1)
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
    
        INSERT  INTO saArtImportacion
                ( co_Incoterm, co_art, calculo, tasa, tipo_imp, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8,
                  co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe )
        OUTPUT  Inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Incoterm, @sCo_Art, @deCalculo, @deTasa, @sTipo_Imp, @sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5,
                  @sCampo6, @sCampo7, @sCampo8, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In, GETDATE(),
                  @sRevisado, @sTrasnfe )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		/* COMPROBACIÓN DEL CÁLCULO DE IMPUESTO E INSERCIÓN DEL REGISTRO CORRESPONDIENTE AL CRÉDITO FISCAL */

		IF (@deCalculo = 3)
		BEGIN
			IF EXISTS (SELECT * FROM saArtCaracteristica WHERE co_art = @sCo_Art)
			BEGIN
				UPDATE [saArtCaracteristica]
				SET credito_fiscal = 3, sin_der_cre_fis = 0, co
```
