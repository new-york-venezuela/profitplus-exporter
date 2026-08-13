# SP: pActualizarArtImportacion
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saArtCaracteristica`](../tables/saArtCaracteristica.md)
- [`saArtImportacion`](../tables/saArtImportacion.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
CREADO: <2015-04-30>
MODIFICADO: <2020-07-27>
NOMBRE: pActualizarArtImportacion
DESCRIPCION: Actualiza Tabla Incoterm
CREADO POR: SOFTECH SISTEMAS

***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pActualizarArtImportacion]
    (
	  @sCo_Art CHAR(30) ,
      @sCo_Incoterm CHAR(6) ,
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
            ) ;
    
        UPDATE
            saArtImportacion
        SET co_incoterm = @sCo_Incoterm,
		     calculo = @deCalculo, tasa = @deTasa, tipo_imp = @sTipo_Imp, 
		    campo1 = @sCampo1, campo2 = @sCampo2, campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6,
            campo7 = @sCampo7, campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(),
            revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            Inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            Co_Art = @sCo_Art
            AND validador = @tsValidador
    
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		/* COMPROBACIÓN DEL CÁLCULO DE IMPUESTO E INSERCIÓN DEL REGISTRO CORRESPONDIENTE AL CRÉDITO FISCAL */

		IF (@deCalculo = 3)
		BEGIN
			IF EXISTS (SELECT * FROM saArtCaracteristica WHERE co_art = @sCo_A
```
