# SP: pInsertarAdiCampo
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saAdiCampo`](../tables/saAdiCampo.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pInsertarAdiCampo
*DESCRIPCIÓN	: Inserta Campo adicional
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2009-08-18
*************************************************************************/

CREATE PROCEDURE [pInsertarAdiCampo]
    (
      @sCo_AdiCampo CHAR(8) ,
      @sDes_AdiCampo VARCHAR(60) ,
      @sCo_AdiGrupo CHAR(8) ,
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
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
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
		
        INSERT  INTO saAdiCampo
                ( co_adicampo, des_adicampo, co_adigrupo, tipo, val_str, val_decimal, val_fecha, val_entero, fijo,
                  observacion, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8, co_us_in, fe_us_in,
                  co_us_mo, fe_us_mo, revisado, trasnfe, co_sucu_in, co_sucu_mo )
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us
```
