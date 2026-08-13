# SP: pActualizarAdiCampo
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saAdiCampo`](../tables/saAdiCampo.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pActualizarAdiCampo
*DESCRIPCIÓN	: Actualiza un Campo adicional
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [dbo].[pActualizarAdiCampo]
    (
      @sCo_AdiCampo CHAR(8) ,
      @sCo_AdiCampoOri CHAR(8) ,
      @sCo_AdiGrupo CHAR(8) ,
      @sDes_AdiCampo VARCHAR(60) ,
      @iTipo INT ,
      @sVal_Str VARCHAR(254) ,
      @deVal_Decimal DECIMAL(18, 5) ,
      @iVal_Entero INT ,
      @sdVal_Fecha SMALLDATETIME ,
      @bFijo BIT ,
      @sObservacion VARCHAR(200) ,
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
      @tsValidador TIMESTAMP = NULL ,
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
		
        IF @itipo = 1 
            BEGIN
                SET @deVal_Decimal = NULL ;
                SET @iVal_Entero = NULL ;
                SET @sdVal_Fecha = NULL ;
            END
        IF @itipo = 2 
            BEGIN	
                SET @sVal_str = NULL ;
                SET @deVal_Decimal = NULL ;
                SET @iVal_Entero = NULL ;
            END
        IF @itipo = 3 
            BEGIN	
                SET @sVal_str = NULL ;
                SET @iVal_Entero = NULL ;
                SET @sdVal_Fecha = NULL ;
            END
        IF @itipo = 4 
            BEGIN
                SET @sVal_str = NULL ;
                SET @deVal_Decimal = NULL ;			
                SET @sdVal_Fecha = NULL ;
            END

        UPDATE
            saAdiCampo
        SET co_adicampo = @sCo_AdiCampo, des_adicampo = @sDes_AdiCampo, tipo = @iTipo, val_str = @sVal_str,
            val_decimal = @deVal_Decimal, val_fecha = @sdVal_Fecha, val_entero = @iVal_Entero, fijo = @bFijo
```
